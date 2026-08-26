#include "RtpMidiControl.h"

#include <QNetworkDatagram>
#include <QRandomGenerator>
#include <QtEndian>

#include <cmath>

static quint32 read32BE(const QByteArray &data, int offset)
{
    if (offset + 4 > data.size())
        return 0;
    return qFromBigEndian<quint32>(reinterpret_cast<const uchar *>(data.constData() + offset));
}

RtpMidiControl::RtpMidiControl(QObject *parent)
    : QObject(parent)
{
    m_ssrc = QRandomGenerator::global()->generate();
    connect(&m_controlSocket, &QUdpSocket::readyRead, this, &RtpMidiControl::readControlDatagrams);
    connect(&m_dataSocket, &QUdpSocket::readyRead, this, &RtpMidiControl::readDataDatagrams);
}

bool RtpMidiControl::start(quint16 controlPort, quint16 dataPort)
{
    if (!m_controlSocket.bind(QHostAddress::Any, controlPort)) {
        qWarning("RTP-MIDI: could not bind control port %u", controlPort);
        return false;
    }
    if (!m_dataSocket.bind(QHostAddress::Any, dataPort)) {
        qWarning("RTP-MIDI: could not bind data port %u", dataPort);
        m_controlSocket.close();
        return false;
    }
    m_controlPort = controlPort;
    m_dataPort = dataPort;
    m_enabled = true;
    return true;
}

bool RtpMidiControl::isEnabled() const
{
    return m_enabled && m_controlSocket.state() == QAbstractSocket::BoundState && m_dataSocket.state() == QAbstractSocket::BoundState;
}

quint16 RtpMidiControl::controlPort() const
{
    return m_controlPort;
}

quint16 RtpMidiControl::dataPort() const
{
    return m_dataPort;
}

void RtpMidiControl::readControlDatagrams()
{
    while (m_controlSocket.hasPendingDatagrams())
        processControlDatagram(m_controlSocket.receiveDatagram());
}

void RtpMidiControl::readDataDatagrams()
{
    while (m_dataSocket.hasPendingDatagrams())
        processDataDatagram(m_dataSocket.receiveDatagram());
}

void RtpMidiControl::sendAppleResponse(QUdpSocket &socket, const QHostAddress &address, quint16 port, quint16 command,
                                       quint32 token, quint32 ssrc, const QByteArray &name)
{
    QByteArray packet;
    packet.reserve(16 + name.size() + 1);
    packet.append(static_cast<char>(0xff));
    packet.append(static_cast<char>(0xff));
    packet.append(static_cast<char>((command >> 8) & 0xff));
    packet.append(static_cast<char>(command & 0xff));
    for (int i = 3; i >= 0; --i)
        packet.append(static_cast<char>((2 >> (i * 8)) & 0xff));
    for (int i = 3; i >= 0; --i)
        packet.append(static_cast<char>((token >> (i * 8)) & 0xff));
    for (int i = 3; i >= 0; --i)
        packet.append(static_cast<char>((ssrc >> (i * 8)) & 0xff));
    packet.append(name);
    packet.append('\0');
    const int padded = ((packet.size() + 3) / 4) * 4;
    packet.resize(padded, 0);
    socket.writeDatagram(packet, address, port);
}

void RtpMidiControl::processControlDatagram(const QNetworkDatagram &datagram)
{
    const QByteArray data = datagram.data();
    if (data.size() < 16)
        return;
    const quint16 signature = (static_cast<quint8>(data[0]) << 8) | static_cast<quint8>(data[1]);
    const quint16 command = (static_cast<quint8>(data[2]) << 8) | static_cast<quint8>(data[3]);
    if (signature != 0xffff)
        return;

    const quint32 token = read32BE(data, 8);
    const quint32 ssrc = read32BE(data, 12);

    if (command == 0x494e) { // IN
        const QByteArray name = QStringLiteral("JustLights").toUtf8();
        sendAppleResponse(m_controlSocket, datagram.senderAddress(), datagram.senderPort(), 0x4f4b, token, m_ssrc, name);
    } else if (command == 0x4259) { // BY
        // session ended
    }
    Q_UNUSED(ssrc)
}

void RtpMidiControl::processDataDatagram(const QNetworkDatagram &datagram)
{
    const QByteArray data = datagram.data();
    if (data.isEmpty())
        return;

    // Apple invitation packets on the data port use the same 0xFFFF signature.
    if (data.size() >= 16 && (static_cast<quint8>(data[0]) == 0xff) && (static_cast<quint8>(data[1]) == 0xff)) {
        const quint16 command = (static_cast<quint8>(data[2]) << 8) | static_cast<quint8>(data[3]);
        const quint32 token = read32BE(data, 8);
        if (command == 0x494e) { // IN
            const QByteArray name = QStringLiteral("JustLights").toUtf8();
            sendAppleResponse(m_dataSocket, datagram.senderAddress(), datagram.senderPort(), 0x4f4b, token, m_ssrc, name);
        }
        return;
    }

    // RTP header is at least 12 bytes; RTP-MIDI payload follows.
    const int rtpHeader = 12;
    if (data.size() < rtpHeader + 3)
        return;

    for (int i = rtpHeader; i < data.size() - 2; ++i) {
        const quint8 byte = static_cast<quint8>(data[i]);
        if ((byte & 0xf0) == 0xb0) {
            const quint8 cc = static_cast<quint8>(data[i + 1]);
            const quint8 value = static_cast<quint8>(data[i + 2]);
            if (cc <= 127) {
                const int dmxValue = qRound(static_cast<double>(value) * 255.0 / 127.0);
                emit commandReceived(QJsonObject{{"type", QStringLiteral("setChannel")},
                                                 {"channel", cc + 1},
                                                 {"value", dmxValue}});
            }
        }
    }
}

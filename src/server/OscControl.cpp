#include "OscControl.h"

#include <QJsonArray>
#include <QtEndian>

#include <cmath>
#include <cstring>

OscControl::OscControl(QObject *parent)
    : QObject(parent)
{
    connect(&m_socket, &QUdpSocket::readyRead, this, &OscControl::readPendingDatagrams);
}

bool OscControl::start(quint16 port)
{
    const bool bound = m_socket.bind(QHostAddress::Any, port);
    if (!bound) {
        qWarning("OSC: could not bind to UDP port %u", port);
        return false;
    }
    m_port = port;
    m_enabled = true;
    return true;
}

bool OscControl::isEnabled() const
{
    return m_enabled && m_socket.state() == QAbstractSocket::BoundState;
}

quint16 OscControl::port() const
{
    return m_port;
}

void OscControl::readPendingDatagrams()
{
    while (m_socket.hasPendingDatagrams())
        processDatagram(m_socket.receiveDatagram());
}

QString OscControl::readString(const QByteArray &data, int &offset)
{
    const int start = offset;
    while (offset < data.size() && data[offset] != 0)
        ++offset;
    const int end = offset;
    offset = start + readAlignedLength(end - start + 1);
    if (offset > data.size())
        offset = data.size();
    return QString::fromUtf8(data.mid(start, end - start));
}

int OscControl::readAlignedLength(int length)
{
    return ((length + 3) / 4) * 4;
}

QJsonObject OscControl::parseMessage(const QByteArray &data, int &offset)
{
    if (offset >= data.size())
        return {};

    const QString address = readString(data, offset);
    if (address.isEmpty())
        return {};

    if (address == QStringLiteral("#bundle")) {
        offset += 8; // skip 64-bit time tag
        QJsonObject last;
        while (offset + 4 <= data.size()) {
            const int size = qFromBigEndian<qint32>(reinterpret_cast<const uchar *>(data.constData() + offset));
            offset += 4;
            if (size <= 0 || offset + size > data.size())
                break;
            int childOffset = offset;
            const QJsonObject child = parseMessage(data, childOffset);
            if (!child.isEmpty())
                last = child;
            offset += size;
        }
        return last;
    }

    if (offset >= data.size())
        return {};

    const QString tags = readString(data, offset);
    if (tags.isEmpty() || !tags.startsWith(QLatin1Char(',')))
        return {};

    int value = 0;
    for (int i = 1; i < tags.size(); ++i) {
        const QChar type = tags[i];
        if (type == QLatin1Char('i')) {
            if (offset + 4 > data.size())
                return {};
            value = qFromBigEndian<qint32>(reinterpret_cast<const uchar *>(data.constData() + offset));
            offset += 4;
        } else if (type == QLatin1Char('f')) {
            if (offset + 4 > data.size())
                return {};
            const quint32 raw = qFromBigEndian<quint32>(reinterpret_cast<const uchar *>(data.constData() + offset));
            float f = 0.0f;
            std::memcpy(&f, &raw, sizeof(f));
            value = qRound(std::clamp(f, 0.0f, 1.0f) * 255.0f);
            offset += 4;
        } else if (type == QLatin1Char('s')) {
            readString(data, offset); // skip string
        } else if (type == QLatin1Char('b')) {
            if (offset + 4 > data.size())
                return {};
            const int blobSize = qFromBigEndian<qint32>(reinterpret_cast<const uchar *>(data.constData() + offset));
            offset += 4;
            offset += readAlignedLength(blobSize);
        }
    }

    const QStringList parts = address.split(QLatin1Char('/'), Qt::SkipEmptyParts);
    if (parts.isEmpty())
        return {};

    if ((parts.first() == QStringLiteral("ch") || parts.first() == QStringLiteral("channel")) && parts.size() == 2) {
        bool ok = false;
        const int channel = parts[1].toInt(&ok);
        if (ok && channel >= 1 && channel <= 512)
            return QJsonObject{{"type", QStringLiteral("setChannel")}, {"channel", channel}, {"value", value}};
    }

    if (parts.first() == QStringLiteral("blackout"))
        return QJsonObject{{"type", QStringLiteral("blackout")}};

    // /control/<name>, /fixture/<name> and /group/<name> resolve through the control map.
    if (parts.size() >= 2 && (parts.first() == QStringLiteral("control") ||
                              parts.first() == QStringLiteral("fixture") ||
                              parts.first() == QStringLiteral("group"))) {
        QJsonObject command{{"type", QStringLiteral("control")}, {"target", parts[1]}, {"value", value}};
        if (parts.size() > 2)
            command.insert(QStringLiteral("attribute"), parts.mid(2).join(QLatin1Char('/')));
        return command;
    }

    return {};
}

void OscControl::processDatagram(const QNetworkDatagram &datagram)
{
    const QByteArray data = datagram.data();
    if (data.isEmpty())
        return;
    int offset = 0;
    const QJsonObject command = parseMessage(data, offset);
    if (!command.isEmpty())
        emit commandReceived(command);
}

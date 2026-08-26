#include "SacnOutput.h"

#include "core/Universe.h"

#include <QVariant>

static void set16(QByteArray &packet, int index, quint16 value)
{
    packet[index] = static_cast<char>((value >> 8) & 0xff);
    packet[index + 1] = static_cast<char>(value & 0xff);
}

SacnOutput::SacnOutput(Universe *universe, QObject *parent)
    : QObject(parent), m_universe(universe)
{
    m_socket.setSocketOption(QAbstractSocket::MulticastTtlOption, QVariant(1));
    m_socket.setSocketOption(QAbstractSocket::MulticastLoopbackOption, QVariant(1));
}

void SacnOutput::setEnabled(bool enabled)
{
    m_enabled = enabled;
}

bool SacnOutput::isEnabled() const
{
    return m_enabled;
}

void SacnOutput::setUniverse(quint16 universe)
{
    m_universeNumber = universe;
}

quint16 SacnOutput::universe() const
{
    return m_universeNumber;
}

void SacnOutput::sendFrame()
{
    if (!m_enabled)
        return;
    const QByteArray packet = makePacket();
    m_socket.writeDatagram(packet, destination(), 5568);
    m_sequence = m_sequence == 255 ? 1 : m_sequence + 1;
}

QHostAddress SacnOutput::destination() const
{
    return QHostAddress(QStringLiteral("239.255.%1.%2")
                            .arg(m_universeNumber / 256)
                            .arg(m_universeNumber % 256));
}

QByteArray SacnOutput::makePacket()
{
    QByteArray packet(638, 0);

    // Preamble + ACN packet identifier.
    packet[0] = 0x00;
    packet[1] = 0x10;
    packet[2] = 0x00;
    packet[3] = 0x00;
    packet.replace(4, 12, QByteArray("ASC-E1.17\0\0\0", 12));

    // Root layer (22 bytes).
    packet[16] = 0x70;
    packet[17] = 0x16;
    packet[18] = 0x00;
    packet[19] = 0x00;
    packet[20] = 0x00;
    packet[21] = 0x04;

    // CID (16 bytes).
    QByteArray cid = QByteArray::fromHex(QStringLiteral("4a7573744c69676874734d4143494401").toLatin1());
    cid = cid.left(16);
    cid += QByteArray(16 - cid.size(), '\0');
    packet.replace(22, 16, cid);

    // Framing layer (77 bytes).
    packet[38] = 0x70;
    packet[39] = 0x4d;
    packet[40] = 0x00;
    packet[41] = 0x00;
    packet[42] = 0x00;
    packet[43] = 0x02;
    QByteArray sourceName = QStringLiteral("JustLights").toUtf8().left(64);
    sourceName += QByteArray(64 - sourceName.size(), '\0');
    packet.replace(44, 64, sourceName);
    packet[108] = 100; // priority
    // [109..110] reserved
    packet[111] = static_cast<char>(m_sequence);
    packet[112] = 0; // options
    set16(packet, 113, m_universeNumber);

    // DMP layer (523 bytes).
    packet[115] = 0x72;
    packet[116] = 0x0b;
    packet[117] = 0x02; // vector
    packet[118] = 0xa1; // address and data type
    packet[119] = 0x00;
    packet[120] = 0x00; // first property address
    packet[121] = 0x00;
    packet[122] = 0x01; // address increment
    packet[123] = 0x02;
    packet[124] = 0x01; // property value count = 513
    packet[125] = 0x00; // DMX start code

    QByteArray data = m_universe->snapshot().left(512);
    data += QByteArray(512 - data.size(), '\0');
    packet.replace(126, 512, data);

    return packet;
}

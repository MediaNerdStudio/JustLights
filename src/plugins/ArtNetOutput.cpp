#include "ArtNetOutput.h"

#include "core/Universe.h"

ArtNetOutput::ArtNetOutput(Universe *universe, QObject *parent)
    : QObject(parent), m_universe(universe)
{
}

void ArtNetOutput::setDestination(const QHostAddress &destination)
{
    m_destination = destination;
}

void ArtNetOutput::setEnabled(bool enabled)
{
    m_enabled = enabled;
}

bool ArtNetOutput::isEnabled() const
{
    return m_enabled;
}

void ArtNetOutput::sendFrame()
{
    if (!m_enabled)
        return;
    const QByteArray packet = makePacket();
    m_socket.writeDatagram(packet, m_destination, 6454);
}

QByteArray ArtNetOutput::makePacket()
{
    QByteArray packet(18, 0);
    packet.replace(0, 8, QByteArray("Art-Net\0", 8));
    packet[8] = 0x00;
    packet[9] = 0x50;
    packet[10] = 0x00;
    packet[11] = 14;
    packet[12] = static_cast<char>(m_sequence);
    packet[14] = static_cast<char>(m_universe->number() & 0xff);
    packet[15] = static_cast<char>((m_universe->number() >> 8) & 0x7f);
    packet[16] = 0x02;
    packet[17] = 0x00;
    packet.append(m_universe->snapshot());
    m_sequence = m_sequence == 255 ? 1 : m_sequence + 1;
    return packet;
}

#include "Universe.h"

#include <QReadLocker>
#include <QWriteLocker>
#include <algorithm>

Universe::Universe(quint16 number, QObject *parent)
    : QObject(parent), m_number(number), m_channels(ChannelCount, 0)
{
}

quint16 Universe::number() const
{
    return m_number;
}

quint8 Universe::channel(int channel) const
{
    if (channel < 1 || channel > ChannelCount)
        return 0;

    QReadLocker locker(&m_lock);
    return static_cast<quint8>(m_channels.at(channel - 1));
}

QByteArray Universe::snapshot() const
{
    QReadLocker locker(&m_lock);
    return m_channels;
}

bool Universe::setChannel(int channel, int value)
{
    if (channel < 1 || channel > ChannelCount || value < 0 || value > 255)
        return false;

    {
        QWriteLocker locker(&m_lock);
        if (static_cast<quint8>(m_channels.at(channel - 1)) == value)
            return true;
        m_channels[channel - 1] = static_cast<char>(value);
    }

    emit changed(channel, value);
    return true;
}

bool Universe::setSnapshot(const QByteArray &channels)
{
    if (channels.size() != ChannelCount)
        return false;
    {
        QWriteLocker locker(&m_lock);
        if (m_channels == channels)
            return true;
        m_channels = channels;
    }
    emit changed(0, 0);
    return true;
}

void Universe::blackout()
{
    {
        QWriteLocker locker(&m_lock);
        m_channels.fill(0);
    }
    emit changed(0, 0);
}

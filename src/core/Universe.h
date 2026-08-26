#pragma once

#include <QByteArray>
#include <QObject>
#include <QReadWriteLock>

class Universe final : public QObject
{
    Q_OBJECT

public:
    static constexpr int ChannelCount = 512;

    explicit Universe(quint16 number = 0, QObject *parent = nullptr);

    quint16 number() const;
    quint8 channel(int channel) const;
    QByteArray snapshot() const;

public slots:
    bool setChannel(int channel, int value);
    bool setSnapshot(const QByteArray &channels);
    void blackout();

signals:
    void changed(int channel, int value);

private:
    quint16 m_number;
    QByteArray m_channels;
    mutable QReadWriteLock m_lock;
};

#pragma once

#include <QHostAddress>
#include <QObject>
#include <QUdpSocket>

class Universe;

class ArtNetOutput final : public QObject
{
    Q_OBJECT

public:
    explicit ArtNetOutput(Universe *universe, QObject *parent = nullptr);

    void setDestination(const QHostAddress &destination);
    void setEnabled(bool enabled);
    bool isEnabled() const;

public slots:
    void sendFrame();

private:
    QByteArray makePacket();

    Universe *m_universe;
    QUdpSocket m_socket;
    QHostAddress m_destination = QHostAddress::Broadcast;
    quint8 m_sequence = 1;
    bool m_enabled = true;
};

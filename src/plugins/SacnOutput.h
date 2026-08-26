#pragma once

#include <QHostAddress>
#include <QObject>
#include <QUdpSocket>

class Universe;

class SacnOutput final : public QObject
{
    Q_OBJECT

public:
    explicit SacnOutput(Universe *universe, QObject *parent = nullptr);

    void setEnabled(bool enabled);
    bool isEnabled() const;
    void setUniverse(quint16 universe);
    quint16 universe() const;

public slots:
    void sendFrame();

private:
    QByteArray makePacket();
    QHostAddress destination() const;

    Universe *m_universe;
    QUdpSocket m_socket;
    quint16 m_universeNumber = 1;
    quint8 m_sequence = 1;
    bool m_enabled = false;
};

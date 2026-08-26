#pragma once

#include <QHostAddress>
#include <QJsonObject>
#include <QObject>
#include <QUdpSocket>

class RtpMidiControl final : public QObject
{
    Q_OBJECT

public:
    explicit RtpMidiControl(QObject *parent = nullptr);

    bool start(quint16 controlPort = 5004, quint16 dataPort = 5005);
    bool isEnabled() const;
    quint16 controlPort() const;
    quint16 dataPort() const;

signals:
    void commandReceived(const QJsonObject &command);

private slots:
    void readControlDatagrams();
    void readDataDatagrams();

private:
    void processControlDatagram(const QNetworkDatagram &datagram);
    void processDataDatagram(const QNetworkDatagram &datagram);
    void sendAppleResponse(QUdpSocket &socket, const QHostAddress &address, quint16 port, quint16 command,
                           quint32 token, quint32 ssrc, const QByteArray &name);
    quint32 m_ssrc = 0;
    QUdpSocket m_controlSocket;
    QUdpSocket m_dataSocket;
    quint16 m_controlPort = 0;
    quint16 m_dataPort = 0;
    bool m_enabled = false;
};

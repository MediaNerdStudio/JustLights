#pragma once

#include <QJsonObject>
#include <QNetworkDatagram>
#include <QObject>
#include <QUdpSocket>

class OscControl final : public QObject
{
    Q_OBJECT

public:
    explicit OscControl(QObject *parent = nullptr);

    bool start(quint16 port = 9000);
    bool isEnabled() const;
    quint16 port() const;

signals:
    void commandReceived(const QJsonObject &command);

private slots:
    void readPendingDatagrams();

private:
    void processDatagram(const QNetworkDatagram &datagram);
    QJsonObject parseMessage(const QByteArray &data, int &offset);
    static QString readString(const QByteArray &data, int &offset);
    static int readAlignedLength(int length);

    QUdpSocket m_socket;
    bool m_enabled = false;
    quint16 m_port = 0;
};

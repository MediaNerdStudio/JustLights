#pragma once

#include <QJsonObject>
#include <QHash>
#include <QObject>
#include <QTcpServer>
#include <QTcpSocket>

class TcpJsonControl final : public QObject
{
    Q_OBJECT

public:
    explicit TcpJsonControl(QObject *parent = nullptr);

    bool start(quint16 port = 8082);
    bool isEnabled() const;
    quint16 port() const;

signals:
    void commandReceived(const QJsonObject &command);

private slots:
    void acceptConnection();
    void removeSocket();

private:
    void readSocket(QTcpSocket *socket);
    void processLine(QTcpSocket *socket, const QByteArray &line);

    QTcpServer m_server;
    QHash<QTcpSocket *, QByteArray> m_buffers;
    bool m_enabled = false;
    quint16 m_port = 0;
};

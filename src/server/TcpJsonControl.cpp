#include "TcpJsonControl.h"

#include <QJsonDocument>
#include <QJsonParseError>

TcpJsonControl::TcpJsonControl(QObject *parent)
    : QObject(parent)
{
    connect(&m_server, &QTcpServer::newConnection, this, &TcpJsonControl::acceptConnection);
}

bool TcpJsonControl::start(quint16 port)
{
    if (!m_server.listen(QHostAddress::Any, port)) {
        qWarning("TCP JSON: could not listen on port %u", port);
        return false;
    }
    m_port = port;
    m_enabled = true;
    return true;
}

bool TcpJsonControl::isEnabled() const
{
    return m_enabled && m_server.isListening();
}

quint16 TcpJsonControl::port() const
{
    return m_port;
}

void TcpJsonControl::acceptConnection()
{
    while (QTcpSocket *socket = m_server.nextPendingConnection()) {
        m_buffers.insert(socket, QByteArray());
        connect(socket, &QTcpSocket::readyRead, this, [this, socket] { readSocket(socket); });
        connect(socket, &QTcpSocket::disconnected, this, &TcpJsonControl::removeSocket);
        if (socket->bytesAvailable())
            readSocket(socket);
    }
}

void TcpJsonControl::readSocket(QTcpSocket *socket)
{
    if (!socket || !m_buffers.contains(socket))
        return;

    m_buffers[socket].append(socket->readAll());
    QByteArray &buffer = m_buffers[socket];

    while (true) {
        const int index = buffer.indexOf('\n');
        if (index < 0)
            break;
        const QByteArray line = buffer.left(index).trimmed();
        buffer.remove(0, index + 1);
        processLine(socket, line);
    }
}

void TcpJsonControl::processLine(QTcpSocket *socket, const QByteArray &line)
{
    Q_UNUSED(socket)
    if (line.isEmpty())
        return;
    QJsonParseError error;
    const QJsonDocument document = QJsonDocument::fromJson(line, &error);
    if (error.error != QJsonParseError::NoError || !document.isObject())
        return;
    emit commandReceived(document.object());
    socket->write("{\"ok\":true}\n");
}

void TcpJsonControl::removeSocket()
{
    QTcpSocket *socket = qobject_cast<QTcpSocket *>(sender());
    if (!socket)
        return;
    m_buffers.remove(socket);
    socket->deleteLater();
}

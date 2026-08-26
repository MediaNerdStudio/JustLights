#pragma once

#include <QHttpServer>
#include <QJsonObject>
#include <QObject>
#include <QSet>
#include <QTcpServer>
#include <QTimer>

class ArtNetOutput;
class EffectEngine;
class OscControl;
class QWebSocket;
class RtpMidiControl;
class SacnOutput;
class TcpJsonControl;
class Universe;
class UsbDmxOutput;

class ControlServer final : public QObject
{
    Q_OBJECT

public:
    explicit ControlServer(Universe *universe, EffectEngine *effectEngine, ArtNetOutput *artNet,
                           UsbDmxOutput *usbDmx, SacnOutput *sacn, OscControl *osc,
                           TcpJsonControl *tcpJson, RtpMidiControl *rtpMidi, QObject *parent = nullptr);
    bool listen(quint16 port = 8080);
    quint16 port() const;

public slots:
    bool processCommand(const QJsonObject &command);

private slots:
    void acceptWebSocket();
    void handleMessage(const QString &message);
    void scheduleBroadcast();
    void broadcastUniverse();

private:
    void configureRoutes();
    QHttpServerResponse serveUi(const QString &path) const;
    QByteArray stateJson() const;
    QJsonObject protocolStatus() const;

    Universe *m_universe;
    EffectEngine *m_effectEngine;
    ArtNetOutput *m_artNet;
    UsbDmxOutput *m_usbDmx;
    SacnOutput *m_sacn;
    OscControl *m_osc;
    TcpJsonControl *m_tcpJson;
    RtpMidiControl *m_rtpMidi;
    QHttpServer m_httpServer;
    QTcpServer m_httpTcpServer;
    QSet<QWebSocket *> m_clients;
    QTimer m_broadcastTimer;
    quint16 m_port = 0;
    QJsonObject m_controlMap;
};

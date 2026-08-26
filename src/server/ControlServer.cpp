#include "ControlServer.h"

#include "core/Universe.h"
#include "engine/EffectEngine.h"
#include "plugins/ArtNetOutput.h"
#include "plugins/SacnOutput.h"
#include "plugins/UsbDmxOutput.h"
#include "server/OscControl.h"
#include "server/RtpMidiControl.h"
#include "server/TcpJsonControl.h"

#include <QDir>
#include <QDirIterator>
#include <QFile>
#include <QFileInfo>
#include <QHttpServerRequest>
#include <QHttpServerWebSocketUpgradeResponse>
#include <QJsonArray>
#include <QJsonDocument>
#include <QMimeDatabase>
#include <QRegularExpression>
#include <QSaveFile>
#include <QUrl>
#include <QWebSocket>

#include <memory>

static QString slugify(QString value)
{
    value = value.toLower().replace(QRegularExpression(QStringLiteral("[^a-z0-9]+")), QStringLiteral("-"));
    return value.remove(QRegularExpression(QStringLiteral("^-|-$")));
}

ControlServer::ControlServer(Universe *universe, EffectEngine *effectEngine, ArtNetOutput *artNet,
                             UsbDmxOutput *usbDmx, SacnOutput *sacn, OscControl *osc,
                             TcpJsonControl *tcpJson, RtpMidiControl *rtpMidi, QObject *parent)
    : QObject(parent), m_universe(universe), m_effectEngine(effectEngine), m_artNet(artNet),
      m_usbDmx(usbDmx), m_sacn(sacn), m_osc(osc), m_tcpJson(tcpJson), m_rtpMidi(rtpMidi)
{
    m_httpServer.addWebSocketUpgradeVerifier(this, [](const QHttpServerRequest &request) {
        return request.url().path() == QStringLiteral("/ws") ? QHttpServerWebSocketUpgradeResponse::accept() : QHttpServerWebSocketUpgradeResponse::passToNext();
    });
    configureRoutes();
    m_broadcastTimer.setSingleShot(true);
    m_broadcastTimer.setInterval(100);
    connect(&m_broadcastTimer, &QTimer::timeout, this, &ControlServer::broadcastUniverse);
    connect(&m_httpServer, &QHttpServer::newWebSocketConnection, this, &ControlServer::acceptWebSocket);
    connect(m_universe, &Universe::changed, this, &ControlServer::scheduleBroadcast);
    connect(m_usbDmx, &UsbDmxOutput::statusChanged, this, &ControlServer::scheduleBroadcast);
}

bool ControlServer::listen(quint16 port)
{
    if (!m_httpTcpServer.listen(QHostAddress::Any, port) || !m_httpServer.bind(&m_httpTcpServer))
        return false;
    m_port = m_httpTcpServer.serverPort();
    return true;
}

quint16 ControlServer::port() const
{
    return m_port;
}

bool ControlServer::processCommand(const QJsonObject &object)
{
    const QString type = object.value("type").toString();
    if (type == QStringLiteral("setChannel")) {
        m_effectEngine->setBaseChannel(object.value("channel").toInt(), object.value("value").toInt());
        return true;
    } else if (type == QStringLiteral("blackout")) {
        m_effectEngine->blackout();
        return true;
    } else if (type == QStringLiteral("effects:set")) {
        m_effectEngine->setEffects(object.value("effects").toArray());
        scheduleBroadcast();
        return true;
    } else if (type == QStringLiteral("setOutput")) {
        const QString output = object.value("output").toString();
        const bool enabled = object.value("enabled").toBool();
        if (output == QStringLiteral("artnet"))
            m_artNet->setEnabled(enabled);
        else if (output == QStringLiteral("sacn"))
            m_sacn->setEnabled(enabled);
        else if (output == QStringLiteral("usb"))
            m_usbDmx->setEnabled(enabled);
        scheduleBroadcast();
        return true;
    } else if (type == QStringLiteral("connectUsb")) {
        m_usbDmx->connectDevice(object.value("portName").toString());
        scheduleBroadcast();
        return true;
    } else if (type == QStringLiteral("disconnectUsb")) {
        m_usbDmx->disconnectDevice();
        scheduleBroadcast();
        return true;
    } else if (type == QStringLiteral("controlMap:set")) {
        m_controlMap = object.value("map").toObject();
        if (m_controlMap.isEmpty())
            m_controlMap = object.value("controlMap").toObject();
        scheduleBroadcast();
        return true;
    } else if (type == QStringLiteral("control")) {
        const QString target = object.value("target").toString();
        const int value = object.value("value").toInt();
        const QJsonValue entry = m_controlMap.value(target);
        QJsonArray channels;
        if (entry.isArray()) {
            channels = entry.toArray();
        } else if (entry.isObject()) {
            const QJsonObject obj = entry.toObject();
            const QString attribute = object.value("attribute").toString(QStringLiteral("Intensity"));
            channels = obj.value(attribute).toArray();
            if (channels.isEmpty())
                channels = obj.value(QStringLiteral("channels")).toArray();
        }
        for (const QJsonValue &channelValue : std::as_const(channels)) {
            const int channel = channelValue.toInt();
            if (channel >= 1 && channel <= Universe::ChannelCount)
                m_effectEngine->setBaseChannel(channel, value);
        }
        return true;
    } else if (type == QStringLiteral("protocols:get") || type == QStringLiteral("status:get")) {
        scheduleBroadcast();
        return true;
    }
    return false;
}

void ControlServer::configureRoutes()
{
    m_httpServer.route("/api/status", [this] {
        QJsonObject status{{"name", "JustLights"},
                           {"version", LIGHTCONTROLLER_VERSION},
                           {"universe", m_universe->number()},
                           {"port", port()},
                           {"outputs", QJsonObject{{"artnet", QJsonObject{{"enabled", m_artNet->isEnabled()}}},
                                                    {"sacn", QJsonObject{{"enabled", m_sacn->isEnabled()}, {"universe", m_sacn->universe()}}},
                                                    {"usb", QJsonObject{{"enabled", m_usbDmx->isEnabled()}, {"connected", m_usbDmx->isConnected()}, {"portName", m_usbDmx->portName()}, {"error", m_usbDmx->errorString()}, {"devices", QJsonValue::fromVariant(m_usbDmx->devices())}}}}},
                           {"protocols", protocolStatus()}};
        return QHttpServerResponse("application/json", QJsonDocument(status).toJson(QJsonDocument::Compact));
    });

    m_httpServer.route("/api/universe", [this] {
        return QHttpServerResponse("application/json", stateJson());
    });

    m_httpServer.route("/api/control", QHttpServerRequest::Method::Post, [this](const QHttpServerRequest &request) {
        QJsonParseError error;
        const QJsonDocument document = QJsonDocument::fromJson(request.body(), &error);
        if (error.error != QJsonParseError::NoError || !document.isObject())
            return QHttpServerResponse(QHttpServerResponder::StatusCode::BadRequest);
        const bool ok = processCommand(document.object());
        const QJsonObject result{{"ok", ok}};
        return QHttpServerResponse("application/json", QJsonDocument(result).toJson(QJsonDocument::Compact));
    });

    m_httpServer.route("/api/projects", [] {
        QJsonArray projects;
        QDir directory(QStringLiteral(LIGHTCONTROLLER_PROJECTS_DIR));
        const QFileInfoList files = directory.entryInfoList({QStringLiteral("*.json")}, QDir::Files, QDir::Time);
        for (const QFileInfo &info : files) {
            QFile file(info.absoluteFilePath());
            if (!file.open(QIODevice::ReadOnly))
                continue;
            const QJsonObject project = QJsonDocument::fromJson(file.readAll()).object();
            projects.append(QJsonObject{{"key", info.completeBaseName()}, {"name", project.value("name").toString(info.completeBaseName())}, {"modified", info.lastModified().toString(Qt::ISODate)}});
        }
        return QHttpServerResponse("application/json", QJsonDocument(projects).toJson(QJsonDocument::Compact));
    });

    m_httpServer.route("/api/projects/<arg>", QHttpServerRequest::Method::Get, [](const QString &key) {
        QFile file(QDir(QStringLiteral(LIGHTCONTROLLER_PROJECTS_DIR)).filePath(slugify(key) + QStringLiteral(".json")));
        if (!file.open(QIODevice::ReadOnly))
            return QHttpServerResponse(QHttpServerResponder::StatusCode::NotFound);
        return QHttpServerResponse("application/json", file.readAll());
    });

    m_httpServer.route("/api/projects/<arg>", QHttpServerRequest::Method::Put, [](const QString &key, const QHttpServerRequest &request) {
        QJsonParseError error;
        const QJsonDocument document = QJsonDocument::fromJson(request.body(), &error);
        const QString projectKey = slugify(key);
        if (error.error != QJsonParseError::NoError || !document.isObject() || projectKey.isEmpty())
            return QHttpServerResponse("Invalid project JSON", QHttpServerResponder::StatusCode::BadRequest);
        QDir directory(QStringLiteral(LIGHTCONTROLLER_PROJECTS_DIR));
        if (!directory.mkpath(QStringLiteral(".")))
            return QHttpServerResponse("Could not create projects directory", QHttpServerResponder::StatusCode::InternalServerError);
        QSaveFile file(directory.filePath(projectKey + QStringLiteral(".json")));
        if (!file.open(QIODevice::WriteOnly) || file.write(document.toJson(QJsonDocument::Indented)) < 0 || !file.commit())
            return QHttpServerResponse("Could not save project", QHttpServerResponder::StatusCode::InternalServerError);
        return QHttpServerResponse("application/json", QJsonDocument(QJsonObject{{"key", projectKey}}).toJson(QJsonDocument::Compact));
    });

    m_httpServer.route("/api/fixtures/ofl", [] {
        QJsonArray fixtures;
        QDirIterator iterator(QStringLiteral(LIGHTCONTROLLER_OFL_DIR), {QStringLiteral("*.json")}, QDir::Files, QDirIterator::Subdirectories);
        while (iterator.hasNext() && fixtures.size() < 1000) {
            const QString path = iterator.next();
            if (QFileInfo(path).fileName() == QStringLiteral("manufacturers.json"))
                continue;
            QFile file(path);
            if (!file.open(QIODevice::ReadOnly))
                continue;
            const QJsonObject fixture = QJsonDocument::fromJson(file.readAll()).object();
            if (fixture.value("name").toString().isEmpty())
                continue;
            fixtures.append(QJsonObject{{"name", fixture.value("name")}, {"manufacturerKey", fixture.value("manufacturerKey")}, {"fixtureKey", fixture.value("fixtureKey")}, {"categories", fixture.value("categories")}, {"modes", fixture.value("modes")}});
        }
        return QHttpServerResponse("application/json", QJsonDocument(fixtures).toJson(QJsonDocument::Compact));
    });

    m_httpServer.route("/api/fixtures/custom", QHttpServerRequest::Method::Post, [](const QHttpServerRequest &request) {
        QJsonParseError error;
        QJsonDocument document = QJsonDocument::fromJson(request.body(), &error);
        QJsonObject fixture = document.object();
        const QString manufacturer = slugify(fixture.value("manufacturerKey").toString());
        const QString fixtureKey = slugify(fixture.value("fixtureKey").toString());
        if (error.error != QJsonParseError::NoError || manufacturer.isEmpty() || fixtureKey.isEmpty() || fixture.value("name").toString().isEmpty())
            return QHttpServerResponse("Invalid OFL fixture JSON", QHttpServerResponder::StatusCode::BadRequest);
        const QString relativePath = QStringLiteral("custom/%1/%2.json").arg(manufacturer, fixtureKey);
        const QString path = QDir(QStringLiteral(LIGHTCONTROLLER_OFL_DIR)).filePath(relativePath);
        if (!QDir().mkpath(QFileInfo(path).absolutePath()))
            return QHttpServerResponse("Could not create custom fixture directory", QHttpServerResponder::StatusCode::InternalServerError);
        QSaveFile file(path);
        if (!file.open(QIODevice::WriteOnly) || file.write(document.toJson(QJsonDocument::Indented)) < 0 || !file.commit())
            return QHttpServerResponse("Could not save custom fixture", QHttpServerResponder::StatusCode::InternalServerError);
        return QHttpServerResponse("application/json", QJsonDocument(QJsonObject{{"path", relativePath}}).toJson(QJsonDocument::Compact));
    });

    m_httpServer.route("/", [this] { return serveUi("index.html"); });
    m_httpServer.route("/assets/<arg>", [this](const QString &file) { return serveUi(QStringLiteral("assets/") + file); });
    m_httpServer.route("/<arg>", [this](const QString &path) { return serveUi(path); });
}

QHttpServerResponse ControlServer::serveUi(const QString &path) const
{
    const QString uiRoot = QFileInfo(QStringLiteral(LIGHTCONTROLLER_UI_DIR)).canonicalFilePath();
    const QString requested = QFileInfo(uiRoot + QLatin1Char('/') + path).canonicalFilePath();
    if (uiRoot.isEmpty() || requested.isEmpty() || !requested.startsWith(uiRoot + QLatin1Char('/')))
        return QHttpServerResponse(QHttpServerResponder::StatusCode::NotFound);

    QFile file(requested);
    if (!file.open(QIODevice::ReadOnly)) {
        QFile fallback(uiRoot + QStringLiteral("/index.html"));
        if (!fallback.open(QIODevice::ReadOnly))
            return QHttpServerResponse("UI is not built. Run npm run build in ui/.", QHttpServerResponder::StatusCode::ServiceUnavailable);
        return QHttpServerResponse("text/html; charset=utf-8", fallback.readAll());
    }

    const QString mime = QMimeDatabase().mimeTypeForFile(requested).name();
    return QHttpServerResponse(mime.toUtf8(), file.readAll());
}

void ControlServer::acceptWebSocket()
{
    std::unique_ptr<QWebSocket> pendingClient = m_httpServer.nextPendingWebSocketConnection();
    if (!pendingClient)
        return;
    QWebSocket *client = pendingClient.release();
    client->setParent(this);
    m_clients.insert(client);
    connect(client, &QWebSocket::textMessageReceived, this, &ControlServer::handleMessage);
    connect(client, &QWebSocket::disconnected, this, [this, client] {
        m_clients.remove(client);
        client->deleteLater();
    });
    client->sendTextMessage(QString::fromUtf8(stateJson()));
}

void ControlServer::handleMessage(const QString &message)
{
    const QJsonObject object = QJsonDocument::fromJson(message.toUtf8()).object();
    processCommand(object);
}

void ControlServer::scheduleBroadcast()
{
    if (!m_broadcastTimer.isActive())
        m_broadcastTimer.start();
}

void ControlServer::broadcastUniverse()
{
    const QString message = QString::fromUtf8(stateJson());
    for (QWebSocket *client : std::as_const(m_clients))
        client->sendTextMessage(message);
}

QJsonObject ControlServer::protocolStatus() const
{
    const QJsonObject http{{"enabled", m_httpTcpServer.isListening()}, {"port", port()}};
    const QJsonObject osc{{"enabled", m_osc && m_osc->isEnabled()}, {"port", m_osc ? m_osc->port() : 0}};
    const QJsonObject tcpJson{{"enabled", m_tcpJson && m_tcpJson->isEnabled()}, {"port", m_tcpJson ? m_tcpJson->port() : 0}};
    const QJsonObject rtpmidi{{"enabled", m_rtpMidi && m_rtpMidi->isEnabled()},
                              {"controlPort", m_rtpMidi ? m_rtpMidi->controlPort() : 0},
                              {"dataPort", m_rtpMidi ? m_rtpMidi->dataPort() : 0}};
    return QJsonObject{{"http", http}, {"osc", osc}, {"tcpJson", tcpJson}, {"rtpmidi", rtpmidi}};
}

QByteArray ControlServer::stateJson() const
{
    const QByteArray channels = m_universe->snapshot();
    QJsonArray values;
    for (const char value : channels)
        values.append(static_cast<quint8>(value));
    const QJsonObject outputs{{"artnet", QJsonObject{{"enabled", m_artNet->isEnabled()}}},
                              {"sacn", QJsonObject{{"enabled", m_sacn->isEnabled()}, {"universe", m_sacn->universe()}}},
                              {"usb", QJsonObject{{"enabled", m_usbDmx->isEnabled()}, {"connected", m_usbDmx->isConnected()}, {"portName", m_usbDmx->portName()}, {"error", m_usbDmx->errorString()}, {"devices", QJsonValue::fromVariant(m_usbDmx->devices())}}}};
    return QJsonDocument(QJsonObject{{"type", "universe"}, {"universe", m_universe->number()}, {"channels", values}, {"outputs", outputs}, {"protocols", protocolStatus()}, {"effects", m_effectEngine->effects()}}).toJson(QJsonDocument::Compact);
}

#include "core/Universe.h"
#include "engine/EffectEngine.h"
#include "plugins/ArtNetOutput.h"
#include "plugins/SacnOutput.h"
#include "plugins/UsbDmxOutput.h"
#include "server/ControlServer.h"
#include "server/OscControl.h"
#include "server/RtpMidiControl.h"
#include "server/TcpJsonControl.h"

#include <QAction>
#include <QApplication>
#include <QCommandLineOption>
#include <QCommandLineParser>
#include <QCoreApplication>
#include <QLocalServer>
#include <QLocalSocket>
#include <QMenu>
#include <QMessageBox>
#include <QStyle>
#include <QSystemTrayIcon>
#include <QTimer>
#include <QUrl>
#include <QWebEnginePage>
#include <QWebEngineProfile>
#include <QWebEngineView>

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    app.setApplicationName(QStringLiteral("JustLights"));
    app.setApplicationVersion(QStringLiteral(LIGHTCONTROLLER_VERSION));
    app.setQuitOnLastWindowClosed(false);

    QCommandLineParser parser;
    parser.setApplicationDescription(QStringLiteral("JustLights DMX controller"));
    parser.addHelpOption();
    parser.addVersionOption();
    QCommandLineOption noUiOption(QStringLiteral("no-ui"), QStringLiteral("Run without the integrated application window and tray icon."));
    QCommandLineOption portOption({QStringLiteral("p"), QStringLiteral("port")}, QStringLiteral("HTTP and WebSocket port."), QStringLiteral("port"), QStringLiteral("8080"));
    parser.addOption(noUiOption);
    parser.addOption(portOption);
    parser.process(app);

    bool validPort = false;
    const int requestedPort = parser.value(portOption).toInt(&validPort);
    if (!validPort || requestedPort < 1 || requestedPort > 65535) {
        qCritical("Port must be between 1 and 65535.");
        return 1;
    }
    const bool uiEnabled = !parser.isSet(noUiOption);
    const QString instanceName = QStringLiteral("JustLights-%1").arg(requestedPort);
    QLocalSocket existingInstance;
    existingInstance.connectToServer(instanceName);
    if (existingInstance.waitForConnected(250)) {
        existingInstance.write("show");
        existingInstance.waitForBytesWritten(250);
        return 0;
    }
    QLocalServer::removeServer(instanceName);
    QLocalServer instanceServer;
    if (!instanceServer.listen(instanceName)) {
        qCritical("Could not create the single-instance server.");
        return 1;
    }

    Universe universe;
    EffectEngine effectEngine(&universe);
    ArtNetOutput artNet(&universe);
    SacnOutput sacn(&universe);
    UsbDmxOutput usbDmx(&universe);
    OscControl osc;
    TcpJsonControl tcpJson;
    RtpMidiControl rtpMidi;
    ControlServer server(&universe, &effectEngine, &artNet, &usbDmx, &sacn, &osc, &tcpJson, &rtpMidi);
    if (!server.listen(static_cast<quint16>(requestedPort))) {
        const QString message = QStringLiteral("Could not start the HTTP and WebSocket server on port %1.").arg(requestedPort);
        if (uiEnabled)
            QMessageBox::critical(nullptr, QStringLiteral("JustLights"), message);
        else
            qCritical("%s", qPrintable(message));
        return 1;
    }

    osc.start(9000);
    tcpJson.start(8082);
    rtpMidi.start(5004, 5005);

    QObject::connect(&osc, &OscControl::commandReceived, &server, &ControlServer::processCommand);
    QObject::connect(&tcpJson, &TcpJsonControl::commandReceived, &server, &ControlServer::processCommand);
    QObject::connect(&rtpMidi, &RtpMidiControl::commandReceived, &server, &ControlServer::processCommand);

    QTimer outputTimer;
    outputTimer.setTimerType(Qt::PreciseTimer);
    outputTimer.setInterval(25);
    QObject::connect(&outputTimer, &QTimer::timeout, &artNet, &ArtNetOutput::sendFrame);
    QObject::connect(&outputTimer, &QTimer::timeout, &sacn, &SacnOutput::sendFrame);
    outputTimer.start();

    const QUrl uiUrl(QStringLiteral("http://127.0.0.1:%1").arg(server.port()));
    QWebEngineView window;
    QSystemTrayIcon tray(app.style()->standardIcon(QStyle::SP_ComputerIcon));
    QMenu menu;
    QAction openAction(QStringLiteral("Open JustLights"), &menu);
    QAction blackoutAction(QStringLiteral("Blackout"), &menu);
    QAction quitAction(QStringLiteral("Quit"), &menu);
    QObject::connect(&instanceServer, &QLocalServer::newConnection, &window, [&instanceServer, &window, uiEnabled] {
        while (QLocalSocket *client = instanceServer.nextPendingConnection()) {
            client->waitForReadyRead(100);
            client->deleteLater();
        }
        if (uiEnabled) {
            window.page()->triggerAction(QWebEnginePage::ReloadAndBypassCache);
            window.show();
            window.raise();
            window.activateWindow();
        }
    });

    if (uiEnabled) {
        window.setWindowTitle(QStringLiteral("JustLights"));
        window.resize(1440, 900);
        window.page()->profile()->setHttpCacheType(QWebEngineProfile::NoCache);
        window.setUrl(uiUrl);
        window.show();

        menu.addAction(&openAction);
        menu.addAction(&blackoutAction);
        menu.addSeparator();
        menu.addAction(&quitAction);
        tray.setContextMenu(&menu);
        tray.setToolTip(QStringLiteral("JustLights — http://127.0.0.1:%1").arg(server.port()));
        tray.show();

        QObject::connect(&openAction, &QAction::triggered, &window, [&window] { window.show(); window.raise(); window.activateWindow(); });
        QObject::connect(&blackoutAction, &QAction::triggered, &effectEngine, &EffectEngine::blackout);
        QObject::connect(&quitAction, &QAction::triggered, &app, &QCoreApplication::quit);
        QObject::connect(&tray, &QSystemTrayIcon::activated, &window, [&window](QSystemTrayIcon::ActivationReason reason) {
            if (reason == QSystemTrayIcon::DoubleClick) {
                window.show();
                window.raise();
                window.activateWindow();
            }
        });
    }

    return app.exec();
}

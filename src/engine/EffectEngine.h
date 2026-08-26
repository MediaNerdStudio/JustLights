#pragma once

#include <QByteArray>
#include <QColor>
#include <QElapsedTimer>
#include <QHash>
#include <QJsonArray>
#include <QJsonObject>
#include <QObject>
#include <QPointF>
#include <QTimer>

class Universe;

class EffectEngine final : public QObject
{
    Q_OBJECT

public:
    explicit EffectEngine(Universe *universe, QObject *parent = nullptr);

    bool setBaseChannel(int channel, int value);
    void setEffects(const QJsonArray &effects);
    QJsonArray effects() const;
    void blackout();

private slots:
    void render();

private:
    struct Target {
        int index = 0;
        QHash<QString, QList<int>> channels;
    };

    struct Effect {
        QString id;
        QString type;
        QString waveform;
        double speed = 1.0;
        double depth = 1.0;
        double offset = 0.0;
        double randomize = 0.0;
        QString colorType;
        QString fixtureOrder;
        QJsonObject config;
        QList<QColor> colors;
        QList<Target> targets;
    };

    static double wave(const QString &waveform, double time, double phase);
    static double pseudoRandom(int seed);
    static QColor colorForEffect(const Effect &effect, double time, int index, int count);
    static QPointF positionForEffect(const Effect &effect, double time, int index, int count);
    static QColor paletteColor(const QList<QColor> &colors, double position, double smoothness = 1.0);
    static double curveValue(const QString &type, double position);
    static void setChannels(QByteArray &frame, const QList<int> &channels, int value, bool highestTakesPrecedence = false);
    static QList<int> parseChannels(const QJsonValue &value);

    Universe *m_universe;
    QByteArray m_base;
    QList<Effect> m_effects;
    QJsonArray m_effectDefinitions;
    QElapsedTimer m_clock;
    QTimer m_timer;
    bool m_blackout = false;
};

#include "EffectEngine.h"

#include "core/Universe.h"

#include <QJsonObject>
#include <algorithm>
#include <cmath>
#include <numbers>

EffectEngine::EffectEngine(Universe *universe, QObject *parent)
    : QObject(parent), m_universe(universe), m_base(Universe::ChannelCount, 0)
{
    m_clock.start();
    m_timer.setTimerType(Qt::PreciseTimer);
    m_timer.setInterval(25);
    connect(&m_timer, &QTimer::timeout, this, &EffectEngine::render);
    m_timer.start();
}

bool EffectEngine::setBaseChannel(int channel, int value)
{
    if (channel < 1 || channel > Universe::ChannelCount || value < 0 || value > 255)
        return false;
    m_blackout = false;
    m_base[channel - 1] = static_cast<char>(value);
    render();
    return true;
}

void EffectEngine::setEffects(const QJsonArray &definitions)
{
    m_effectDefinitions = definitions;
    m_effects.clear();
    for (const QJsonValue &value : definitions) {
        const QJsonObject object = value.toObject();
        Effect effect;
        effect.id = object.value("id").toString();
        effect.type = object.value("type").toString();
        effect.waveform = object.value("waveform").toString();
        effect.speed = object.value("speed").toDouble(1.0);
        effect.depth = object.value("depth").toDouble(100.0) / 100.0;
        effect.offset = object.value("offset").toDouble(0.0) / 100.0;
        effect.randomize = object.value("randomize").toDouble(0.0) / 100.0;
        effect.colorType = object.value("colorType").toString();
        effect.fixtureOrder = object.value("fixtureOrder").toString();
        effect.config = object;
        for (const QJsonValue &color : object.value("colors").toArray()) {
            const QColor parsed(color.toString());
            if (parsed.isValid())
                effect.colors.append(parsed);
        }
        int targetIndex = 0;
        for (const QJsonValue &targetValue : object.value("targets").toArray()) {
            const QJsonObject targetObject = targetValue.toObject();
            Target target;
            target.index = targetIndex++;
            const QJsonObject channels = targetObject.value("channels").toObject();
            for (auto iterator = channels.constBegin(); iterator != channels.constEnd(); ++iterator)
                target.channels.insert(iterator.key(), parseChannels(iterator.value()));
            effect.targets.append(target);
        }
        if (!effect.id.isEmpty() && !effect.type.isEmpty() && !effect.targets.isEmpty())
            m_effects.append(effect);
    }
    render();
}

QJsonArray EffectEngine::effects() const
{
    return m_effectDefinitions;
}

void EffectEngine::blackout()
{
    m_blackout = true;
    m_base.fill(0);
    m_universe->blackout();
}

void EffectEngine::setBpm(double bpm)
{
    m_bpm = std::max(1.0, bpm);
}

void EffectEngine::render()
{
    if (m_blackout)
        return;
    QByteArray frame = m_base;
    const double time = m_clock.elapsed() / 1000.0;
    for (const Effect &effect : std::as_const(m_effects)) {
        const int targetCount = std::max(1, static_cast<int>(effect.targets.size()));
        for (const Target &target : effect.targets) {
            int effectIndex = target.index;
            if (effect.fixtureOrder == "Random (Variable)") {
                const double duration = std::max(0.1, effect.config.value("duration").toDouble(1.0));
                effectIndex = qFloor(pseudoRandom(qFloor(time / duration) * 977 + target.index * 131) * targetCount) % targetCount;
            }
            const double orderedPhase = static_cast<double>(effectIndex) / targetCount * std::numbers::pi * 2.0 * effect.offset;
            const double randomPhase = pseudoRandom(effectIndex * 131 + 17) * std::numbers::pi * 2.0 * effect.randomize;
            const double phase = orderedPhase + randomPhase;
            if (effect.type == "positionEffect") {
                QPointF position = positionForEffect(effect, time, effectIndex, targetCount);
                if (effect.config.value("mirrorPan").toBool()) position.setX(-position.x());
                if (effect.config.value("mirrorTilt").toBool()) position.setY(-position.y());
                position.rx() += effect.config.value("panOffset").toDouble() / 180.0;
                position.ry() += effect.config.value("tiltOffset").toDouble() / 180.0;
                const bool relative = effect.config.value("relative").toBool();
                for (const int channel : target.channels.value("Pan")) {
                    if (channel < 1 || channel > Universe::ChannelCount) continue;
                    const int base = static_cast<quint8>(frame.at(channel - 1));
                    setChannels(frame, {channel}, relative ? base + qRound(position.x() * 127.5) : qRound((position.x() + 1.0) * 127.5));
                }
                for (const int channel : target.channels.value("Tilt")) {
                    if (channel < 1 || channel > Universe::ChannelCount) continue;
                    const int base = static_cast<quint8>(frame.at(channel - 1));
                    setChannels(frame, {channel}, relative ? base + qRound(position.y() * 127.5) : qRound((position.y() + 1.0) * 127.5));
                }
            } else if (effect.type == "colorEffect") {
                const QColor color = colorForEffect(effect, time, effectIndex, targetCount);
                setChannels(frame, target.channels.value("Red"), color.red());
                setChannels(frame, target.channels.value("Green"), color.green());
                setChannels(frame, target.channels.value("Blue"), color.blue());
                setChannels(frame, target.channels.value("White"), qRound(color.lightnessF() * effect.config.value("white").toDouble(0.0) / 100.0 * 255.0));
            } else if (effect.type == "dimmerEffect") {
                const double value = dimmerValueForEffect(effect, time, effectIndex, targetCount);
                setChannels(frame, target.channels.value("Intensity"), qRound(value * 255.0), true);
            } else if (effect.type == "motion") {
                const double frequency = effect.config.contains("duration") ? 1.0 / std::max(0.1, effect.config.value("duration").toDouble()) : effect.speed;
                const double pan = wave(effect.waveform, time * frequency, phase);
                const double tilt = effect.waveform == "figure8" ? wave(QStringLiteral("sine"), time * frequency * 2.0, phase) : wave(effect.waveform, time * frequency, phase + std::numbers::pi / 2.0);
                setChannels(frame, target.channels.value("Pan"), qRound(pan * 255.0 * effect.depth));
                setChannels(frame, target.channels.value("Tilt"), qRound(tilt * 255.0 * effect.depth));
            } else if (effect.type == "light" || effect.type == "wave" || effect.type == "strobe") {
                const QString waveform = effect.type == "strobe" ? QStringLiteral("square") : effect.waveform;
                setChannels(frame, target.channels.value("Intensity"), qRound(wave(waveform, time * effect.speed, phase) * 255.0 * effect.depth), true);
            } else if (effect.type == "color") {
                const double hue = std::fmod(time * effect.speed + phase / (std::numbers::pi * 2.0), 1.0);
                const double red = std::clamp(std::abs(hue * 6.0 - 3.0) - 1.0, 0.0, 1.0);
                const double green = std::clamp(2.0 - std::abs(hue * 6.0 - 2.0), 0.0, 1.0);
                const double blue = std::clamp(2.0 - std::abs(hue * 6.0 - 4.0), 0.0, 1.0);
                setChannels(frame, target.channels.value("Red"), qRound(red * 255.0 * effect.depth));
                setChannels(frame, target.channels.value("Green"), qRound(green * 255.0 * effect.depth));
                setChannels(frame, target.channels.value("Blue"), qRound(blue * 255.0 * effect.depth));
            } else if (effect.type == "police") {
                const bool first = (qFloor(time * effect.speed * 2.0 + phase / std::numbers::pi) % 2) == 0;
                setChannels(frame, target.channels.value("Red"), first ? qRound(255.0 * effect.depth) : 0);
                setChannels(frame, target.channels.value("Green"), 0);
                setChannels(frame, target.channels.value("Blue"), first ? 0 : qRound(255.0 * effect.depth));
                setChannels(frame, target.channels.value("Intensity"), qRound(255.0 * effect.depth), true);
            } else if (effect.type == "random" || effect.type == "twinkle" || effect.type == "disco") {
                const int step = qFloor(time * effect.speed);
                const double random = pseudoRandom(step * 97 + target.index * 31 + qRound(effect.randomize * 997.0));
                const double intensity = effect.type == "twinkle" ? (random > 0.72 ? random : 0.0) : random;
                setChannels(frame, target.channels.value("Intensity"), qRound(intensity * 255.0 * effect.depth), true);
                if (effect.type != "twinkle") {
                    const double hue = random;
                    setChannels(frame, target.channels.value("Red"), qRound(std::clamp(std::abs(hue * 6.0 - 3.0) - 1.0, 0.0, 1.0) * 255.0 * effect.depth));
                    setChannels(frame, target.channels.value("Green"), qRound(std::clamp(2.0 - std::abs(hue * 6.0 - 2.0), 0.0, 1.0) * 255.0 * effect.depth));
                    setChannels(frame, target.channels.value("Blue"), qRound(std::clamp(2.0 - std::abs(hue * 6.0 - 4.0), 0.0, 1.0) * 255.0 * effect.depth));
                }
            }
        }
    }
    m_universe->setSnapshot(frame);
}

double EffectEngine::wave(const QString &waveform, double time, double phase)
{
    const double value = std::sin(time * std::numbers::pi * 2.0 + phase);
    return waveform == "square" ? value >= 0.0 ? 1.0 : 0.0 : (value + 1.0) / 2.0;
}

double EffectEngine::pseudoRandom(int seed)
{
    const double value = std::sin(seed * 12.9898) * 43758.5453;
    return value - std::floor(value);
}

QColor EffectEngine::colorForEffect(const Effect &effect, double time, int index, int count)
{
    const QJsonObject &p = effect.config;
    const double position = count <= 1 ? 0.0 : static_cast<double>(index) / (count - 1);
    const double duration = std::max(0.05, p.value("duration").toDouble(1.0));
    const double progress = std::fmod(time / duration + p.value("phase").toDouble() / 100.0, 1.0);
    const double noise = p.value("noise").toDouble() / 100.0;
    const double jitter = (pseudoRandom(index * 73 + qFloor(time / duration) * 191) - 0.5) * noise;
    double sample = position;
    double intensity = 1.0;

    if (effect.colorType == "Chase") {
        sample = progress + position * p.value("timeOffset").toDouble(100.0) / 100.0 + jitter;
        const int steps = std::max(1, p.value("stepsPerSample").toInt(1));
        sample = std::floor(sample * effect.colors.size() * steps) / std::max(1, static_cast<int>(effect.colors.size()) * steps);
        return paletteColor(effect.colors, sample, p.value("smoothness").toDouble() / 100.0);
    }
    if (effect.colorType == "Scanner") {
        const double center = 1.0 - std::abs(std::fmod(progress * 2.0, 2.0) - 1.0);
        const double width = std::max(1.0 / count, p.value("length").toDouble(1.0) / count);
        intensity = std::clamp(1.0 - std::abs(position - center) / width, 0.0, 1.0);
        sample = progress + jitter;
    } else if (effect.colorType == "Yo-yo") {
        const double center = p.value("center").toDouble(50.0) / 100.0;
        const double moving = center + std::sin(progress * std::numbers::pi * 2.0) * 0.5;
        const double steepness = std::max(0.01, p.value("steepness").toDouble(50.0) / 100.0);
        intensity = std::clamp(1.0 - std::abs(position - moving) / steepness, 0.0, 1.0);
        sample = position;
    } else if (effect.colorType == "Fill") {
        intensity = position <= progress ? 1.0 : 0.0;
        sample = position;
    } else if (effect.colorType == "Rain" || effect.colorType == "Meteor") {
        const double distance = std::max(1.0, p.value("distance").toDouble(5.0));
        const double length = std::max(1.0, p.value("length").toDouble(2.0));
        const double head = std::fmod(progress * (count + distance) - index + count + distance, count + distance);
        intensity = head <= length ? 1.0 - head / length : 0.0;
        if (effect.colorType == "Meteor")
            intensity = std::pow(intensity, 1.0 + (100.0 - p.value("trail").toDouble(50.0)) / 25.0);
        sample = progress + position + jitter;
    } else if (effect.colorType == "Sparkle") {
        const double interval = std::max(0.05, p.value("interval").toDouble(0.2));
        const double lifetime = std::max(0.05, p.value("lifetime").toDouble(0.5));
        const int tick = qFloor(time / interval);
        const double active = pseudoRandom(tick * 101 + index * 37);
        intensity = active > 0.65 ? std::clamp(1.0 - std::fmod(time, interval) / lifetime, 0.0, 1.0) : 0.0;
        sample = active;
    } else if (effect.colorType == "Fire") {
        const double speed = p.value("speed").toDouble(50.0) / 25.0;
        const double heat = pseudoRandom(qFloor(time * speed) * 97 + index * 17);
        sample = std::clamp(heat - p.value("cooling").toDouble(50.0) / 200.0 + position * p.value("sparking").toDouble(50.0) / 200.0, 0.0, 1.0);
    } else if (effect.colorType == "Jellyfish") {
        const double speed = p.value("speed").toDouble(50.0) / 50.0;
        const double pulses = std::max(1, p.value("count").toInt(10));
        intensity = std::pow((std::sin((position * pulses - time * speed) * std::numbers::pi * 2.0) + 1.0) / 2.0, 2.0);
        sample = position + time * speed;
    } else if (effect.colorType == "Snakes") {
        const double speed = p.value("speed").toDouble(50.0) / 50.0;
        const double length = std::max(1.0, p.value("lengthMax").toDouble(10.0));
        const double distance = std::max(1.0, p.value("distanceMax").toDouble(5.0));
        const double segment = std::fmod(index - time * speed * count + count * 10.0, length + distance);
        intensity = segment < length ? 1.0 : 0.0;
        sample = segment / length + jitter;
    } else if (effect.colorType == "Curves") {
        const double offset = position * p.value("timeOffset").toDouble() / 100.0;
        const double curve = curveValue(p.value("hueTemplate").toString(), progress + offset);
        const QString mode = p.value("curveMode").toString(QStringLiteral("HSB"));
        if (mode == "RGB")
            return QColor::fromRgbF(curve, curveValue(p.value("greenTemplate").toString(p.value("hueTemplate").toString()), progress + offset + 0.333), curveValue(p.value("blueTemplate").toString(p.value("hueTemplate").toString()), progress + offset + 0.666));
        if (mode == "CMY")
            return QColor::fromRgbF(1.0 - curve, 1.0 - curveValue(p.value("magentaTemplate").toString(p.value("hueTemplate").toString()), progress + offset + 0.333), 1.0 - curveValue(p.value("yellowTemplate").toString(p.value("hueTemplate").toString()), progress + offset + 0.666));
        const double hue = p.value("hueStart").toDouble() + (p.value("hueEnd").toDouble(360.0) - p.value("hueStart").toDouble()) * curve;
        return QColor::fromHsvF(std::fmod(hue, 360.0) / 360.0, p.value("saturation").toDouble(100.0) / 100.0, p.value("brightness").toDouble(100.0) / 100.0);
    }

    const QColor color = paletteColor(effect.colors, sample, 1.0);
    return QColor::fromRgbF(color.redF() * intensity, color.greenF() * intensity, color.blueF() * intensity);
}

QPointF EffectEngine::positionForEffect(const Effect &effect, double time, int index, int count)
{
    const QJsonObject &p = effect.config;
    const double duration = std::max(0.1, p.value("duration").toDouble(4.0));
    const double fixturePhase = count <= 1 ? 0.0 : static_cast<double>(index) / count * p.value("timeOffset").toDouble() / 100.0;
    double progress = std::fmod(time / duration + fixturePhase, 1.0);
    const double angle = progress * std::numbers::pi * 2.0;
    const double width = p.value("width").toDouble(100.0) / 100.0;
    const double height = p.value("height").toDouble(100.0) / 100.0;
    const QString type = effect.config.value("positionType").toString();

    if (type == "Circle") return QPointF(std::sin(angle) * width, std::cos(angle) * height);
    if (type == "Figure eight") return QPointF(std::sin(angle) * width, std::sin(angle * 2.0) * height);
    if (type == "Triangle") {
        const double segment = progress * 3.0;
        if (segment < 1.0) return QPointF((-1.0 + segment * 2.0) * width, (-1.0 + segment) * height);
        if (segment < 2.0) return QPointF((1.0 - (segment - 1.0)) * width, (segment - 1.0) * height);
        return QPointF(-(segment - 2.0) * width, (1.0 - (segment - 2.0) * 2.0) * height);
    }
    if (type == "Wedge Straight") return QPointF((progress * 2.0 - 1.0) * width, (1.0 - std::abs(progress * 2.0 - 1.0) * 2.0) * height);
    if (type == "Wedge Curved") return QPointF(std::sin(angle) * width, (std::cos(angle) * 0.65 + std::cos(angle * 2.0) * 0.35) * height);
    if (type == "Tilt Track 1") return QPointF(0.0, std::sin(angle) * height);
    if (type == "Tilt Track 2") return QPointF(std::sin(angle * 0.5) * width, std::sin(angle) * height);
    if (type == "Pan Track") return QPointF(std::sin(angle) * width, 0.0);
    if (type == "Zig Zag") {
        const int zigs = std::max(1, p.value("count").toInt(2));
        const double saw = std::fmod(progress * zigs, 1.0);
        return QPointF((progress * 2.0 - 1.0) * width, (1.0 - std::abs(saw * 2.0 - 1.0) * 2.0) * height);
    }
    if (type == "Bow tie") return QPointF(std::sin(angle) * width, std::sin(angle * 2.0) * height);
    if (type == "Flower" || type == "Half Flower") {
        const int petals = std::max(1, p.value("petals").toInt(5));
        const double flowerAngle = type == "Half Flower" ? progress * std::numbers::pi : angle;
        const double radius = std::abs(std::sin(flowerAngle * petals));
        return QPointF(std::cos(flowerAngle) * radius * width, std::sin(flowerAngle) * radius * height);
    }
    if (type == "Random Dots") {
        const int step = qFloor(time / duration);
        return QPointF((pseudoRandom(step * 193 + index * 37) * 2.0 - 1.0) * width, (pseudoRandom(step * 389 + index * 71) * 2.0 - 1.0) * height);
    }
    return QPointF(std::sin(angle) * width, std::cos(angle) * height);
}

QColor EffectEngine::paletteColor(const QList<QColor> &colors, double position, double smoothness)
{
    if (colors.isEmpty())
        return QColor(Qt::black);
    if (colors.size() == 1)
        return colors.first();
    position = position - std::floor(position);
    const double scaled = position * colors.size();
    const int first = qFloor(scaled) % colors.size();
    const int second = (first + 1) % colors.size();
    const double mix = std::clamp((scaled - std::floor(scaled)) * smoothness, 0.0, 1.0);
    return QColor::fromRgbF(colors[first].redF() * (1.0 - mix) + colors[second].redF() * mix, colors[first].greenF() * (1.0 - mix) + colors[second].greenF() * mix, colors[first].blueF() * (1.0 - mix) + colors[second].blueF() * mix);
}

double EffectEngine::dimmerValueForEffect(const Effect &effect, double time, int index, int count)
{
    const QString dimmerType = effect.config.value(QStringLiteral("dimmerType")).toString();
    if (dimmerType == QStringLiteral("Curve"))
        return curveDimmerValue(effect, time, index, count);

    Effect adjusted = effect;
    QJsonObject config = effect.config;
    if (config.contains(QStringLiteral("beatMultiplier"))) {
        const double factor = beatMultiplierFactor(config.value(QStringLiteral("beatMultiplier")).toString());
        const double beatInterval = 60.0 / m_bpm;
        config.insert(QStringLiteral("duration"), beatInterval / factor);
    }
    adjusted.config = config;
    adjusted.colorType = dimmerType;
    const QColor color = colorForEffect(adjusted, time, index, count);
    return qGray(color.red(), color.green(), color.blue()) / 255.0;
}

double EffectEngine::curveDimmerValue(const Effect &effect, double time, int index, int count)
{
    const QJsonObject &p = effect.config;
    double duration = std::max(0.05, p.value(QStringLiteral("duration")).toDouble(1.0));
    if (p.contains(QStringLiteral("beatMultiplier"))) {
        const double factor = beatMultiplierFactor(p.value(QStringLiteral("beatMultiplier")).toString());
        duration = std::max(0.05, (60.0 / m_bpm) / factor);
    }
    const double position = count <= 1 ? 0.0 : static_cast<double>(index) / count;
    const double progress = std::fmod(time / duration + p.value(QStringLiteral("phase")).toDouble(0.0) / 100.0 + position * p.value(QStringLiteral("timeOffset")).toDouble(0.0) / 100.0, 1.0);
    const QJsonArray curve = p.value(QStringLiteral("curve")).toArray();
    for (const QJsonValue &segmentValue : curve) {
        const QJsonObject segment = segmentValue.toObject();
        const double from = segment.value(QStringLiteral("from")).toDouble();
        const double to = segment.value(QStringLiteral("to")).toDouble();
        if (progress < from || progress > to)
            continue;
        const double t = (to - from) == 0.0 ? 0.0 : (progress - from) / (to - from);
        const double fromValue = segment.value(QStringLiteral("fromValue")).toDouble();
        const double toValue = segment.value(QStringLiteral("toValue")).toDouble();
        const double mix = curveMixValue(segment.value(QStringLiteral("type")).toString(), t);
        return fromValue + (toValue - fromValue) * mix;
    }
    return 0.0;
}

double EffectEngine::curveMixValue(const QString &type, double t)
{
    t = std::clamp(t, 0.0, 1.0);
    if (type == QStringLiteral("constant"))
        return 0.0;
    if (type == QStringLiteral("linear"))
        return t;
    if (type == QStringLiteral("sine"))
        return 0.5 - 0.5 * std::cos(t * std::numbers::pi);
    if (type == QStringLiteral("easeInOut"))
        return t * t * (3.0 - 2.0 * t);
    if (type == QStringLiteral("curveDown"))
        return 1.0 - std::pow(1.0 - t, 2.0);
    return t;
}

double EffectEngine::beatMultiplierFactor(const QString &multiplier)
{
    if (multiplier.startsWith(QLatin1Char('\u00F7')))
        return 1.0 / std::max(1.0, multiplier.mid(1).toDouble());
    if (multiplier.startsWith(QLatin1Char('x')))
        return std::max(1.0, multiplier.mid(1).toDouble());
    bool ok = false;
    const double value = multiplier.toDouble(&ok);
    return ok ? value : 1.0;
}

double EffectEngine::curveValue(const QString &type, double position)
{
    position -= std::floor(position);
    if (type == "Constant") return 1.0;
    if (type == "Sine" || type == "Oscillation") return (std::sin(position * std::numbers::pi * 2.0) + 1.0) / 2.0;
    if (type == "Square") return position < 0.5 ? 0.0 : 1.0;
    if (type == "Ramp Down") return 1.0 - position;
    if (type == "Curve up") return position * position;
    if (type == "Curve Down") return std::sqrt(position);
    if (type == "Trapezoid") return position < 0.25 ? position * 4.0 : position < 0.75 ? 1.0 : (1.0 - position) * 4.0;
    if (type == "Bathtub") return position < 0.25 || position > 0.75 ? 1.0 : 0.0;
    if (type == "Bathtub Angled") return std::abs(position - 0.5) * 2.0;
    if (type == "Bump") return std::pow(std::sin(position * std::numbers::pi), 2.0);
    if (type.endsWith(" Bumps")) {
        const int bumps = std::max(1, type.section(QLatin1Char(' '), 0, 0).toInt());
        return std::pow(std::sin(position * std::numbers::pi * bumps), 2.0);
    }
    return position;
}

void EffectEngine::setChannels(QByteArray &frame, const QList<int> &channels, int value, bool highestTakesPrecedence)
{
    value = std::clamp(value, 0, 255);
    for (const int channel : channels) {
        if (channel < 1 || channel > Universe::ChannelCount)
            continue;
        const int current = static_cast<quint8>(frame.at(channel - 1));
        frame[channel - 1] = static_cast<char>(highestTakesPrecedence ? std::max(current, value) : value);
    }
}

QList<int> EffectEngine::parseChannels(const QJsonValue &value)
{
    QList<int> channels;
    for (const QJsonValue &channel : value.toArray())
        channels.append(channel.toInt());
    return channels;
}

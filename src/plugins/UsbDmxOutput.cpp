#include "UsbDmxOutput.h"

#include "core/Universe.h"

#include <QElapsedTimer>
#include <QLibrary>
#include <QMutexLocker>
#include <QSerialPortInfo>

#ifdef Q_OS_WIN
#include <windows.h>
#include <mmsystem.h>
#endif

using FtHandle = void *;
using FtStatus = unsigned long;
using FtDword = unsigned long;
using FtWord = unsigned short;
using FtByte = unsigned char;

static constexpr FtStatus FtOk = 0;
static constexpr FtDword FtOpenBySerialNumber = 1;
static constexpr FtDword FtPurgeRx = 1;
static constexpr FtDword FtPurgeTx = 2;

struct D2xxApi
{
    using OpenEx = FtStatus (*)(void *, FtDword, FtHandle *);
    using Close = FtStatus (*)(FtHandle);
    using ResetDevice = FtStatus (*)(FtHandle);
    using SetBaudRate = FtStatus (*)(FtHandle, FtDword);
    using SetDataCharacteristics = FtStatus (*)(FtHandle, FtByte, FtByte, FtByte);
    using SetFlowControl = FtStatus (*)(FtHandle, FtWord, FtByte, FtByte);
    using ClrRts = FtStatus (*)(FtHandle);
    using Purge = FtStatus (*)(FtHandle, FtDword);
    using SetLatencyTimer = FtStatus (*)(FtHandle, FtByte);
    using SetBreakOn = FtStatus (*)(FtHandle);
    using SetBreakOff = FtStatus (*)(FtHandle);
    using Write = FtStatus (*)(FtHandle, void *, FtDword, FtDword *);

    QLibrary library;
    OpenEx openEx = nullptr;
    Close close = nullptr;
    ResetDevice resetDevice = nullptr;
    SetBaudRate setBaudRate = nullptr;
    SetDataCharacteristics setDataCharacteristics = nullptr;
    SetFlowControl setFlowControl = nullptr;
    ClrRts clrRts = nullptr;
    Purge purge = nullptr;
    SetLatencyTimer setLatencyTimer = nullptr;
    SetBreakOn setBreakOn = nullptr;
    SetBreakOff setBreakOff = nullptr;
    Write write = nullptr;

    bool load()
    {
#ifdef Q_OS_WIN
        library.setFileName(QStringLiteral("ftd2xx"));
#else
        library.setFileName(QStringLiteral("ftd2xx64"));
#endif
        if (!library.load())
            return false;
        openEx = reinterpret_cast<OpenEx>(library.resolve("FT_OpenEx"));
        close = reinterpret_cast<Close>(library.resolve("FT_Close"));
        resetDevice = reinterpret_cast<ResetDevice>(library.resolve("FT_ResetDevice"));
        setBaudRate = reinterpret_cast<SetBaudRate>(library.resolve("FT_SetBaudRate"));
        setDataCharacteristics = reinterpret_cast<SetDataCharacteristics>(library.resolve("FT_SetDataCharacteristics"));
        setFlowControl = reinterpret_cast<SetFlowControl>(library.resolve("FT_SetFlowControl"));
        clrRts = reinterpret_cast<ClrRts>(library.resolve("FT_ClrRts"));
        purge = reinterpret_cast<Purge>(library.resolve("FT_Purge"));
        setLatencyTimer = reinterpret_cast<SetLatencyTimer>(library.resolve("FT_SetLatencyTimer"));
        setBreakOn = reinterpret_cast<SetBreakOn>(library.resolve("FT_SetBreakOn"));
        setBreakOff = reinterpret_cast<SetBreakOff>(library.resolve("FT_SetBreakOff"));
        write = reinterpret_cast<Write>(library.resolve("FT_Write"));
        return openEx && close && resetDevice && setBaudRate && setDataCharacteristics && setFlowControl && clrRts && purge && setLatencyTimer && setBreakOn && setBreakOff && write;
    }
};

UsbDmxOutput::UsbDmxOutput(Universe *universe, QObject *parent)
    : QThread(parent), m_universe(universe)
{
}

UsbDmxOutput::~UsbDmxOutput()
{
    disconnectDevice();
}

QVariantList UsbDmxOutput::devices() const
{
    QVariantList result;
    for (const QSerialPortInfo &info : QSerialPortInfo::availablePorts()) {
        const bool ftdi = info.hasVendorIdentifier() && info.vendorIdentifier() == 0x0403;
        if (!ftdi && !info.description().contains(QStringLiteral("DMX"), Qt::CaseInsensitive))
            continue;
        result.append(QVariantMap{{QStringLiteral("portName"), info.portName()}, {QStringLiteral("description"), info.description()}, {QStringLiteral("manufacturer"), info.manufacturer()}, {QStringLiteral("serialNumber"), info.serialNumber()}, {QStringLiteral("vendorId"), info.hasVendorIdentifier() ? info.vendorIdentifier() : 0}, {QStringLiteral("productId"), info.hasProductIdentifier() ? info.productIdentifier() : 0}});
    }
    return result;
}

bool UsbDmxOutput::connectDevice(const QString &portName)
{
    disconnectDevice();
    for (const QSerialPortInfo &info : QSerialPortInfo::availablePorts()) {
        if (info.portName() != portName)
            continue;
        QMutexLocker locker(&m_stateMutex);
        m_portName = portName;
        m_serialNumber = info.serialNumber();
        if (m_serialNumber.endsWith(QLatin1Char('A')) && info.productIdentifier() == 0x6001)
            m_serialNumber.chop(1);
        m_error.clear();
        break;
    }
    if (m_serialNumber.isEmpty()) {
        setError(QStringLiteral("FTDI device not found on %1").arg(portName));
        return false;
    }
    m_running = true;
    start(QThread::TimeCriticalPriority);
    return true;
}

void UsbDmxOutput::disconnectDevice()
{
    m_enabled = false;
    m_running = false;
    if (isRunning())
        wait(2000);
    m_connected = false;
    emit statusChanged();
}

void UsbDmxOutput::setEnabled(bool enabled)
{
    m_enabled = enabled && m_connected;
    emit statusChanged();
}

bool UsbDmxOutput::isEnabled() const
{
    return m_enabled;
}

bool UsbDmxOutput::isConnected() const
{
    return m_connected;
}

QString UsbDmxOutput::portName() const
{
    QMutexLocker locker(&m_stateMutex);
    return m_portName;
}

QString UsbDmxOutput::errorString() const
{
    QMutexLocker locker(&m_stateMutex);
    return m_error;
}

void UsbDmxOutput::run()
{
#ifdef Q_OS_WIN
    timeBeginPeriod(1);
#endif
    D2xxApi api;
    FtHandle handle = nullptr;
    QByteArray serial;
    {
        QMutexLocker locker(&m_stateMutex);
        serial = m_serialNumber.toLatin1();
    }
    if (!api.load()) {
        setError(QStringLiteral("FTDI D2XX driver could not be loaded"));
        m_running = false;
    } else if (api.openEx(serial.data(), FtOpenBySerialNumber, &handle) != FtOk) {
        setError(QStringLiteral("FTDI D2XX could not open device %1").arg(QString::fromLatin1(serial)));
        m_running = false;
    } else if (api.resetDevice(handle) != FtOk || api.setBaudRate(handle, 250000) != FtOk || api.setDataCharacteristics(handle, 8, 2, 0) != FtOk || api.setFlowControl(handle, 0, 0, 0) != FtOk || api.clrRts(handle) != FtOk || api.purge(handle, FtPurgeRx | FtPurgeTx) != FtOk || api.setLatencyTimer(handle, 2) != FtOk) {
        setError(QStringLiteral("FTDI D2XX device configuration failed"));
        m_running = false;
    } else {
        m_connected = true;
        emit statusChanged();
    }

    QElapsedTimer frameTimer;
    while (m_running) {
        if (!m_enabled) {
            QThread::msleep(10);
            continue;
        }
        frameTimer.start();
        QByteArray frame(1, 0);
        frame.append(m_universe->snapshot());
        if (api.setBreakOn(handle) != FtOk) {
            setError(QStringLiteral("Unable to start DMX break"));
            break;
        }
        QThread::usleep(110);
        if (api.setBreakOff(handle) != FtOk) {
            setError(QStringLiteral("Unable to end DMX break"));
            break;
        }
        QThread::usleep(16);
        FtDword written = 0;
        if (api.write(handle, frame.data(), static_cast<FtDword>(frame.size()), &written) != FtOk || written != static_cast<FtDword>(frame.size())) {
            setError(QStringLiteral("Incomplete FTDI DMX frame"));
            break;
        }
        while (m_running && frameTimer.elapsed() < 33)
            QThread::msleep(1);
    }

    if (handle)
        api.close(handle);
    m_connected = false;
    m_enabled = false;
#ifdef Q_OS_WIN
    timeEndPeriod(1);
#endif
    emit statusChanged();
}

void UsbDmxOutput::setError(const QString &error)
{
    {
        QMutexLocker locker(&m_stateMutex);
        m_error = error;
    }
    emit statusChanged();
}

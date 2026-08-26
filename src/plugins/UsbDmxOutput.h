#pragma once

#include <QAtomicInteger>
#include <QMutex>
#include <QThread>
#include <QVariantList>

class Universe;

class UsbDmxOutput final : public QThread
{
    Q_OBJECT

public:
    explicit UsbDmxOutput(Universe *universe, QObject *parent = nullptr);
    ~UsbDmxOutput() override;

    QVariantList devices() const;
    bool connectDevice(const QString &portName);
    void disconnectDevice();
    void setEnabled(bool enabled);
    bool isEnabled() const;
    bool isConnected() const;
    QString portName() const;
    QString errorString() const;

signals:
    void statusChanged();

protected:
    void run() override;

private:
    void setError(const QString &error);

    Universe *m_universe;
    QAtomicInteger<bool> m_running = false;
    QAtomicInteger<bool> m_enabled = false;
    QAtomicInteger<bool> m_connected = false;
    mutable QMutex m_stateMutex;
    QString m_portName;
    QString m_serialNumber;
    QString m_error;
};

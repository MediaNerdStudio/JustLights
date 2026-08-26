# JustLights

JustLights is a cross-platform DMX lighting controller with a C++/Qt engine and a React web interface. It runs as an integrated desktop application, remains accessible from a browser, and supports headless operation.

## Current features

- Fixture patching from a local Open Fixture Library collection
- Custom OFL-compatible fixture definitions
- Fixture groups, channel groups, remapping, and multi-fixture patching
- Live dimmer, color, position, strobe, macro, and raw DMX controls
- Backend-rendered stackable color and position effects
- Art-Net, sACN/E1.31, and FTDI USB DMX output
- WebSocket, OSC, RTP-MIDI, TCP JSON Lines, and HTTP remote control
- Integrated Qt WebEngine UI and external browser access
- JSON project saving, recent projects, import, and export

## Build

Windows currently uses Qt 6.11.2 MSVC 2022 64-bit with WebEngine and Positioning, Visual Studio Build Tools, CMake, Node.js, and npm.

```powershell
npm install
npm --prefix ui install
npm run build
npm start
```

Development mode:

```powershell
npm run dev
```

Headless or custom-port startup:

```powershell
build-msvc\Release\JustLights.exe --no-ui --port 8080
```

## Documentation

See the [JustLights Wiki](https://github.com/MediaNerdStudio/JustLights/wiki) for installation, usage, fixture management, effects, protocols, APIs, architecture, and troubleshooting.

## Default ports

| Protocol | Port |
| --- | ---: |
| HTTP + WebSocket (`/ws`) | 8080 |
| Art-Net | UDP 6454 |
| sACN / E1.31 | UDP 5568 |
| OSC | UDP 9000 |
| TCP JSON Lines | TCP 8082 |
| RTP-MIDI | UDP 5004/5005 |

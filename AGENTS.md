# JustLights

Cross-platform C++/Qt DMX lighting engine with an integrated and remotely accessible React UI.

## Requirements

- CMake 3.24+
- C++20 compiler
- Qt 6.5+ with Core, Gui, Widgets, Network, HttpServer, WebSockets, SerialPort, Positioning and WebEngineWidgets
- Node.js 20+ and npm

## Build the UI

```
cd ui
npm install
npm run build
```

## Build the application

The Windows build uses Qt 6.11.2 MSVC 2022 64-bit because Qt WebEngine is unavailable for the MinGW kit. Build everything from the project root:

```
npm run build
```

The backend build uses `CMakePresets.json`/`scripts/build-backend.ps1` and writes the Release executable to `build-msvc/Release/JustLights.exe`. Override `QT_ROOT` if the Qt MSVC kit moves.

## Run

Run the production build:

```
npm start
```

Run the Qt backend and Vite frontend together for development:

```
npm run dev
```

The development UI is available at `http://localhost:5173`; the backend also serves the latest production UI build at `http://127.0.0.1:8080`.

The application embeds the UI and also serves it at `http://127.0.0.1:8080`. HTTP and WebSocket (`/ws`) share port 8080. Use `JustLights.exe --port <port>` to change it and `--no-ui` for headless mode. DMX outputs are Art-Net universe 0 on UDP 6454 and sACN/E1.31 universe 1 multicast on UDP 5568 at 40 fps. Remote control listeners are OSC UDP 9000, TCP JSON Lines 8082, and Apple RTP-MIDI UDP 5004/5005. HTTP control commands use `POST /api/control`. The C++ `EffectEngine` owns manual base values and renders stackable motion, intensity, color and random effects at 40 Hz. The UI sends complete definitions with `effects:set`; universe feedback is throttled to 10 Hz to keep the browser responsive. FTDI Open DMX devices are discovered through Qt SerialPort metadata but transmitted through the native FTDI D2XX driver. A dedicated time-critical worker uses 250000 baud, 8 data bits, no parity, 2 stop bits, a 110µs break, a 16µs mark-after-break and a stable 30 Hz frame interval. On Windows it requests 1 ms system timer resolution while output is active. USB output remains disabled until explicitly connected and enabled on the Outputs page.

## Fixture library

Open Fixture Library data lives in `ofl/`. `GET /api/fixtures/ofl` provides its local fixture catalog to the UI. Custom OFL-compatible definitions created in the Fixture Manager are written by `POST /api/fixtures/custom` to `ofl/custom/<manufacturer>/<fixture>.json`.

## Frontend-only development

Run the Qt backend, then:

```
cd ui
npm run dev
```

Vite runs at `http://localhost:5173` and proxies `/api` and `/ws` to the backend port in `JUSTLIGHTS_PORT` (default 8080). Running `npm run preview` without the Qt backend only previews the interface; it will show the engine as offline and cannot output DMX.

## Verification

```
cd ui
npm run lint
npm run build
cd ..
cmake -S . -B build -DCMAKE_PREFIX_PATH="<Qt kit path>"
cmake --build build --config Release
```

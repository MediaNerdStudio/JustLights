# MediaNerd LightController — Plan of Action

## Goal
Build a cross‑platform, entry‑level DMX lighting control application with the ease‑of‑use of Lightkey and the hardware/protocol breadth of QLC+. Start as a desktop app for Windows/Linux, design from day one so the engine can later run headless in Docker and drive remote USB-DMX hardware through a small "satellite" bridge.

## High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Desktop app (Windows / Linux)                              │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────┐  │
│  │ React web UI │   │ C++ lighting     │   │ Qt glue    │  │
│  │ (Vite build) │◄──┤ engine + server  ├───┤ (optional) │  │
│  └──────────────┘   └──────────────────┘   └────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │ Art-Net / sACN / WebSocket
┌─────────────────────────────────────────────────────────────┐
│  Satellite USB-DMX bridge (optional, any host with USB)       │
│  Receives Art-Net/sACN or WebSocket and drives local dongle  │
└─────────────────────────────────────────────────────────────┘
```

- **Backend / engine:** C++17/20 with Qt6 (Core, Network, SerialPort).
- **API / realtime transport:** Qt `QHttpServer` + `QWebSocketServer`.
- **Frontend:** React + Vite + Tailwind CSS + DaisyUI, with a Three.js visualizer using simplified fixture primitives initially.
- **Desktop shell:** Qt system-tray launcher that starts the embedded server and opens the UI in the default browser.
- **Docker target:** same engine + static UI, no desktop tray module, controlled entirely through the browser.

## Why this stack?

| Requirement | Choice | Rationale |
|-------------|--------|-----------|
| Windows + Linux desktop | Qt6 | Native cross-platform event loop, networking, serial and threads. |
| Browser/web UI | React + embedded server | Fits your existing NEP/LL26 controller pattern, easy to iterate. |
| Realtime DMX output | C++ output thread | Predictable sub-millisecond frame timing, independent of UI. |
| Cheap USB DMX dongles | QtSerialPort / libftdi / libusb | Covers Enttec DMX USB Pro, Open DMX, FTDI-based widgets. |
| Art-Net / sACN | Qt UDP sockets | Standard network DMX, perfect for Docker/remote bridges. |
| OSC / MIDI | Qt UDP + RtMidi | Map physical controllers to faders/buttons. |
| Fixture library | Open Fixture Library JSON | Reuse thousands of community fixture definitions. |
| 3D visualizer | Three.js in frontend | WebGL preview without a separate native 3D engine. |

## Core data model

1. **Project** — a saved show file (JSON or SQLite).
2. **Universe** — 512 DMX channels + metadata (Art-Net universe, sACN CID, output plugin).
3. **Fixture** — one physical light instance: fixture definition, mode, start address, invert/tilt limits, custom label.
4. **Fixture Definition** — imported from OFL: modes, channels, capabilities, physical geometry.
5. **Group** — user-defined collection of fixtures (e.g. "Wash", "Movers", "Stage Left").
6. **Channel Function** — generic parameters the engine understands: `Dimmer`, `Red`, `Green`, `Blue`, `White`, `Amber`, `UV`, `Pan`, `Tilt`, `Zoom`, `Focus`, `Gobo`, `Strobe`, `Generic`.
7. **Playback / Preset** — a stored look or effect applied to fixtures/groups with priority, fade time and blend mode.
8. **Effect / Animation** — time-based modulation of one or more channel functions (sine, linear, chase, random, step, color gradient).

## Realtime engine design

- **Output loop thread** running at 30–44 Hz.
- For each fixture the engine resolves channel functions to 8-bit/16-bit values.
- **Stacking / blend modes:**
  - **HTP** (Highest Takes Precedence) for `Dimmer`.
  - **LTP** (Latest Takes Precedence) for non-intensity parameters, with optional crossfade time.
  - **Additive / Multiply** for color effects.
- **Effects generator** produces normalized `-1..1` or `0..1` modulation signals; these are scaled to fixture parameter ranges.
- Final channel values are cached per universe and pushed to output plugins.
- All changes are streamed to the UI over WebSocket at the same frame rate.

## Output plugins (both from the start)

- **Art-Net IV** — broadcast or unicast, multiple universes.
- **sACN / E1.31** — multicast per-universe, priority support.
- **USB DMX** — Enttec DMX USB Pro protocol, Open DMX (break/MARK after break), generic FTDI/serial.
- **Null / Debug** — writes to a file or console for testing.

*USB dongles run locally in the desktop app. In Docker they are intentionally offloaded to the satellite bridge.*

## Input / control protocols

- **OSC** — map `/light/fader/1` etc. to engine parameters.
- **MIDI** — RtMidi; map CC to faders, notes to buttons.
- **WebSocket from UI** — button presses, fader moves, preset triggers.
- **HTTP REST** — patch, project save/load, fixture import.

## Frontend UI areas

1. **Patch / Fixture Grid** — drag-and-drop fixtures into groups, set addresses, import OFL definitions.
2. **Stage Visualizer** — 2D/3D view using Three.js; fixtures render color/beam based on live DMX output; selectable.
3. **Groups & Presets** — one-click looks, stackable effects, color fades, wavy animations.
4. **Playback List** — virtual faders/buttons with priority, fade in/out, kill buttons.
5. **Effect Editor** — choose waveform, speed, depth, phase offset, color palette; preview on selected fixtures.
6. **Hardware Mapping** — map MIDI/OSC controllers to UI controls.
7. **Settings** — universes, network, output plugin selection, DMX frame rate.

## Fixture library integration

- Bundle Open Fixture Library JSON definitions in `fixtures/open-fixture-library/`.
- Offline importer reads OFL format and normalizes it to an internal schema:
  - modes → list of channel functions with DMX ranges and defaults
  - physical → dimensions, weight, beam angle, lens type
  - wheels → gobos, colors (for future use)
- Cache imported fixtures in SQLite for fast search.
- Provide a simple "Create custom fixture" UI for fixtures not in OFL.

## Satellite USB-DMX bridge

To make Docker deployment practical without USB passthrough:
- A tiny companion binary (C++/Qt or Go) runs on any machine that physically has the USB dongle.
- It receives Art-Net or a private WebSocket stream from the main LightController.
- It forwards to the local USB device.
- This also enables controlling lights at a remote venue from a laptop/Docker host over the network.

## Project phases

### Phase 0 — Scaffold (week 1)
- CMake project with Qt6, vcpkg manifest, folder structure.
- `AGENTS.md` with build/run commands.
- Qt `QHttpServer` static server and `QWebSocketServer` echo.
- Qt system-tray launcher with Open UI, server status and Quit actions.
- Vite + React + Tailwind + DaisyUI frontend shell with placeholder pages.

### Phase 1 — Core engine + DMX output (weeks 2–3)
- Universe and fixture model.
- Output thread at configurable frame rate.
- Art-Net and sACN plugins.
- USB DMX Pro plugin via QtSerialPort.
- WebSocket API to read/write live DMX channels.

### Phase 2 — Fixtures & patching (weeks 4–5)
- OFL JSON importer and internal fixture schema.
- Fixture patch UI: add fixtures, set mode/address, group them.
- Channel function resolution (dimmer, RGB, pan/tilt).
- Project save/load (JSON).

### Phase 3 — Visualizer (weeks 5–6)
- Three.js stage view using simplified primitives for moving heads, PARs, bars and strobes.
- Render fixture positions, colors, beams from live state.
- Drag fixtures on stage, zoom/pan/rotate.
- 2D fallback mode for simple PAR/wash rigs.
- Defer detailed fixture-specific 3D models and authoring tools until later.

### Phase 4 — Presets & stackable effects (weeks 7–9)
- Playback/preset data model with priority and blend modes.
- UI for creating static presets and dynamic effects.
- Effect primitives: sine wave, triangle, ramp, chase, random, color gradient.
- Stackable application to fixtures/groups.

### Phase 5 — Control protocols & hardware mapping (weeks 10–11)
- OSC input and mapping first.
- Mapping UI: learn OSC message → assign to fader/button.
- Virtual console page with faders, buttons, color picker, XY pad.
- Add physical MIDI input through RtMidi only after the higher-priority controls are complete.

### Phase 6 — Satellite & packaging (weeks 12–13)
- Build satellite USB bridge.
- Windows installer, Linux AppImage/deb.
- Docker image for headless engine + web UI.
- CI builds via GitHub Actions.

### Phase 7 — Polish (week 14+)
- Performance tuning, cue lists/timeline, MIDI timecode, multi-universe routing, user docs.

## Suggested directory layout

```
MediaNerd.LightController/
├── CMakeLists.txt
├── vcpkg.json
├── AGENTS.md
├── PLAN.md
├── src/
│   ├── core/           # Universe, Fixture, ChannelFunction, Playback
│   ├── engine/         # Output loop, blend modes, effects
│   ├── plugins/        # ArtNet, sACN, UsbDmx, Osc, Midi
│   ├── server/         # HTTP + WebSocket server
│   └── main.cpp
├── fixtures/
│   └── open-fixture-library/   # OFL submodule or snapshot
├── ui/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── visualizer/
│       └── api/
├── satellite/
│   └── src/
└── packaging/
    ├── docker/
    └── installer/
```

## Confirmed architecture decisions

1. **Desktop shell:** Qt system-tray launcher opens the UI in the user's default browser.
2. **Embedded server:** Qt-only, using `QHttpServer` and `QWebSocketServer`.
3. **Fixture geometry:** Begin with simplified primitives for moving heads, PARs, bars and strobes; detailed 3D work is deferred.

## Input priority decision

- **MIDI:** Use RtMidi, but treat physical MIDI support as the lowest-priority input feature. Focus first on the web UI, OSC and network-based control.

## Recommended first commit

A minimal working end-to-end:
- CMake builds `LightController.exe`.
- Embedded server serves a static "Hello DMX" page.
- WebSocket streams a 512-byte universe that slowly animates channel 1.
- Art-Net plugin broadcasts that universe to `255.255.255.255`.
- UI slider updates channel 1 in real time.

This proves the entire desktop-app/web-UI/DMX pipeline before adding fixtures and effects.

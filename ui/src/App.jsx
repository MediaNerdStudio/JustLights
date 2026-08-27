import { useEffect, useRef, useState } from 'react'
import { Activity, CirclePower, Download, FilePlus2, FolderOpen, Grid3X3, Info, Radio, Save, Settings2, SlidersVertical } from 'lucide-react'
import FixtureControls from './FixtureControls.jsx'
import FixtureStage from './FixtureStage.jsx'
import FixtureManager from './FixtureManager.jsx'
import logoIcon from './assets/JustLights.Icon.White.svg'
import lettersLogo from './JustLights.Letters.White.svg'
import splashArtwork from './assets/JustLights.Splash.webp'

const initialChannels = Array(512).fill(0)
const pages = [
  { id: 'control', label: 'Control', icon: SlidersVertical },
  { id: 'patch', label: 'Patch', icon: Grid3X3 },
  { id: 'outputs', label: 'Outputs', icon: Radio },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

function loadFixtures() {
  const stored = JSON.parse(localStorage.getItem('lightcontroller.fixtures') || '[]')
  return stored.filter((fixture) => Array.isArray(fixture.channels)).map((fixture) => ({ ...fixture, channels: fixture.channels.map((channel) => ({ ...channel, kind: channel.kind && channel.kind !== 'Generic' ? channel.kind : inferKind(channel.name) })) }))
}

function inferKind(name = '') {
  const value = name.toLowerCase()
  if (value.includes('pan')) return 'Pan'
  if (value.includes('tilt')) return 'Tilt'
  if (value.includes('dimmer') || value.includes('intensity')) return 'Intensity'
  if (value.includes('red')) return 'Red'
  if (value.includes('green')) return 'Green'
  if (value.includes('blue')) return 'Blue'
  if (value.includes('white')) return 'White'
  if (value.includes('amber')) return 'Amber'
  if (value.includes('uv') || value.includes('ultraviolet')) return 'UV'
  if (value.includes('strobe') || value.includes('shutter')) return 'Strobe'
  if (value.includes('macro') || value.includes('program') || value.includes('gobo') || value.includes('color wheel')) return 'Macro'
  if (value.includes('speed')) return 'Speed'
  return 'Generic'
}

const defaultChannelGroups = [{ id: 'intensity', name: 'Intensity', color: '#ffffff' }, { id: 'color', name: 'Color', color: '#7c3aed' }, { id: 'position', name: 'Position', color: '#22c55e' }]
const defaultAutosave = { enabled: true, intervalMinutes: 5, maxVersions: 20 }
const blankProjectState = () => ({ fixtures: [], groups: [], channelGroups: defaultChannelGroups, effects: [], channels: initialChannels, outputs: { artnet: true, sacn: false, usb: false }, settings: { projectName: 'Untitled', frameRate: 40, bpm: 120, autosave: { ...defaultAutosave } }, stage: { locked: true, height: 288 } })

function useVersionInfo() {
  const [current, setCurrent] = useState('')
  const [latest, setLatest] = useState(null)
  useEffect(() => {
    fetch('/api/status').then((response) => response.ok ? response.json() : null).then((status) => setCurrent(status?.version || '')).catch(() => {})
    fetch('https://api.github.com/repos/MediaNerdStudio/JustLights/releases/latest').then((response) => response.ok ? response.json() : null).then((release) => setLatest(release)).catch(() => {})
  }, [])
  const latestTag = latest?.tag_name || ''
  const hasUpdate = current && latestTag && latestTag.replace(/^v/, '') !== current
  return { current, latest: latestTag, hasUpdate, url: latest?.html_url || 'https://github.com/MediaNerdStudio/JustLights/releases' }
}

function makeControlMap(fixtures, groups) {
  const fixtureChannels = (fixture) => fixture.channels.reduce((map, channel) => { if (!channel.name.toLowerCase().includes('fine')) (map[channel.kind] ||= []).push(fixture.address + channel.offset); return map }, {})
  const map = {}
  fixtures.forEach((fixture) => { const channels = fixtureChannels(fixture); map[fixture.id] = channels; map[fixture.name] = channels })
  groups.forEach((group) => { const channels = {}; fixtures.filter((fixture) => group.fixtureIds.includes(fixture.id)).forEach((fixture) => Object.entries(fixtureChannels(fixture)).forEach(([kind, values]) => { (channels[kind] ||= []).push(...values) })); map[group.id] = channels; map[group.name] = channels })
  return map
}

function App() {
  const [project, setProject] = useState(null)
  const [recentProjects, setRecentProjects] = useState([])
  const [projectError, setProjectError] = useState('')
  const [channels, setChannels] = useState(initialChannels)
  const [connected, setConnected] = useState(false)
  const [bank, setBank] = useState(0)
  const [page, setPage] = useState('control')
  const [fixtures, setFixtures] = useState(loadFixtures)
  const [groups, setGroups] = useState(() => JSON.parse(localStorage.getItem('lightcontroller.fixtureGroups') || '[]'))
  const [channelGroups, setChannelGroups] = useState(() => JSON.parse(localStorage.getItem('lightcontroller.channelGroups') || JSON.stringify(defaultChannelGroups)))
  const [effects, setEffects] = useState(() => JSON.parse(localStorage.getItem('lightcontroller.effects') || '[]'))
  const [outputs, setOutputs] = useState({ artnet: true, sacn: false, usb: false })
  const [outputStatus, setOutputStatus] = useState({ usb: { connected: false, portName: '', error: '', devices: [] } })
  const [protocolStatus, setProtocolStatus] = useState({})
  const [settings, setSettings] = useState({ projectName: 'Untitled', frameRate: 40, bpm: 120, autosave: { ...defaultAutosave } })
  const versionInfo = useVersionInfo()
  const socketRef = useRef(null)
  const autosaveRef = useRef({ enabled: true, intervalMs: 300000, getDocument: () => null })

  useEffect(() => {
    let reconnectTimer
    let active = true

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`)
      socketRef.current = socket
      socket.onopen = () => active && setConnected(true)
      socket.onclose = () => {
        if (!active) return
        setConnected(false)
        reconnectTimer = window.setTimeout(connect, 1500)
      }
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.type === 'universe' && Array.isArray(message.channels)) {
          setChannels(message.channels)
          if (message.outputs) {
            setOutputStatus(message.outputs)
            setOutputs((current) => ({ ...current, artnet: message.outputs.artnet?.enabled ?? current.artnet, sacn: message.outputs.sacn?.enabled ?? current.sacn, usb: message.outputs.usb?.enabled ?? current.usb }))
          }
          if (message.protocols) setProtocolStatus(message.protocols)
        }
      }
    }

    connect()
    return () => {
      active = false
      window.clearTimeout(reconnectTimer)
      socketRef.current?.close()
    }
  }, [])

  useEffect(() => { fetch('/api/projects').then((response) => response.ok ? response.json() : []).then(setRecentProjects).catch(() => setRecentProjects([])) }, [])
  useEffect(() => localStorage.setItem('lightcontroller.fixtures', JSON.stringify(fixtures)), [fixtures])
  useEffect(() => localStorage.setItem('lightcontroller.fixtureGroups', JSON.stringify(groups)), [groups])
  useEffect(() => localStorage.setItem('lightcontroller.channelGroups', JSON.stringify(channelGroups)), [channelGroups])
  useEffect(() => localStorage.setItem('lightcontroller.effects', JSON.stringify(effects)), [effects])

  const send = (message) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(message))
  }

  useEffect(() => {
    if (connected) send({ type: 'controlMap:set', map: makeControlMap(fixtures, groups) })
  }, [connected, fixtures, groups])

  useEffect(() => {
    if (connected) send({ type: 'bpm:set', bpm: settings.bpm || 120 })
  }, [connected, settings.bpm])

  useEffect(() => {
    autosaveRef.current.enabled = settings.autosave?.enabled ?? true
    autosaveRef.current.intervalMs = Math.max(1, settings.autosave?.intervalMinutes ?? 5) * 60000
  }, [settings.autosave?.enabled, settings.autosave?.intervalMinutes])

  useEffect(() => {
    autosaveRef.current.getDocument = () => projectDocument()
  })

  useEffect(() => {
    if (!project?.key || !autosaveRef.current.enabled) return undefined
    const id = window.setInterval(() => {
      const document = autosaveRef.current.getDocument()
      if (!document) return
      fetch(`/api/projects/${encodeURIComponent(project.key)}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document)
      }).catch(() => {})
    }, autosaveRef.current.intervalMs)
    return () => window.clearInterval(id)
  }, [project?.key, settings.autosave?.enabled, settings.autosave?.intervalMinutes])

  const setChannel = (channel, value) => {
    setChannels((current) => current.map((item, index) => index === channel - 1 ? value : item))
    send({ type: 'setChannel', channel, value })
  }

  const projectDocument = (name = settings.projectName) => ({ version: 1, name, modified: new Date().toISOString(), state: { fixtures, groups, channelGroups, effects, channels, outputs, settings: { ...settings, projectName: name }, stage: { locked: localStorage.getItem('lightcontroller.stageLocked') !== 'false', height: Number(localStorage.getItem('lightcontroller.stageHeight')) || 288 } } })
  const applyProject = (document, key = null) => {
    const state = document.state || document
    setFixtures(state.fixtures || [])
    setGroups(state.groups || [])
    setChannelGroups(state.channelGroups || defaultChannelGroups)
    setEffects(state.effects || [])
    setChannels(state.channels?.length === 512 ? state.channels : initialChannels)
    setOutputs({ artnet: true, sacn: false, usb: false, ...(state.outputs || {}) })
    setSettings({ projectName: document.name || state.settings?.projectName || 'Untitled', frameRate: state.settings?.frameRate || 40, bpm: state.settings?.bpm || 120, autosave: { ...defaultAutosave, ...(state.settings?.autosave || {}) } })
    localStorage.setItem('lightcontroller.stageLocked', String(state.stage?.locked ?? true))
    localStorage.setItem('lightcontroller.stageHeight', String(state.stage?.height || 288))
    ;(state.channels || initialChannels).forEach((value, index) => send({ type: 'setChannel', channel: index + 1, value }))
    Object.entries(state.outputs || {}).forEach(([output, enabled]) => send({ type: 'setOutput', output, enabled }))
    setProject({ key, name: document.name || state.settings?.projectName || 'Untitled' })
    setProjectError('')
  }
  const refreshProjects = () => fetch('/api/projects').then((response) => response.json()).then(setRecentProjects)
  const createProject = (name) => {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
  applyProject({ name, state: blankProjectState() }, key)
}
  const openProject = async (key) => {
    const response = await fetch(`/api/projects/${encodeURIComponent(key)}`)
    if (!response.ok) return setProjectError('Could not open project.')
    applyProject(await response.json(), key)
  }
  const saveProject = async () => {
    const name = settings.projectName.trim() || 'Untitled'
    const key = project?.key || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
    const response = await fetch(`/api/projects/${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectDocument(name)) })
    if (!response.ok) return setProjectError('Could not save project.')
    const result = await response.json()
    setProject({ key: result.key, name })
    await refreshProjects()
  }
  const exportProject = () => {
    const document = projectDocument()
    const link = window.document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }))
    link.download = `${(document.name || 'project').replace(/[^a-z0-9]+/gi, '-')}.justlights.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const importProject = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try { applyProject(JSON.parse(await file.text())) } catch { setProjectError('Invalid JustLights project file.') }
    event.target.value = ''
  }
  const visibleChannels = Array.from({ length: 16 }, (_, index) => bank * 16 + index + 1)

  if (!project) return <ProjectSplash projects={recentProjects} error={projectError} versionInfo={versionInfo} onNew={createProject} onOpen={openProject} onImport={importProject} />

  return (
    <div className="min-h-screen bg-[#0b0d12] text-slate-200">
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#11141b] px-4">
        <div className="flex items-center gap-3">
          <img className="h-8 w-9 object-contain" src={logoIcon} alt="" />
          <div><img className="h-5 object-contain" src={lettersLogo} alt="JustLights" /><div className="text-[10px] text-slate-500">{settings.projectName}</div></div>
        </div>
        {versionInfo.hasUpdate && <div className="alert alert-soft alert-primary hidden items-center gap-2 px-3 py-1 text-xs md:flex"><Info size={14} /><span>New version <a className="link font-medium" href={versionInfo.url} target="_blank" rel="noreferrer">{versionInfo.latest}</a> available</span></div>}
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setProject(null)}><FolderOpen size={15} /> Projects</button>
          <button className="btn btn-ghost btn-sm" onClick={exportProject}><Download size={15} /> Export</button>
          <button className="btn btn-primary btn-sm" onClick={saveProject}><Save size={15} /> Save</button>
          <div className={`badge gap-2 ${connected ? 'badge-success' : 'badge-error'} badge-outline`}><Activity size={13} />{connected ? 'Engine online' : 'Engine offline'}</div>
          <button className="btn btn-error btn-sm" onClick={() => send({ type: 'blackout' })}><CirclePower size={16} /> Blackout</button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-20 border-r border-white/10 bg-[#0f1117] py-3">
          <nav className="flex flex-col items-center gap-2">
            {pages.map((item) => <NavButton key={item.id} icon={item.icon} label={item.label} active={page === item.id} onClick={() => setPage(item.id)} />)}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-3">
          {page === 'control' && <ControlPage key={project.key || project.name} bank={bank} setBank={setBank} channels={channels} visibleChannels={visibleChannels} setChannel={setChannel} fixtures={fixtures} setFixtures={setFixtures} groups={groups} effects={effects} setEffects={setEffects} send={send} frameRate={settings.frameRate} outputs={outputs} />}
          {page === 'patch' && <FixtureManager fixtures={fixtures} setFixtures={setFixtures} groups={groups} setGroups={setGroups} channelGroups={channelGroups} setChannelGroups={setChannelGroups} />}
          {page === 'outputs' && <OutputsPage outputs={outputs} setOutputs={setOutputs} outputStatus={outputStatus} protocolStatus={protocolStatus} connected={connected} send={send} />}
          {page === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} onSave={saveProject} />}
        </main>
      </div>
    </div>
  )
}

function ProjectSplash({ projects, error, versionInfo, onNew, onOpen, onImport }) {
  const [name, setName] = useState('')
  const create = () => { const projectName = name.trim(); if (projectName) onNew(projectName) }
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#0b0d12] p-6 text-slate-200"><img className="absolute inset-0 size-full object-cover" src={splashArtwork} alt="" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(11,13,18,.2),rgba(11,13,18,.88)_80%)] backdrop-blur-[1px]" /><section className="relative z-10 w-full max-w-3xl">{versionInfo.hasUpdate && <div className="alert alert-info mb-4 items-center gap-2 bg-slate-800/80 text-xs text-slate-200"><Info size={16} /><span>New version <a className="link font-medium" href={versionInfo.url} target="_blank" rel="noreferrer">{versionInfo.latest}</a> is available on GitHub.</span></div>}<div className="mx-auto mb-10 flex items-center justify-center gap-5"><img className="h-20 w-24 object-contain" src={logoIcon} alt="" /><img className="h-12 object-contain" src={lettersLogo} alt="JustLights" /></div><div className="grid gap-4 md:grid-cols-[1fr_1.5fr]"><div className="rounded-xl border border-white/10 bg-[#11141b] p-5"><h1 className="text-lg font-semibold">New project</h1><p className="mt-1 text-xs text-slate-500">Start with an empty universe and fixture patch.</p><input className="input input-sm mt-5 w-full" placeholder="Project name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') create() }} /><button className="btn btn-primary btn-sm mt-3 w-full" disabled={!name.trim()} onClick={create}><FilePlus2 size={15} /> Create project</button><div className="divider text-[10px] text-slate-600">or</div><label className="btn btn-outline btn-sm w-full"><FolderOpen size={15} /> Import project<input type="file" className="hidden" accept=".json,.justlights.json" onChange={onImport} /></label></div><div className="rounded-xl border border-white/10 bg-[#11141b] p-5"><h2 className="text-lg font-semibold">Recent projects</h2><div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{projects.length ? projects.map((item) => <button key={item.key} className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[.025] p-3 text-left hover:border-primary/50 hover:bg-primary/10" onClick={() => onOpen(item.key)}><span><span className="block text-sm font-medium">{item.name}</span><span className="text-[10px] text-slate-500">{item.modified ? new Date(item.modified).toLocaleString() : item.key}</span></span><FolderOpen size={16} className="text-slate-500" /></button>) : <div className="grid h-40 place-items-center text-sm text-slate-600">No saved projects yet</div>}</div>{error && <div className="mt-3 text-xs text-error">{error}</div>}</div></div></section><div className="absolute bottom-4 z-10 text-center text-[10px] text-slate-400">Version {versionInfo.current || '...'} © {new Date().getFullYear()} MediaNerd</div></main>
}

function ControlPage({ bank, setBank, channels, visibleChannels, setChannel, fixtures, setFixtures, groups, effects, setEffects, send, frameRate, outputs }) {
  const [rawOpen, setRawOpen] = useState(false)
  const [selectedFixtureId, setSelectedFixtureId] = useState(fixtures[0]?.id || '')
  const activeOutputs = Object.entries(outputs).filter(([, enabled]) => enabled).map(([name]) => name.toUpperCase()).join(', ') || 'None'
  return <>
    <div className="space-y-3"><FixtureStage fixtures={fixtures} setFixtures={setFixtures} values={channels} selectedId={selectedFixtureId} setSelectedId={setSelectedFixtureId} /><FixtureControls fixtures={fixtures} groups={groups} values={channels} setChannel={setChannel} send={send} selectedId={selectedFixtureId} setSelectedId={setSelectedFixtureId} effects={effects} setEffects={setEffects} /></div>
    <section className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#11141b] shadow-2xl">
      <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setRawOpen(!rawOpen)}><span><span className="font-medium">Raw DMX channels</span><span className="ml-2 text-xs text-slate-500">Diagnostics and manual override</span></span><span className="text-sm text-slate-500">{rawOpen ? 'Collapse' : 'Expand'}</span></button>
      {rawOpen && <div className="overflow-x-auto border-t border-white/10 p-3"><select className="select select-xs mb-3" value={bank} onChange={(event) => setBank(Number(event.target.value))}>{Array.from({ length: 32 }, (_, index) => <option key={index} value={index}>Bank {index + 1} · {index * 16 + 1}–{index * 16 + 16}</option>)}</select><div className="grid min-w-[720px] grid-cols-16 gap-1">{visibleChannels.map((channel) => <ChannelFader key={channel} channel={channel} value={channels[channel - 1] ?? 0} onChange={setChannel} />)}</div></div>}
    </section>
    <section className="mt-3 grid gap-3 md:grid-cols-3">
      <InfoCard title="Outputs" value={activeOutputs} status="Configured" />
      <InfoCard title="Output rate" value={`${frameRate} frames/sec`} status="Live" />
      <InfoCard title="Patched fixtures" value={`Universe 1 · ${fixtures.length} fixture${fixtures.length === 1 ? '' : 's'}`} status={fixtures.length ? 'Ready' : 'Setup required'} muted={!fixtures.length} />
    </section>
  </>
}

function OutputsPage({ outputs, setOutputs, outputStatus, protocolStatus, connected, send }) {
  const usb = outputStatus.usb || { connected: false, portName: '', error: '', devices: [] }
  const [selectedPort, setSelectedPort] = useState('')
  const portName = selectedPort || usb.portName || usb.devices?.[0]?.portName || ''
  const toggleOutput = (output, enabled) => { setOutputs({ ...outputs, [output]: enabled }); send({ type: 'setOutput', output, enabled }) }
  return <>
    <PageTitle title="DMX Outputs" subtitle="Configure universe routing and output protocols" />
    <div className="mt-5 grid gap-4 xl:grid-cols-3">
      <section className="rounded-xl border border-white/10 bg-[#11141b] p-5"><div className="flex items-start justify-between"><OutputIcon /><input type="checkbox" className="toggle toggle-primary" checked={outputs.artnet} onChange={(event) => toggleOutput('artnet', event.target.checked)} /></div><h2 className="mt-4 font-semibold">Art-Net</h2><p className="mt-1 text-sm text-slate-500">Broadcast · Universe 0 · UDP 6454</p><OutputBadge active={outputs.artnet && connected} enabled={outputs.artnet} /></section>
      <section className="rounded-xl border border-white/10 bg-[#11141b] p-5"><div className="flex items-start justify-between"><OutputIcon /><input type="checkbox" className="toggle toggle-primary" checked={outputs.usb} disabled={!usb.connected} onChange={(event) => toggleOutput('usb', event.target.checked)} /></div><h2 className="mt-4 font-semibold">FTDI USB DMX</h2><p className="mt-1 text-sm text-slate-500">Open DMX · 250000 baud · 8N2</p><div className="mt-4 space-y-2"><select className="select select-sm w-full" value={portName} disabled={usb.connected || !usb.devices?.length} onChange={(event) => setSelectedPort(event.target.value)}>{usb.devices?.length ? usb.devices.map((device) => <option key={device.portName} value={device.portName}>{device.portName} · {device.description} · {device.serialNumber}</option>) : <option>No FTDI devices detected</option>}</select>{usb.connected ? <button className="btn btn-outline btn-sm w-full" onClick={() => send({ type: 'disconnectUsb' })}>Disconnect {usb.portName}</button> : <button className="btn btn-primary btn-sm w-full" disabled={!usb.devices?.length || !connected} onClick={() => send({ type: 'connectUsb', portName })}>Connect {portName}</button>}{usb.error && <div className="text-xs text-error">{usb.error}</div>}</div><OutputBadge active={outputs.usb && usb.connected} enabled={outputs.usb} /></section>
      <section className="rounded-xl border border-white/10 bg-[#11141b] p-5"><div className="flex items-start justify-between"><OutputIcon /><input type="checkbox" className="toggle toggle-primary" checked={outputs.sacn} onChange={(event) => toggleOutput('sacn', event.target.checked)} /></div><h2 className="mt-4 font-semibold">sACN / E1.31</h2><p className="mt-1 text-sm text-slate-500">Multicast · Universe {outputStatus.sacn?.universe || 1} · UDP 5568</p><OutputBadge active={outputs.sacn && connected} enabled={outputs.sacn} /></section>
    </div>
    <div className="mt-8"><PageTitle title="Remote Control" subtitle="Control fixtures and groups from network automation systems" /></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <ProtocolCard title="RTP-MIDI" detail={`AppleMIDI · UDP ${protocolStatus.rtpmidi?.controlPort || 5004}/${protocolStatus.rtpmidi?.dataPort || 5005}`} active={protocolStatus.rtpmidi?.enabled} />
      <ProtocolCard title="OSC" detail={`UDP ${protocolStatus.osc?.port || 9000} · /fixture and /group`} active={protocolStatus.osc?.enabled} />
      <ProtocolCard title="TCP JSON" detail={`Port ${protocolStatus.tcpJson?.port || 8082} · JSON Lines`} active={protocolStatus.tcpJson?.enabled} />
      <ProtocolCard title="HTTP API" detail={`Port ${protocolStatus.http?.port || 8080} · POST /api/control`} active={protocolStatus.http?.enabled} />
    </div>
  </>
}

function OutputIcon() { return <div className="grid size-10 place-items-center rounded-lg bg-violet-600/20 text-violet-300"><Radio size={20} /></div> }
function ProtocolCard({ title, detail, active }) { return <section className="rounded-xl border border-white/10 bg-[#11141b] p-4"><div className="flex items-center justify-between"><OutputIcon /><span className={`badge badge-sm badge-outline ${active ? 'badge-success' : 'badge-error'}`}>{active ? 'Listening' : 'Unavailable'}</span></div><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-xs text-slate-500">{detail}</p></section> }
function OutputBadge({ active, enabled }) { return <div className={`badge badge-outline mt-4 ${active ? 'badge-success' : 'badge-ghost'}`}>{active ? 'Sending' : enabled ? 'Waiting' : 'Disabled'}</div> }

function SettingsPage({ settings, setSettings, onSave }) {
  const update = (field, value) => setSettings({ ...settings, [field]: value })
  const updateAutosave = (field, value) => setSettings({ ...settings, autosave: { ...settings.autosave, [field]: value } })
  const autosave = settings.autosave || { enabled: true, intervalMinutes: 5, maxVersions: 20 }
  return <>
    <PageTitle title="Settings" subtitle="Application and engine preferences" />
    <section className="mt-5 max-w-2xl rounded-xl border border-white/10 bg-[#11141b] p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="fieldset-label flex-col items-start gap-2"><span>Project name</span><input className="input w-full" value={settings.projectName} onChange={(event) => update('projectName', event.target.value)} /></label>
        <label className="fieldset-label flex-col items-start gap-2"><span>Output frame rate</span><select className="select w-full" value={settings.frameRate} onChange={(event) => update('frameRate', Number(event.target.value))}><option value={30}>30 fps</option><option value={40}>40 fps</option><option value={44}>44 fps</option></select></label>
        <label className="fieldset-label flex-col items-start gap-2"><span>BPM</span><input type="number" min={20} max={300} className="input w-full" value={settings.bpm} onChange={(event) => update('bpm', Math.max(20, Math.min(300, Number(event.target.value) || 120)))} /></label>
      </div>
      <div className="divider my-6 text-xs text-slate-600">Autosave</div>
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="fieldset-label flex-col items-start gap-2">
          <span>Enable autosave</span>
          <input type="checkbox" className="toggle toggle-primary" checked={autosave.enabled} onChange={(event) => updateAutosave('enabled', event.target.checked)} />
        </label>
        <label className="fieldset-label flex-col items-start gap-2">
          <span>Autosave interval (minutes)</span>
          <input type="number" min={1} max={60} className="input w-full" value={autosave.intervalMinutes} onChange={(event) => updateAutosave('intervalMinutes', Math.max(1, Math.min(60, Number(event.target.value) || 1)))} />
        </label>
        <label className="fieldset-label flex-col items-start gap-2">
          <span>Autosave versions</span>
          <input type="number" min={1} max={100} className="input w-full" value={autosave.maxVersions} onChange={(event) => updateAutosave('maxVersions', Math.max(1, Math.min(100, Number(event.target.value) || 1)))} />
        </label>
      </div>
      <div className="mt-6 flex justify-end"><button className="btn btn-primary btn-sm" onClick={onSave}><Save size={16} /> Save settings</button></div>
    </section>
  </>
}

function PageTitle({ title, subtitle }) {
  return <div><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>
}

function ChannelFader({ channel, value, onChange }) {
  return (
    <div className="flex h-64 flex-col items-center rounded-md border border-white/5 bg-[#171a22] px-1 py-2">
      <span className="text-xs font-semibold text-slate-400">CH {channel}</span>
      <div className="my-3 flex flex-1 items-center">
        <input className="range range-primary range-vertical h-36" type="range" min={0} max={255} value={value} onInput={(event) => onChange(channel, Number(event.target.value))} />
      </div>
      <input className="input input-sm w-full border-white/10 bg-black/20 px-1 text-center font-mono" type="number" min="0" max="255" value={value} onChange={(event) => onChange(channel, Math.max(0, Math.min(255, Number(event.target.value))))} />
      <span className="mt-2 text-[10px] text-slate-600">{Math.round(value / 255 * 100)}%</span>
    </div>
  )
}

function NavButton({ icon: Icon, label, active = false, onClick }) {
  return <button className={`flex w-16 flex-col items-center gap-1 rounded-lg py-3 text-[10px] ${active ? 'bg-violet-600/20 text-violet-300' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`} onClick={onClick}><Icon size={20} />{label}</button>
}

function InfoCard({ title, value, status, muted = false }) {
  return <div className="rounded-xl border border-white/10 bg-[#11141b] p-3"><div className="text-xs uppercase tracking-wider text-slate-500">{title}</div><div className="mt-1 font-medium">{value}</div><div className={`mt-1 text-xs ${muted ? 'text-amber-400' : 'text-emerald-400'}`}>{status}</div></div>
}

export default App

import { useRef, useState } from 'react'
import { Grid3X3, Lock, Unlock } from 'lucide-react'
import fixtureVisualizer from '../../Fixture.Visualizer/Fixture.Visualizer.html?raw'

const fixtureSvg = fixtureVisualizer.match(/<svg[\s\S]*<\/svg>/)?.[0] || ''

export default function FixtureStage({ fixtures, setFixtures, values, selectedId, setSelectedId }) {
  const [locked, updateLocked] = useState(() => localStorage.getItem('lightcontroller.stageLocked') !== 'false')
  const setLocked = (value) => { localStorage.setItem('lightcontroller.stageLocked', String(value)); updateLocked(value) }
  return <StageContent fixtures={fixtures} setFixtures={setFixtures} values={values} selectedId={selectedId} setSelectedId={setSelectedId} locked={locked} setLocked={setLocked} />
}

function StageContent({ fixtures, setFixtures, values, selectedId, setSelectedId, locked, setLocked }) {
  const [stageHeight, setStageHeight] = useState(() => Number(localStorage.getItem('lightcontroller.stageHeight')) || 288)
  const resizeStart = useRef(null)
  const resize = (event) => {
    if (!resizeStart.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const height = Math.max(160, Math.min(window.innerHeight * 0.7, resizeStart.current.height + event.clientY - resizeStart.current.y))
    setStageHeight(height)
    localStorage.setItem('lightcontroller.stageHeight', String(height))
  }
  const move = (event, fixture) => {
    if (locked) return
    const stage = event.currentTarget.parentElement.getBoundingClientRect()
    const x = Math.max(3, Math.min(97, (event.clientX - stage.left) / stage.width * 100))
    const y = Math.max(5, Math.min(95, (event.clientY - stage.top) / stage.height * 100))
    setFixtures(fixtures.map((item) => item.id === fixture.id ? { ...item, stagePosition: { x, y } } : item))
  }
  return <section className="overflow-hidden rounded-xl border border-white/10 bg-[#11141b]"><header className="flex items-center justify-between border-b border-white/10 px-3 py-2"><div className="flex items-baseline gap-2"><h2 className="text-sm font-medium">Stage</h2><p className="text-[11px] text-slate-500">Select a fixture to edit its live parameters</p></div><button className={`btn btn-xs ${locked ? 'btn-ghost' : 'btn-warning btn-outline'}`} onClick={() => setLocked(!locked)}>{locked ? <Lock size={13} /> : <Unlock size={13} />}{locked ? 'Locked' : 'Editing layout'}</button></header><div className="relative min-h-40 max-h-[70vh] overflow-hidden bg-[radial-gradient(circle_at_center,rgba(124,58,237,.08),transparent_60%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px]" style={{ height: stageHeight }}>
    <div className="absolute inset-x-0 top-0 h-5 bg-white/5 text-center text-[10px] uppercase tracking-[.3em] text-slate-600">Upstage</div>
    {fixtures.length === 0 && <div className="absolute inset-0 grid place-items-center text-center text-slate-500"><div><Grid3X3 className="mx-auto mb-2" /><p>Patch fixtures from the OFL library</p></div></div>}
    {fixtures.map((fixture, index) => { const position = fixture.stagePosition || defaultPosition(index, fixtures.length); const active = selectedId === fixture.id; return <button key={fixture.id} className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 ${locked ? 'cursor-pointer' : 'cursor-move'}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} onClick={() => setSelectedId(fixture.id)} onPointerDown={(event) => { if (!locked) event.currentTarget.setPointerCapture(event.pointerId); setSelectedId(fixture.id) }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event, fixture) }}><FixtureGlyph fixture={fixture} values={values} active={active} /><span className={`max-w-24 truncate rounded px-1.5 py-0.5 text-[10px] ${active ? 'bg-primary text-primary-content' : 'bg-black/60 text-slate-400'}`}>{fixture.name}</span></button> })}
    <div className="absolute inset-x-0 bottom-0 h-5 bg-white/5 text-center text-[10px] uppercase tracking-[.3em] text-slate-600">Audience</div>
    <div className="group absolute inset-x-0 bottom-0 z-20 flex h-2 cursor-ns-resize touch-none items-end" title="Drag to resize stage" onPointerDown={(event) => { resizeStart.current = { y: event.clientY, height: stageHeight }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={resize} onPointerUp={(event) => { resizeStart.current = null; event.currentTarget.releasePointerCapture(event.pointerId) }}><div className="h-0.5 w-full bg-white/10 transition-colors group-hover:bg-primary group-active:bg-primary" /></div>
  </div></section>
}

function FixtureGlyph({ fixture, values, active }) {
  const model = `${fixture.model || ''} ${fixture.name || ''}`.toLowerCase()
  const moving = model.includes('zq02577') || fixture.type?.toLowerCase().includes('moving')
  const body = moving ? 'moving' : 'fixed'
  const light = model.includes('zq02577') ? 'led6' : model.includes('lpc008s') ? 'led54' : model.includes('wash') ? 'wash' : model.includes('spot') ? 'spot' : 'spot'
  const red = channelValue(fixture, values, 'Red')
  const green = channelValue(fixture, values, 'Green')
  const blue = channelValue(fixture, values, 'Blue')
  const white = channelValue(fixture, values, 'White')
  const intensityChannel = fixture.channels.some((channel) => channel.kind === 'Intensity')
  const intensity = intensityChannel ? channelValue(fixture, values, 'Intensity') / 255 : 1
  const hasColor = fixture.channels.some((channel) => ['Red', 'Green', 'Blue', 'White'].includes(channel.kind))
  const color = hasColor ? `rgb(${Math.round(Math.min(255, red + white) * intensity)}, ${Math.round(Math.min(255, green + white) * intensity)}, ${Math.round(Math.min(255, blue + white) * intensity)})` : `rgb(${Math.round(intensity * 255)}, ${Math.round(intensity * 255)}, ${Math.round(intensity * 255)})`
  const pan = channelValue(fixture, values, 'Pan')
  const panDegrees = moving ? (pan / 255 - 0.5) * 360 : 0
  const gradientId = `wash-gradient-${String(fixture.id).replace(/[^a-z0-9_-]/gi, '')}`
  const artwork = fixtureSvg
    .replace('id="fixture"', `id="fixture-${fixture.id}" style="--light:${color};--base:${active ? '#c4b5fd' : '#ffffff'};--bg:${active ? '#4c1d95' : '#292929'}"`)
    .replaceAll('wash-gradient', gradientId)
    .replace(`<g class="${body}">`, `<g class="${body}" style="display:block">`)
    .replace(`<g class="${light}">`, `<g class="${light}" style="display:block">`)
  return <div className={`size-12 rounded-full border-2 transition ${active ? 'border-primary shadow-lg shadow-primary/30' : 'border-slate-600'}`} style={{ transform: `rotate(${panDegrees}deg)`, transition: 'transform 40ms linear' }} dangerouslySetInnerHTML={{ __html: artwork }} />
}

function channelValue(fixture, values, kind) {
  const channel = fixture.channels.find((item) => item.kind === kind && !item.name.toLowerCase().includes('fine'))
  return channel ? values[fixture.address + channel.offset - 1] ?? channel.defaultValue ?? 0 : 0
}

function defaultPosition(index, count) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(1, Math.ceil(count / columns))
  return { x: (index % columns + 1) / (columns + 1) * 100, y: (Math.floor(index / columns) + 1) / (rows + 1) * 100 }
}

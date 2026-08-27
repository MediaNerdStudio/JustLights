import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Dice5, Lightbulb, Palette, Plus, Sparkles, Trash2, Waves, Zap } from 'lucide-react'
import { colorEffectPresets, colorEffectTypes, fixtureOrders } from './colorEffectPresets.js'
import { positionEffectPresets, positionEffectTypes } from './positionEffectPresets.js'
import { dimmerEffectPresets, dimmerEffectTypes, beatMultipliers, dimmerFields } from './dimmerEffectPresets.js'

const colorKinds = ['Red', 'Green', 'Blue']
const specialKinds = ['White', 'Amber', 'UV']
const colorPresets = ['#000000', '#ff0000', '#ff7a00', '#ffd500', '#00d26a', '#00b7ff', '#3155ff', '#9d36ff', '#ff2d95', '#ffffff']
const effectPresets = [
  { name: 'Dimmer wave', effects: [{ type: 'wave', waveform: 'sine', speed: 0.7, depth: 100, offset: 70, randomize: 0 }] },
  { name: 'Police', effects: [{ type: 'police', waveform: 'square', speed: 2.5, depth: 100, offset: 100, randomize: 0 }] },
  { name: 'Strobe', effects: [{ type: 'strobe', waveform: 'square', speed: 4, depth: 100, offset: 0, randomize: 0 }] },
  { name: 'Twinkle', effects: [{ type: 'twinkle', waveform: 'steps', speed: 5, depth: 100, offset: 0, randomize: 100 }] },
  { name: 'Disco', effects: [{ type: 'disco', waveform: 'steps', speed: 3, depth: 100, offset: 0, randomize: 100 }] },
  { name: 'Rainbow', effects: [{ type: 'color', waveform: 'rainbow', speed: 0.12, depth: 100, offset: 0, randomize: 0 }] },
  { name: 'Party', effects: [{ type: 'strobe', waveform: 'square', speed: 3, depth: 100, offset: 0, randomize: 20 }, { type: 'disco', waveform: 'steps', speed: 3, depth: 100, offset: 0, randomize: 100 }] },
]

export default function FixtureControls({ fixtures, groups, values, setChannel, send, selectedId, setSelectedId, effects, setEffects }) {
  const [targetType, setTargetType] = useState('fixture')
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || '')
  const [bundleColors, setBundleColors] = useState(true)
  const fixture = fixtures.find((item) => item.id === selectedId) || fixtures[0]
  const group = groups.find((item) => item.id === selectedGroupId) || groups[0]
  const targets = useMemo(() => targetType === 'group' ? fixtures.filter((item) => group?.fixtureIds.includes(item.id)) : fixture ? [fixture] : [], [targetType, fixtures, group, fixture])
  const controlFixture = targetType === 'group' ? targets[0] || fixture : fixture
  const controls = useMemo(() => groupChannels(controlFixture), [controlFixture])
  const activeTargetId = targetType === 'group' ? group?.id || '' : fixture?.id || ''
  const scopedEffects = effects.filter((effect) => effect.targetType === targetType && effect.targetId === activeTargetId)
  const setScopedEffects = (nextEffects) => setEffects((current) => [...current.filter((effect) => effect.targetType !== targetType || effect.targetId !== activeTargetId), ...nextEffects.map((effect) => ({ ...effect, targetType, targetId: activeTargetId }))])
  const sendRef = useRef(send)
  sendRef.current = send

  useEffect(() => {
    if (fixture && effects.some((effect) => !effect.targetType || !effect.targetId))
      setEffects(effects.map((effect) => effect.targetType && effect.targetId ? effect : { ...effect, targetType: 'fixture', targetId: fixture.id }))
  }, [effects, fixture, setEffects])
  useEffect(() => {
    sendRef.current({ type: 'effects:set', effects: effects.map((effect) => ({ ...effect, targets: effectTargets(resolveEffectFixtures(effect, fixtures, groups), effect.fixtureOrder) })) })
  }, [effects, fixtures, groups])

  if (!fixture) return <section className="rounded-xl border border-white/10 bg-[#11141b] p-5 text-center text-slate-500">Patch a fixture from the OFL library to enable fixture controls.</section>

  const channelValue = (channel) => values[controlFixture.address + channel.offset - 1] ?? channel.defaultValue ?? 0
  const writeKind = (kind, value) => targets.forEach((target) => channelsByKind(target, kind).forEach((channel, index) => { if (bundleColors || index === 0 || !colorKinds.includes(kind)) setChannel(target.address + channel.offset, value) }))
  const writePrimary = (channel, value) => targets.forEach((target) => { const match = channelsByKind(target, channel.kind)[0]; if (match) setChannel(target.address + match.offset, value) })
  const rgb = colorKinds.map((kind) => controls.byKind[kind]?.[0] ? channelValue(controls.byKind[kind][0]) : 0)
  const setColor = (hex) => { const [red, green, blue] = hexToRgb(hex); writeKind('Red', red); writeKind('Green', green); writeKind('Blue', blue) }

  return <section className="overflow-hidden rounded-xl border border-white/10 bg-[#11141b]">
    <header className="flex flex-wrap items-end justify-between gap-2 border-b border-white/10 px-2"><div role="tablist" className="tabs tabs-border"><button role="tab" className={`tab ${targetType === 'fixture' ? 'tab-active' : ''}`} onClick={() => setTargetType('fixture')}>Fixtures</button><button role="tab" className={`tab ${targetType === 'group' ? 'tab-active' : ''}`} disabled={!groups.length} onClick={() => setTargetType('group')}>Groups</button></div><div className="flex items-center gap-2 py-1"><span className="whitespace-nowrap text-[11px] text-slate-500">{targets.length} fixture{targets.length === 1 ? '' : 's'}</span>{targetType === 'fixture' ? <select className="select select-xs min-w-52" value={fixture.id} onChange={(event) => setSelectedId(event.target.value)}>{fixtures.map((item) => <option key={item.id} value={item.id}>{item.name} · A{item.address}</option>)}</select> : <select className="select select-xs min-w-52" value={group?.id || ''} onChange={(event) => setSelectedGroupId(event.target.value)}>{groups.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.fixtureIds.length} fixtures</option>)}</select>}</div></header>
    <div className="grid xl:grid-cols-[1fr_310px]">
      <div className="min-w-0 p-2"><div className="flex flex-wrap items-stretch gap-2">
        {controls.pan && controls.tilt && <PositionControl pan={channelValue(controls.pan)} tilt={channelValue(controls.tilt)} onChange={(pan, tilt) => { writePrimary(controls.pan, pan); writePrimary(controls.tilt, tilt) }} />}
        {controls.dimmer && <VerticalControl icon={Lightbulb} label="Dimmer" value={channelValue(controls.dimmer)} onChange={(value) => writePrimary(controls.dimmer, value)} />}
        {controls.hasRgb && <ColorControl rgb={rgb} bundle={bundleColors} setBundle={setBundleColors} onColor={setColor} onKind={(kind, value) => writeKind(kind, value)} />}
        {controls.special.map((channel) => <VerticalControl key={channel.id} icon={Sparkles} label={channel.kind} value={channelValue(channel)} onChange={(value) => writePrimary(channel, value)} />)}
        {controls.strobe && <VerticalControl icon={Zap} label="Strobe" value={channelValue(controls.strobe)} onChange={(value) => writePrimary(controls.strobe, value)} />}
        {controls.macros.map((channel) => <MacroControl key={channel.id} channel={channel} value={channelValue(channel)} onChange={(value) => writePrimary(channel, value)} />)}
        {controls.other.map((channel) => <VerticalControl key={channel.id} label={channel.name} value={channelValue(channel)} onChange={(value) => writePrimary(channel, value)} />)}
      </div></div>
      <EffectsPanel effects={scopedEffects} setEffects={setScopedEffects} targetName={targetType === 'group' ? group?.name : fixture.name} />
    </div>
  </section>
}

function PositionControl({ pan, tilt, onChange }) {
  const update = (event) => { const rect = event.currentTarget.getBoundingClientRect(); onChange(Math.round((event.clientX - rect.left) / rect.width * 255), Math.round((event.clientY - rect.top) / rect.height * 255)) }
  return <div className="w-44 rounded-lg bg-black/20 p-2"><Label icon={Crosshair} text="Position" /><div className="relative mt-2 h-32 touch-none cursor-crosshair rounded-md border border-white/10 bg-[linear-gradient(to_right,transparent_49%,rgba(255,255,255,.1)_50%,transparent_51%),linear-gradient(to_bottom,transparent_49%,rgba(255,255,255,.1)_50%,transparent_51%)]" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); update(event) }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event) }}><i className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary" style={{ left: `${pan / 255 * 100}%`, top: `${tilt / 255 * 100}%` }} /></div><div className="mt-2 grid grid-cols-2 gap-2 text-center font-mono text-[10px] tabular-nums text-slate-400"><span>P {String(pan).padStart(3, '0')}</span><span>T {String(tilt).padStart(3, '0')}</span></div></div>
}

function VerticalControl({ icon, label, value, onChange }) {
  return <div className="flex w-20 flex-col items-center rounded-lg bg-black/20 p-2"><Label icon={icon} text={label} /><input type="range" className="range range-primary range-vertical my-2 h-32" min={0} max={255} value={value} onInput={(event) => onChange(Number(event.target.value))} /><Value value={value} /></div>
}

function ColorControl({ rgb, bundle, setBundle, onColor, onKind }) {
  return <div className="w-64 rounded-lg bg-black/20 p-2"><div className="flex items-center justify-between"><Label icon={Palette} text="Color" /><label className="flex items-center gap-1 text-[9px] text-slate-500"><input type="checkbox" className="checkbox checkbox-xs" checked={bundle} onChange={(event) => setBundle(event.target.checked)} />Bundle</label></div><div className="mt-2 flex gap-3"><ColorWheel color={rgbToHex(rgb)} onChange={onColor} /><div className="flex gap-2">{colorKinds.map((kind, index) => <div key={kind} className="flex flex-col items-center"><input type="range" className="range range-xs range-vertical h-24" min={0} max={255} value={rgb[index]} onInput={(event) => onKind(kind, Number(event.target.value))} /><span className="mt-1 text-[9px]" style={{ color: kind.toLowerCase() }}>{kind[0]}</span><Value value={rgb[index]} small /></div>)}</div></div><div className="mt-2 grid grid-cols-10 gap-1">{colorPresets.map((color) => <button key={color} className="aspect-square rounded-sm border border-white/10" style={{ backgroundColor: color }} title={color} onClick={() => onColor(color)} />)}</div></div>
}

function ColorWheel({ color, onChange }) {
  const update = (event) => { const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left - rect.width / 2; const y = event.clientY - rect.top - rect.height / 2; const saturation = Math.min(1, Math.hypot(x, y) / (rect.width / 2)); const hue = (Math.atan2(y, x) * 180 / Math.PI + 450) % 360; onChange(rgbToHex(hsvToRgb(hue, saturation, 1))) }
  return <button className="relative size-28 shrink-0 touch-none rounded-full border border-white/20" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%), conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); update(event) }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event) }}><i className="absolute bottom-1 left-1 rounded bg-black/60 px-1 font-mono text-[8px] text-white">{color}</i></button>
}

function MacroControl({ channel, value, onChange }) {
  const ranges = channel.capabilities?.length ? channel.capabilities : Array.from({ length: 8 }, (_, index) => ({ from: index * 32, to: index === 7 ? 255 : index * 32 + 31, description: `Step ${index + 1}` }))
  const current = Math.max(0, ranges.findIndex((range) => value >= range.from && value <= range.to)); const range = ranges[current] || ranges[0]
  return <div className="w-44 rounded-lg bg-black/20 p-2"><Label icon={Sparkles} text={channel.name} /><select className="select select-xs mt-2 w-full" value={current} onChange={(event) => onChange(ranges[Number(event.target.value)].from)}>{ranges.map((item, index) => <option key={index} value={index}>{item.description || `Step ${index + 1}`}</option>)}</select><input type="range" className="range range-xs mt-4 w-full" min={range.from} max={range.to} value={value} onInput={(event) => onChange(Number(event.target.value))} /><div className="mt-3"><Value value={value} /></div></div>
}

function EffectsPanel({ effects, setEffects, targetName }) {
  const generators = [
    { label: 'Circle', type: 'positionEffect', positionType: 'Circle', icon: Waves },
    { label: 'Figure eight', type: 'positionEffect', positionType: 'Figure eight', icon: Waves },
    { label: 'Light pulse', type: 'light', waveform: 'sine', icon: Lightbulb },
    { label: 'Wave', type: 'wave', waveform: 'sine', icon: Waves },
    { label: 'Rainbow', type: 'color', waveform: 'rainbow', icon: Palette },
    { label: 'Police', type: 'police', waveform: 'square', icon: Zap },
    { label: 'Strobe', type: 'strobe', waveform: 'square', icon: Zap },
    { label: 'Twinkle', type: 'twinkle', waveform: 'steps', icon: Sparkles },
    { label: 'Disco', type: 'disco', waveform: 'steps', icon: Dice5 },
    { label: 'Random steps', type: 'random', waveform: 'steps', icon: Dice5 },
    { label: 'Color effect', type: 'colorEffect', waveform: 'Chase', icon: Palette },
    { label: 'Dimmer effect', type: 'dimmerEffect', waveform: 'sine', icon: Lightbulb },
    { label: 'Position effect', type: 'positionEffect', waveform: 'Triangle', icon: Crosshair },
  ]
  const addEffect = (generator) => setEffects([...effects, generator.type === 'colorEffect' ? { id: crypto.randomUUID(), type: 'colorEffect', colorType: 'Chase', duration: 3, colors: ['#000000', '#ff0000'], fixtureOrder: 'Left to Right', stepsPerSample: 1, phase: 0, timeOffset: 100, delay: 0, smoothness: 0, offset: 0, randomize: 0 } : generator.type === 'dimmerEffect' ? { id: crypto.randomUUID(), type: 'dimmerEffect', dimmerType: 'Yo-yo', duration: 2, colors: ['#000000', '#ffffff'], fixtureOrder: 'Left to Right', phase: 0, center: 50, steepness: 50, offset: 0, randomize: 0 } : generator.type === 'positionEffect' ? { id: crypto.randomUUID(), type: 'positionEffect', positionType: generator.positionType || 'Triangle', duration: 4, fixtureOrder: 'Left to Right', mirrorPan: false, mirrorTilt: false, relative: false, timeOffset: 0, panOffset: 0, tiltOffset: 0, width: 70, height: 70 } : { id: crypto.randomUUID(), type: generator.type, waveform: generator.waveform, ...(generator.type === 'motion' ? { duration: 5 } : { speed: 1 }), depth: 100, offset: 0, randomize: 0 }])
  const update = (id, field, value) => setEffects(effects.map((effect) => effect.id === id ? { ...effect, [field]: value } : effect))
  const addPreset = (preset) => setEffects([...effects, ...preset.effects.map((effect) => ({ ...effect, id: crypto.randomUUID() }))])
  const slider = (effect, field, label, min, max, step = 1) => { const duration = effect.type === 'motion' && field === 'speed'; const key = duration ? 'duration' : field; const value = effect[key] ?? (duration ? 5 : 0); return <><span>{duration ? 'Duration' : label}</span><input type="range" className="range range-xs" min={duration ? 0.5 : min} max={duration ? 30 : max} step={duration ? 0.5 : step} value={value} onInput={(event) => update(effect.id, key, Number(event.target.value))} /><span className="text-right tabular-nums">{key === 'speed' || key === 'duration' ? Number(value).toFixed(1) : Math.round(value)}</span></> }
  return <aside className="border-t border-white/10 bg-black/10 p-2 xl:border-t-0 xl:border-l"><div className="mb-2 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Effect generators</h3><p className="text-[10px] text-slate-500">Target: {targetName}</p></div><div className="dropdown dropdown-end"><button tabIndex={0} className="btn btn-primary btn-xs"><Plus size={12} /> Add</button><ul tabIndex={0} className="dropdown-content menu z-10 mt-1 max-h-72 w-44 overflow-y-auto rounded-box bg-base-300 p-2 shadow">{generators.map((generator) => { const Icon = generator.icon; return <li key={generator.label}><button onClick={() => addEffect(generator)}><Icon size={13} />{generator.label}</button></li> })}</ul></div></div><select className="select select-xs mb-2 w-full" defaultValue="" onChange={(event) => { const preset = [...effectPresets, ...colorEffectPresets, ...positionEffectPresets, ...dimmerEffectPresets].find((item) => item.name === event.target.value); if (preset) addPreset(preset); event.target.value = '' }}><option value="">Add effect preset…</option><optgroup label="Color effects">{[...effectPresets.filter((preset) => !preset.effects.every((effect) => effect.type === 'motion')), ...colorEffectPresets].map((preset, index) => <option key={`${preset.name}-${index}`}>{preset.name}</option>)}</optgroup><optgroup label="Position effects">{[...effectPresets.filter((preset) => preset.effects.every((effect) => effect.type === 'motion')), ...positionEffectPresets].map((preset, index) => <option key={`${preset.name}-${index}`}>{preset.name}</option>)}</optgroup><optgroup label="Dimmer effects">{dimmerEffectPresets.map((preset, index) => <option key={`${preset.name}-${index}`}>{preset.name}</option>)}</optgroup></select><div className="max-h-80 space-y-2 overflow-y-auto">{effects.map((effect) => <div key={effect.id} className="rounded-md border border-white/10 p-2"><div className="flex items-center justify-between"><span className="text-xs font-medium capitalize">{effect.type === 'colorEffect' ? `Color · ${effect.colorType}` : effect.type === 'positionEffect' ? `Position · ${effect.positionType}` : effect.type === 'dimmerEffect' ? `Dimmer · ${effect.dimmerType}` : `${effect.type} · ${effect.waveform}`}</span><button className="btn btn-ghost btn-square btn-xs text-error" onClick={() => setEffects(effects.filter((item) => item.id !== effect.id))}><Trash2 size={12} /></button></div>{effect.type === 'colorEffect' ? <ColorEffectEditor effect={effect} update={update} /> : effect.type === 'dimmerEffect' ? <DimmerEffectEditor effect={effect} update={update} /> : effect.type === 'positionEffect' ? <PositionEffectEditor effect={effect} update={update} /> : <div className="mt-2 grid grid-cols-[48px_1fr_30px] items-center gap-1 text-[9px] text-slate-500">{slider(effect, 'speed', 'Speed', 0.05, 8, 0.05)}{slider(effect, 'depth', 'Depth', 0, 100)}{slider(effect, 'offset', 'Offset', 0, 100)}{slider(effect, 'randomize', 'Random', 0, 100)}</div>}</div>)}</div>{effects.length > 0 && <button className="btn btn-ghost btn-xs mt-2 w-full" onClick={() => setEffects([])}>Clear effects</button>}</aside>
}

function DimmerEffectEditor({ effect, update }) {
  const isCurve = effect.dimmerType === 'Curve'
  const fields = isCurve ? [] : (dimmerFields[effect.dimmerType] || [])
  const setColor = (index, value) => update(effect.id, 'colors', effect.colors.map((color, colorIndex) => colorIndex === index ? value : color))
  const toggleBeat = () => update(effect.id, 'beatMultiplier', effect.beatMultiplier ? undefined : 'x1')
  const range = (key, label, min, max, suffix = '') => <label key={key} className="grid grid-cols-[58px_1fr_28px] items-center gap-1"><span>{label}</span><input type="range" className="range range-xs" min={min} max={max} value={effect[key] ?? 0} onInput={(event) => update(effect.id, key, Number(event.target.value))} /><span className="text-right tabular-nums">{effect[key] ?? 0}{suffix}</span></label>
  const fieldSlider = (field) => range(field.key, field.label, field.min, field.max, field.max === 100 && field.min === 0 ? '%' : '')
  return <div className="mt-2 space-y-2 text-[9px] text-slate-500">
    <div className="grid grid-cols-2 gap-1">
      <select className="select select-xs" value={effect.dimmerType} onChange={(event) => update(effect.id, 'dimmerType', event.target.value)}>{dimmerEffectTypes.map((type) => <option key={type}>{type}</option>)}</select>
      <select className="select select-xs" value={effect.fixtureOrder || fixtureOrders[0]} onChange={(event) => update(effect.id, 'fixtureOrder', event.target.value)}>{fixtureOrders.map((order) => <option key={order}>{order}</option>)}</select>
    </div>
    <label className="flex items-center justify-between"><span>Sync to beat</span><input type="checkbox" className="checkbox checkbox-xs" checked={!!effect.beatMultiplier} onChange={toggleBeat} /></label>
    {effect.beatMultiplier ? <label className="grid grid-cols-[58px_1fr] items-center gap-1"><span>Beat</span><select className="select select-xs" value={effect.beatMultiplier} onChange={(event) => update(effect.id, 'beatMultiplier', event.target.value)}>{beatMultipliers.map((value) => <option key={value}>{value}</option>)}</select></label> : <label className="grid grid-cols-[58px_1fr] items-center gap-1"><span>Duration</span><input className="input input-xs" type="number" min={0.1} step={0.1} value={effect.duration ?? 1} onChange={(event) => update(effect.id, 'duration', Number(event.target.value))} /></label>}
    {!isCurve && <div className="flex flex-wrap gap-1">{(effect.colors || []).map((color, index) => <input key={index} type="color" className="size-6 rounded" value={color} onChange={(event) => setColor(index, event.target.value)} />)}<button className="btn btn-ghost btn-xs" onClick={() => update(effect.id, 'colors', [...(effect.colors || []), '#ffffff'])}><Plus size={10} /></button></div>}
    {isCurve && range('timeOffset', 'Time offset', 0, 100, '%')}
    {fields.map((field) => field.kind === 'boolean' ? null : field.kind === 'select' ? null : fieldSlider(field))}
  </div>
}

function PositionEffectEditor({ effect, update }) {
  const range = (key, label, min, max, suffix = '') => <label className="grid grid-cols-[62px_1fr_38px] items-center gap-1"><span>{label}</span><input type="range" className="range range-xs" min={min} max={max} value={effect[key] ?? 0} onInput={(event) => update(effect.id, key, Number(event.target.value))} /><span className="text-right tabular-nums">{effect[key] ?? 0}{suffix}</span></label>
  const toggle = (key, label) => <label className="flex items-center justify-between"><span>{label}</span><input type="checkbox" className="checkbox checkbox-xs" checked={effect[key] ?? false} onChange={(event) => update(effect.id, key, event.target.checked)} /></label>
  return <div className="mt-2 space-y-2 text-[9px] text-slate-500"><div className="grid grid-cols-2 gap-1"><select className="select select-xs" value={effect.positionType} onChange={(event) => update(effect.id, 'positionType', event.target.value)}>{positionEffectTypes.map((type) => <option key={type}>{type}</option>)}</select><select className="select select-xs" value={effect.fixtureOrder || fixtureOrders[0]} onChange={(event) => update(effect.id, 'fixtureOrder', event.target.value)}>{fixtureOrders.map((order) => <option key={order}>{order}</option>)}</select></div><label className="grid grid-cols-[62px_1fr] items-center gap-1"><span>Duration</span><input className="input input-xs" type="number" min={0.1} step={0.1} value={effect.duration ?? 4} onChange={(event) => update(effect.id, 'duration', Number(event.target.value))} /></label><div className="grid grid-cols-3 gap-2">{toggle('mirrorPan', 'Mirror pan')}{toggle('mirrorTilt', 'Mirror tilt')}{toggle('relative', 'Relative')}</div>{range('timeOffset', 'Time offset', 0, 100, '%')}{range('panOffset', 'Pan offset', -180, 180, '°')}{range('tiltOffset', 'Tilt offset', -180, 180, '°')}{range('width', 'Width', 0, 100, '%')}{range('height', 'Height', 0, 100, '%')}{['Zig Zag', 'Flower', 'Half Flower'].includes(effect.positionType) && range(effect.positionType === 'Zig Zag' ? 'count' : 'petals', effect.positionType === 'Zig Zag' ? 'Zigs' : 'Petals', 1, 10)}</div>
}

function ColorEffectEditor({ effect, update }) {
  const fields = colorFields[effect.colorType] || []
  const setColor = (index, value) => update(effect.id, 'colors', effect.colors.map((color, colorIndex) => colorIndex === index ? value : color))
  return <div className="mt-2 space-y-2 text-[9px] text-slate-500"><div className="grid grid-cols-2 gap-1"><select className="select select-xs" value={effect.colorType} onChange={(event) => update(effect.id, 'colorType', event.target.value)}>{colorEffectTypes.map((type) => <option key={type}>{type}</option>)}</select><select className="select select-xs" value={effect.fixtureOrder || fixtureOrders[0]} onChange={(event) => update(effect.id, 'fixtureOrder', event.target.value)}>{fixtureOrders.map((order) => <option key={order}>{order}</option>)}</select></div><label className="grid grid-cols-[58px_1fr] items-center gap-1"><span>Duration</span><input className="input input-xs" type="number" min={0} step={0.1} value={effect.duration ?? 0} onChange={(event) => update(effect.id, 'duration', Number(event.target.value))} /></label><div className="flex flex-wrap gap-1">{(effect.colors || []).map((color, index) => <input key={index} type="color" className="size-6 rounded" value={color} onChange={(event) => setColor(index, event.target.value)} />)}<button className="btn btn-ghost btn-xs" onClick={() => update(effect.id, 'colors', [...(effect.colors || []), '#ffffff'])}><Plus size={10} /></button></div>{fields.map((field) => field.kind === 'boolean' ? <label key={field.key} className="flex items-center justify-between"><span>{field.label}</span><input type="checkbox" className="checkbox checkbox-xs" checked={effect[field.key] ?? false} onChange={(event) => update(effect.id, field.key, event.target.checked)} /></label> : field.kind === 'select' ? <label key={field.key} className="grid grid-cols-[58px_1fr] items-center gap-1"><span>{field.label}</span><select className="select select-xs" value={effect[field.key] ?? field.options[0]} onChange={(event) => update(effect.id, field.key, event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select></label> : <label key={field.key} className="grid grid-cols-[58px_1fr_28px] items-center gap-1"><span>{field.label}</span><input type="range" className="range range-xs" min={field.min ?? 0} max={field.max ?? 100} step={field.step ?? 1} value={effect[field.key] ?? field.default ?? 0} onInput={(event) => update(effect.id, field.key, Number(event.target.value))} /><span className="text-right tabular-nums">{effect[field.key] ?? field.default ?? 0}</span></label>)}</div>
}

const percent = (key, label, defaultValue = 0) => ({ key, label, default: defaultValue })
const number = (key, label, min = 0, max = 40, defaultValue = 1) => ({ key, label, min, max, default: defaultValue })
const colorFields = {
  Chase: [number('stepsPerSample', 'Steps', 1, 20, 1), percent('phase', 'Phase'), percent('timeOffset', 'Offset', 100), percent('delay', 'Delay'), percent('smoothness', 'Smooth')],
  Scanner: [number('length', 'Length'), number('overshoot', 'Overshoot'), percent('phase', 'Phase'), percent('fringe', 'Fringe'), percent('noise', 'Noise')],
  'Yo-yo': [percent('phase', 'Phase'), percent('center', 'Center', 50), percent('steepness', 'Steep', 50)],
  Fill: [],
  Rain: [number('length', 'Length'), number('distance', 'Distance'), percent('phase', 'Phase'), percent('fringe', 'Fringe'), percent('noise', 'Noise')],
  Meteor: [number('length', 'Length'), number('distance', 'Distance'), percent('phase', 'Phase'), percent('trail', 'Trail'), { key: 'usePalette', label: 'Palette', kind: 'boolean' }],
  Sparkle: [number('interval', 'Interval', 0.05, 5, 0.2), number('lifetime', 'Lifetime', 0.05, 5, 1), percent('fringe', 'Fringe'), percent('noise', 'Noise'), { key: 'usePalette', label: 'Palette', kind: 'boolean' }],
  Fire: [percent('speed', 'Speed', 50), percent('sparking', 'Sparking', 50), percent('cooling', 'Cooling', 50)],
  Jellyfish: [number('count', 'Count', 1, 50, 10), percent('size', 'Size', 50), percent('speed', 'Speed', 50), percent('fringe', 'Fringe', 50), { key: 'usePalette', label: 'Palette', kind: 'boolean' }],
  Snakes: [number('lengthMin', 'Len min'), number('lengthMax', 'Len max'), number('distanceMin', 'Gap min'), number('distanceMax', 'Gap max'), percent('speed', 'Speed', 50), percent('fringe', 'Fringe'), percent('noise', 'Noise')],
  Curves: [{ key: 'curveMode', label: 'Mode', kind: 'select', options: ['HSB', 'RGB', 'CMY'] }, { key: 'hueTemplate', label: 'Template', kind: 'select', options: ['Constant', 'Ramp', 'Trapezoid', 'Sine', 'Square', 'Ramp Up', 'Ramp Down', 'Curve up', 'Curve Down', 'Bathtub', 'Bathtub Angled', 'Oscillation', 'Bump', '2 Bumps', '3 Bumps', '4 Bumps'] }, number('hueStart', 'Hue start', 0, 360), number('hueEnd', 'Hue end', 0, 360, 360), percent('saturation', 'Saturation', 100), percent('brightness', 'Brightness', 100), percent('white', 'White'), percent('timeOffset', 'Offset')],
}

function resolveEffectFixtures(effect, fixtures, groups) {
  if (effect.targetType === 'group') {
    const group = groups.find((item) => item.id === effect.targetId)
    return fixtures.filter((fixture) => group?.fixtureIds.includes(fixture.id))
  }
  const fixture = fixtures.find((item) => item.id === effect.targetId)
  return fixture ? [fixture] : []
}

function effectTargets(targets, order = fixtureOrders[0]) {
  const sorted = [...targets]
  const x = (fixture) => fixture.stagePosition?.x ?? fixture.address
  const y = (fixture) => fixture.stagePosition?.y ?? fixture.address
  if (order === 'Left to Right') sorted.sort((a, b) => x(a) - x(b))
  if (order === 'Right to Left') sorted.sort((a, b) => x(b) - x(a))
  if (order === 'Top to Bottom') sorted.sort((a, b) => y(a) - y(b))
  if (order === 'Bottom to Top') sorted.sort((a, b) => y(b) - y(a))
  if (order === 'By Address, Ascending') sorted.sort((a, b) => a.address - b.address)
  if (order === 'By Address, Descending') sorted.sort((a, b) => b.address - a.address)
  if (order.startsWith('Random')) sorted.sort((a, b) => stableHash(a.id) - stableHash(b.id))
  return sorted.map((target) => ({ fixtureId: target.id, channels: Object.fromEntries(['Pan', 'Tilt', 'Intensity', 'Red', 'Green', 'Blue', 'White'].map((kind) => [kind, channelsByKind(target, kind).map((channel) => target.address + channel.offset)])) }))
}
function stableHash(value) { return [...value].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0) }

function channelsByKind(fixture, kind) { return fixture.channels.filter((channel) => channel.kind === kind && !channel.name.toLowerCase().includes('fine')) }
function groupChannels(fixture) { const channels = fixture?.channels || []; const byKind = channels.reduce((result, channel) => { (result[channel.kind] ||= []).push(channel); return result }, {}); const used = new Set(); const first = (kind) => { const channel = byKind[kind]?.find((item) => !item.name.toLowerCase().includes('fine')) || byKind[kind]?.[0]; if (channel) used.add(channel.id); return channel }; const pan = first('Pan'); const tilt = first('Tilt'); const dimmer = first('Intensity'); const strobe = first('Strobe'); colorKinds.forEach((kind) => byKind[kind]?.forEach((channel) => used.add(channel.id))); const special = specialKinds.flatMap((kind) => byKind[kind] || []); special.forEach((channel) => used.add(channel.id)); const macros = byKind.Macro || []; macros.forEach((channel) => used.add(channel.id)); return { byKind, pan, tilt, dimmer, strobe, special, macros, hasRgb: colorKinds.some((kind) => byKind[kind]?.length), other: channels.filter((channel) => !used.has(channel.id) && !channel.name.toLowerCase().includes('fine')) } }
function hsvToRgb(h, s, v) { const c = v * s; const x = c * (1 - Math.abs((h / 60) % 2 - 1)); const m = v - c; const parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return parts.map((part) => Math.round((part + m) * 255)) }
function hexToRgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] }
function rgbToHex(rgb) { return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}` }
function Label({ icon: Icon, text }) { return <div className="flex h-5 max-w-full items-center gap-1 truncate text-[10px] font-medium text-slate-400">{Icon && <Icon size={12} className="shrink-0 text-violet-300" />}{text}</div> }
function Value({ value, small = false }) { return <span className={`${small ? 'w-7 text-[8px]' : 'w-9 text-[10px]'} mt-auto block text-center font-mono tabular-nums text-slate-300`}>{String(Math.round(value)).padStart(3, '0')}</span> }

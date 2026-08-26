import { useState } from 'react'
import { Aperture, Boxes, Fan, Flower2, Gauge, Haze, LampDesk, Lightbulb, Menu, Move3D, Plus, ScanLine, Sparkles, Trash2, Wind, X, Zap } from 'lucide-react'

const categories = [
  ['Color Changer', Aperture], ['Dimmer', Gauge], ['Effect', Sparkles], ['Fan', Fan], ['Flower', Flower2], ['Hazer', Haze], ['Laser', Zap],
  ['LED bar (Beams)', Menu], ['LED bar (Pixels)', Boxes], ['Moving Head', Move3D], ['Other', Lightbulb], ['Scanner', ScanLine], ['Smoke', Wind], ['Strobe', LampDesk],
]
const presets = ['Custom', 'Intensity', 'Red', 'Green', 'Blue', 'Cyan', 'Magenta', 'Yellow', 'White', 'Amber', 'UV', 'Lime', 'Indigo', 'Pan', 'Pan fine', 'Tilt', 'Tilt fine', 'Shutter / Strobe', 'Color wheel', 'Gobo wheel', 'Prism', 'Focus', 'Zoom', 'Iris', 'Effect', 'Effect speed', 'Maintenance']
const capabilityTypes = ['NoFunction', 'Intensity', 'ColorIntensity', 'Pan', 'Tilt', 'ShutterStrobe', 'ColorPreset', 'WheelSlot', 'WheelShake', 'Prism', 'PrismRotation', 'Focus', 'Zoom', 'Iris', 'Effect', 'EffectSpeed', 'Maintenance', 'Generic']
const defaultDefinition = {
  manufacturer: '', model: '', author: '', category: 'Other',
  physical: { bulb: { type: '', lumens: '', colorTemperature: '' }, lens: { type: 'Other', degreesMin: '', degreesMax: '' }, head: { type: 'Fixed', panMax: '', tiltMax: '', columns: 1, rows: 1 }, dimensions: { weight: '', width: '', height: '', depth: '' }, electrical: { power: '', dmxConnector: '5-pin XLR' } },
  channels: [],
}

export default function CustomFixtureEditor({ onClose, onSaved }) {
  const [definition, setDefinition] = useState(defaultDefinition)
  const [tab, setTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const updatePhysical = (section, field, value) => setDefinition({ ...definition, physical: { ...definition.physical, [section]: { ...definition.physical[section], [field]: value } } })
  const valid = definition.manufacturer.trim() && definition.model.trim() && definition.channels.length

  const save = async () => {
    setSaving(true); setMessage('')
    const fixture = toOfl(definition)
    try {
      const response = await fetch('/api/fixtures/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fixture) })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      setMessage(`Saved to ${result.path}`)
      onSaved({ definition, ofl: fixture, path: result.path })
    } catch (error) {
      downloadFixture(fixture)
      setMessage(`Backend save unavailable; downloaded JSON instead. ${error.message}`)
    } finally { setSaving(false) }
  }

  return <div className="fixed inset-0 z-50 bg-black/80 p-3 sm:p-6"><div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/10 bg-base-200 shadow-2xl">
    <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="text-xl font-semibold">Custom Fixture Definition</h2><p className="text-sm text-slate-500">Open Fixture Library compatible JSON</p></div><button className="btn btn-ghost btn-square" onClick={onClose}><X size={20} /></button></header>
    <div className="flex border-b border-white/10 px-5">{[['general', 'General'], ['physical', 'Physical'], ['channels', `Channels (${definition.channels.length})`], ['json', 'OFL JSON']].map(([id, label]) => <button key={id} className={`border-b-2 px-4 py-3 text-sm ${tab === id ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`} onClick={() => setTab(id)}>{label}</button>)}</div>
    <main className="flex-1 overflow-y-auto p-5">
      {tab === 'general' && <GeneralTab definition={definition} setDefinition={setDefinition} />}
      {tab === 'physical' && <PhysicalTab physical={definition.physical} update={updatePhysical} />}
      {tab === 'channels' && <ChannelsTab channels={definition.channels} setChannels={(channels) => setDefinition({ ...definition, channels })} />}
      {tab === 'json' && <pre className="overflow-x-auto rounded-lg bg-black/30 p-4 text-xs text-slate-300">{JSON.stringify(toOfl(definition), null, 2)}</pre>}
    </main>
    <footer className="flex items-center justify-between border-t border-white/10 px-5 py-4"><span className="text-sm text-slate-500">{message || (!definition.channels.length ? 'Add at least one channel before saving.' : '')}</span><div className="flex gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!valid || saving} onClick={save}>{saving ? 'Saving…' : 'Save fixture'}</button></div></footer>
  </div></div>
}

function GeneralTab({ definition, setDefinition }) {
  const update = (field, value) => setDefinition({ ...definition, [field]: value })
  return <div className="space-y-6"><section><h3 className="mb-4 font-semibold">General information</h3><div className="grid gap-4 md:grid-cols-3"><Field label="Manufacturer"><input className="input w-full" value={definition.manufacturer} onChange={(event) => update('manufacturer', event.target.value)} /></Field><Field label="Model"><input className="input w-full" value={definition.model} onChange={(event) => update('model', event.target.value)} /></Field><Field label="Author"><input className="input w-full" value={definition.author} onChange={(event) => update('author', event.target.value)} /></Field></div></section><section><h3 className="mb-3 font-semibold">Fixture type</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{categories.map(([name, Icon]) => <button key={name} className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm ${definition.category === name ? 'border-primary bg-primary/15 text-primary' : 'border-white/10 hover:bg-white/5'}`} onClick={() => update('category', name)}><Icon size={18} />{name}</button>)}</div></section></div>
}

function PhysicalTab({ physical, update }) {
  return <div className="grid gap-5 lg:grid-cols-2">
    <Section title="Bulb"><div className="grid gap-4 sm:grid-cols-3"><Field label="Type"><input className="input w-full" value={physical.bulb.type} onChange={(e) => update('bulb', 'type', e.target.value)} /></Field><Field label="Lumens"><NumberInput value={physical.bulb.lumens} onChange={(value) => update('bulb', 'lumens', value)} /></Field><Field label="Color temperature (K)"><NumberInput value={physical.bulb.colorTemperature} onChange={(value) => update('bulb', 'colorTemperature', value)} /></Field></div></Section>
    <Section title="Lens"><div className="grid gap-4 sm:grid-cols-3"><Field label="Type"><select className="select w-full" value={physical.lens.type} onChange={(e) => update('lens', 'type', e.target.value)}><option>PC</option><option>Fresnel</option><option>Other</option></select></Field><Field label="Minimum degrees"><NumberInput value={physical.lens.degreesMin} onChange={(value) => update('lens', 'degreesMin', value)} /></Field><Field label="Maximum degrees"><NumberInput value={physical.lens.degreesMax} onChange={(value) => update('lens', 'degreesMax', value)} /></Field></div></Section>
    <Section title="Head(s)"><div className="grid gap-4 sm:grid-cols-3"><Field label="Type"><select className="select w-full" value={physical.head.type} onChange={(e) => update('head', 'type', e.target.value)}><option>Fixed</option><option>Head</option><option>Barrel</option><option>Mirror</option></select></Field><Field label="Pan max degrees"><NumberInput value={physical.head.panMax} onChange={(value) => update('head', 'panMax', value)} /></Field><Field label="Tilt max degrees"><NumberInput value={physical.head.tiltMax} onChange={(value) => update('head', 'tiltMax', value)} /></Field><Field label="Layout columns"><NumberInput min={1} value={physical.head.columns} onChange={(value) => update('head', 'columns', value)} /></Field><Field label="Layout rows"><NumberInput min={1} value={physical.head.rows} onChange={(value) => update('head', 'rows', value)} /></Field></div></Section>
    <Section title="Dimensions"><div className="grid gap-4 sm:grid-cols-4"><Field label="Weight (kg)"><NumberInput value={physical.dimensions.weight} onChange={(value) => update('dimensions', 'weight', value)} /></Field><Field label="Width (mm)"><NumberInput value={physical.dimensions.width} onChange={(value) => update('dimensions', 'width', value)} /></Field><Field label="Height (mm)"><NumberInput value={physical.dimensions.height} onChange={(value) => update('dimensions', 'height', value)} /></Field><Field label="Depth (mm)"><NumberInput value={physical.dimensions.depth} onChange={(value) => update('dimensions', 'depth', value)} /></Field></div></Section>
    <Section title="Electrical"><div className="grid gap-4 sm:grid-cols-2"><Field label="Power consumption (W)"><NumberInput value={physical.electrical.power} onChange={(value) => update('electrical', 'power', value)} /></Field><Field label="DMX connection"><select className="select w-full" value={physical.electrical.dmxConnector} onChange={(e) => update('electrical', 'dmxConnector', e.target.value)}><option>5-pin XLR</option><option>3-pin XLR</option><option>5-pin XLR IP65</option><option>3-pin XLR IP65</option><option>Other</option></select></Field></div></Section>
  </div>
}

function ChannelsTab({ channels, setChannels }) {
  const [selectedId, setSelectedId] = useState(channels[0]?.id || null)
  const selected = channels.find((channel) => channel.id === selectedId)
  const add = () => { const channel = { id: crypto.randomUUID(), name: `Channel ${channels.length + 1}`, preset: 'Custom', type: 'Generic', role: 'coarse', defaultValue: 0, capabilities: [{ id: crypto.randomUUID(), from: 0, to: 255, description: '', type: 'Generic' }] }; setChannels([...channels, channel]); setSelectedId(channel.id) }
  const update = (field, value) => setChannels(channels.map((channel) => channel.id === selectedId ? { ...channel, [field]: value } : channel))
  const applyPreset = (preset) => { const type = presetType(preset); setChannels(channels.map((channel) => channel.id === selectedId ? { ...channel, preset, name: preset === 'Custom' ? channel.name : preset, type, capabilities: [{ id: crypto.randomUUID(), from: 0, to: 255, description: preset, type }] } : channel)) }
  const updateCapability = (id, field, value) => update('capabilities', selected.capabilities.map((capability) => capability.id === id ? { ...capability, [field]: value } : capability))
  return <div className="grid gap-4 lg:grid-cols-[280px_1fr]"><section className="rounded-xl border border-white/10 bg-[#11141b] p-3"><button className="btn btn-primary btn-sm mb-3 w-full" onClick={add}><Plus size={15} /> Add channel</button>{channels.map((channel, index) => <button key={channel.id} className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ${channel.id === selectedId ? 'bg-primary/20' : 'hover:bg-white/5'}`} onClick={() => setSelectedId(channel.id)}><span><span className="block">{index + 1}. {channel.name}</span><span className="text-xs text-slate-500">{channel.type} · {channel.role === 'fine' ? 'LSB' : 'MSB'}</span></span></button>)}</section><section className="rounded-xl border border-white/10 bg-[#11141b] p-5">{selected ? <><div className="flex justify-between"><h3 className="font-semibold">Channel mapping</h3><button className="btn btn-ghost btn-square btn-sm text-error" onClick={() => { setChannels(channels.filter((channel) => channel.id !== selectedId)); setSelectedId(null) }}><Trash2 size={16} /></button></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="Name"><input className="input w-full" value={selected.name} onChange={(e) => update('name', e.target.value)} /></Field><Field label="Preset"><select className="select w-full" value={selected.preset} onChange={(e) => applyPreset(e.target.value)}>{presets.map((preset) => <option key={preset}>{preset}</option>)}</select></Field><Field label="Type"><select className="select w-full" value={selected.type} disabled={selected.preset !== 'Custom'} onChange={(e) => update('type', e.target.value)}>{capabilityTypes.map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Role"><select className="select w-full" value={selected.role} onChange={(e) => update('role', e.target.value)}><option value="coarse">Coarse (MSB)</option><option value="fine">Fine (LSB)</option></select></Field><Field label="Default value"><NumberInput min={0} max={255} value={selected.defaultValue} onChange={(value) => update('defaultValue', value)} /></Field></div><div className="mt-6 flex items-center justify-between"><div><h4 className="font-medium">Value mapping</h4><p className="text-xs text-slate-500">DMX capabilities must cover the ranges defined by the fixture manual.</p></div><button className="btn btn-outline btn-sm" onClick={() => update('capabilities', [...selected.capabilities, { id: crypto.randomUUID(), from: Math.min(255, (selected.capabilities.at(-1)?.to ?? -1) + 1), to: 255, description: '', type: selected.type }])}><Plus size={14} /> Range</button></div><div className="mt-2 space-y-2">{selected.capabilities.map((capability) => <div key={capability.id} className="grid grid-cols-[90px_90px_150px_1fr_36px] gap-2"><input className="input input-sm" type="number" min={0} max={255} value={capability.from} onChange={(e) => updateCapability(capability.id, 'from', Number(e.target.value))} /><input className="input input-sm" type="number" min={0} max={255} value={capability.to} onChange={(e) => updateCapability(capability.id, 'to', Number(e.target.value))} /><select className="select select-sm" value={capability.type} onChange={(e) => updateCapability(capability.id, 'type', e.target.value)}>{capabilityTypes.map((type) => <option key={type}>{type}</option>)}</select><input className="input input-sm" placeholder="Description, gobo, macro…" value={capability.description} onChange={(e) => updateCapability(capability.id, 'description', e.target.value)} /><button className="btn btn-ghost btn-square btn-sm text-error" onClick={() => update('capabilities', selected.capabilities.filter((item) => item.id !== capability.id))}><Trash2 size={14} /></button></div>)}</div></> : <div className="grid min-h-80 place-items-center text-slate-500">Add or select a channel</div>}</section></div>
}

function toOfl(definition) {
  const availableChannels = Object.fromEntries(definition.channels.filter((channel) => channel.role !== 'fine').map((channel) => {
    const fine = definition.channels.find((candidate) => candidate.role === 'fine' && candidate.name.replace(/ fine$/i, '') === channel.name.replace(/ coarse$/i, ''))
    const capabilities = channel.capabilities.map((capability) => toCapability(capability, channel, definition.physical))
    return [channel.name, { ...(fine ? { fineChannelAliases: [fine.name] } : {}), defaultValue: channel.defaultValue, ...(capabilities.length === 1 && capabilities[0].dmxRange[0] === 0 && capabilities[0].dmxRange[1] === 255 ? { capability: Object.fromEntries(Object.entries(capabilities[0]).filter(([key]) => key !== 'dmxRange')) } : { capabilities }) }]
  }))
  const p = definition.physical
  return { $schema: 'https://raw.githubusercontent.com/OpenLightingProject/open-fixture-library/schema-12.5.1/schemas/fixture.json', name: definition.model, fixtureKey: slug(definition.model), manufacturerKey: slug(definition.manufacturer), categories: [definition.category], meta: { authors: [definition.author || 'JustLights'], createDate: new Date().toISOString().slice(0, 10), lastModifyDate: new Date().toISOString().slice(0, 10) }, physical: { dimensions: [numberOrZero(p.dimensions.width), numberOrZero(p.dimensions.height), numberOrZero(p.dimensions.depth)], weight: numberOrZero(p.dimensions.weight), power: numberOrZero(p.electrical.power), DMXconnector: p.electrical.dmxConnector, bulb: { type: p.bulb.type, lumens: numberOrZero(p.bulb.lumens), colorTemperature: numberOrZero(p.bulb.colorTemperature) }, lens: { name: p.lens.type, degreesMinMax: [numberOrZero(p.lens.degreesMin), numberOrZero(p.lens.degreesMax)] } }, availableChannels, modes: [{ name: `${definition.channels.length}-channel`, shortName: `${definition.channels.length}ch`, channels: definition.channels.map((channel) => channel.name) }], matrix: p.head.columns * p.head.rows > 1 ? { pixelCount: [p.head.columns, p.head.rows, 1] } : undefined }
}

function toCapability(capability, channel, physical) {
  const result = { dmxRange: [capability.from, capability.to], type: capability.type, ...(capability.description ? { comment: capability.description } : {}) }
  if (capability.type === 'ColorIntensity') result.color = channel.preset
  if (capability.type === 'Pan') { result.angleStart = `${-numberOrZero(physical.head.panMax) / 2}deg`; result.angleEnd = `${numberOrZero(physical.head.panMax) / 2}deg` }
  if (capability.type === 'Tilt') { result.angleStart = `${-numberOrZero(physical.head.tiltMax) / 2}deg`; result.angleEnd = `${numberOrZero(physical.head.tiltMax) / 2}deg` }
  if (capability.type === 'ShutterStrobe') result.shutterEffect = 'Strobe'
  if (capability.type === 'Effect') result.effectName = capability.description || 'Effect'
  return result
}

function presetType(preset) { if (['Red', 'Green', 'Blue', 'Cyan', 'Magenta', 'Yellow', 'White', 'Amber', 'UV', 'Lime', 'Indigo'].includes(preset)) return 'ColorIntensity'; if (preset.includes('Pan')) return 'Pan'; if (preset.includes('Tilt')) return 'Tilt'; if (preset === 'Intensity') return 'Intensity'; if (preset === 'Shutter / Strobe') return 'ShutterStrobe'; if (preset.includes('Gobo') || preset.includes('Color wheel')) return 'WheelSlot'; if (preset === 'Custom') return 'Generic'; return preset.replaceAll(' ', '') }
function downloadFixture(fixture) { const blob = new Blob([JSON.stringify(fixture, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${slug(fixture.name)}.json`; link.click(); URL.revokeObjectURL(link.href) }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
function numberOrZero(value) { return Number(value) || 0 }
function NumberInput({ value, onChange, min, max }) { return <input className="input w-full" type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /> }
function Section({ title, children }) { return <section className="rounded-xl border border-white/10 bg-[#11141b] p-5"><h3 className="mb-4 font-semibold">{title}</h3>{children}</section> }
function Field({ label, children }) { return <label className="flex flex-col gap-2 text-sm text-slate-400"><span>{label}</span>{children}</label> }

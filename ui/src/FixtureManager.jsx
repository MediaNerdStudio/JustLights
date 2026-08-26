import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRightLeft, ArrowUp, BookOpen, Grid3X3, LayoutGrid, Plus, Rows3, Trash2, Wrench, X } from 'lucide-react'
import CustomFixtureEditor from './CustomFixtureEditor.jsx'

const channelKinds = ['Intensity', 'Red', 'Green', 'Blue', 'White', 'Amber', 'UV', 'Pan', 'Tilt', 'Strobe', 'Macro', 'Speed', 'Generic']
const freshPanelForm = { name: 'RGB Panel', universe: 1, address: 1, components: 'RGB', columns: 4, rows: 4, width: 1000, height: 1000, orientation: 'Top-left', serpentine: true }

export default function FixtureManager({ fixtures, setFixtures, groups, setGroups, channelGroups, setChannelGroups }) {
  const [section, setSection] = useState('fixtures')
  const [selectedId, setSelectedId] = useState(fixtures[0]?.id || null)
  const [dialog, setDialog] = useState(null)
  const [panelForm, setPanelForm] = useState(freshPanelForm)
  const [customEditor, setCustomEditor] = useState(false)
  const [oflBrowser, setOflBrowser] = useState(false)
  const selected = fixtures.find((fixture) => fixture.id === selectedId)

  const nextAddress = useMemo(() => fixtures.reduce((highest, fixture) => Math.max(highest, fixture.address + fixture.channels.length), 1), [fixtures])
  const addRgbPanel = () => {
    const components = panelForm.components.split('')
    const rows = Array.from({ length: panelForm.rows }, (_, row) => ({
      id: crypto.randomUUID(), name: `${panelForm.name} Row ${row + 1}`, manufacturer: 'Generic', model: 'RGB Panel Row', type: 'RGB Panel', mode: panelForm.components,
      universe: panelForm.universe, address: panelForm.address + row * panelForm.columns * components.length,
      channels: Array.from({ length: panelForm.columns }, (_, column) => components.map((component) => ({ id: crypto.randomUUID(), name: `Pixel ${column + 1} ${component}`, kind: component === 'R' ? 'Red' : component === 'G' ? 'Green' : component === 'B' ? 'Blue' : 'White', offset: column * components.length + components.indexOf(component), defaultValue: 0, group: 'Color' }))).flat(), remap: null,
    }))
    const group = { id: crypto.randomUUID(), name: panelForm.name, width: panelForm.columns, height: panelForm.rows, fixtureIds: rows.map((fixture) => fixture.id), layout: rows.map((fixture, row) => ({ fixtureId: fixture.id, x: 0, y: row })) }
    setFixtures([...fixtures, ...rows]); setGroups([...groups, group]); setSelectedId(rows[0].id); setDialog(null)
  }

  const addCustomFixture = ({ definition, path }) => {
    const fixture = { id: crypto.randomUUID(), name: definition.model, manufacturer: definition.manufacturer, model: definition.model, type: definition.category, mode: `${definition.channels.length}ch`, universe: 1, address: Math.min(nextAddress, 512), channels: definition.channels.map((channel, offset) => ({ id: crypto.randomUUID(), name: channel.name, kind: channel.type, offset, defaultValue: channel.defaultValue, group: channel.preset, capabilities: channel.capabilities, role: channel.role })), remap: null, definitionPath: path }
    setFixtures([...fixtures, fixture]); setSelectedId(fixture.id); setCustomEditor(false)
  }

  const addOflFixture = (definition, mode, patch) => {
    const added = Array.from({ length: patch.quantity }, (_, index) => ({
      id: crypto.randomUUID(), name: patch.quantity > 1 ? `${definition.name} ${index + 1}` : definition.name, manufacturer: definition.manufacturerKey, model: definition.name, type: definition.categories?.[0] || 'Other', mode: mode.name, universe: patch.universe, address: patch.address + index * (mode.channels.length + patch.gap), channels: mode.channels.map((name, offset) => { const channelName = typeof name === 'string' ? name : `Channel ${offset + 1}`; const kind = inferChannelKind(channelName); return { id: crypto.randomUUID(), name: channelName, kind, offset, defaultValue: 0, group: channelGroup(kind) } }), remap: null, oflKey: `${definition.manufacturerKey}/${definition.fixtureKey}`,
    }))
    setFixtures([...fixtures, ...added]); setSelectedId(added[0].id); setOflBrowser(false)
  }

  const updateFixture = (field, value) => setFixtures(fixtures.map((fixture) => fixture.id === selectedId ? { ...fixture, [field]: value } : fixture))
  const removeSelected = () => { setFixtures(fixtures.filter((fixture) => fixture.id !== selectedId)); setGroups(groups.map((group) => ({ ...group, fixtureIds: group.fixtureIds.filter((id) => id !== selectedId) }))); setSelectedId(null) }

  return <>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Fixture Manager</h1><p className="mt-1 text-sm text-slate-500">Patch fixtures, arrange groups, configure channels and remap devices</p></div>
      <div className="flex gap-2"><button className="btn btn-outline btn-sm" onClick={() => setOflBrowser(true)}><BookOpen size={16} /> OFL library</button><button className="btn btn-outline btn-sm" onClick={() => setCustomEditor(true)}><Wrench size={16} /> Custom fixture</button><button className="btn btn-outline btn-sm" onClick={() => setDialog('panel')}><LayoutGrid size={16} /> RGB panel</button></div>
    </div>

    <div role="tablist" className="tabs tabs-box mb-4 w-fit">
      {[['fixtures', 'Fixtures', Grid3X3], ['groups', 'Fixture groups', LayoutGrid], ['channels', 'Channel groups', Rows3], ['remap', 'Remapping', ArrowRightLeft]].map(([id, label, Icon]) => <button key={id} role="tab" className={`tab gap-2 ${section === id ? 'tab-active' : ''}`} onClick={() => setSection(id)}><Icon size={15} />{label}</button>)}
    </div>

    {section === 'fixtures' && <FixturesSection fixtures={fixtures} selected={selected} selectedId={selectedId} setSelectedId={setSelectedId} updateFixture={updateFixture} setFixtures={setFixtures} removeSelected={removeSelected} />}
    {section === 'groups' && <GroupsSection fixtures={fixtures} groups={groups} setGroups={setGroups} />}
    {section === 'channels' && <ChannelGroupsSection channelGroups={channelGroups} setChannelGroups={setChannelGroups} />}
    {section === 'remap' && <RemapSection fixtures={fixtures} setFixtures={setFixtures} />}

    {dialog === 'panel' && <PanelDialog form={panelForm} setForm={setPanelForm} onClose={() => setDialog(null)} onSubmit={addRgbPanel} />}
    {customEditor && <CustomFixtureEditor onClose={() => setCustomEditor(false)} onSaved={addCustomFixture} />}
    {oflBrowser && <OflBrowser onClose={() => setOflBrowser(false)} onAdd={addOflFixture} nextAddress={Math.min(nextAddress, 512)} />}
  </>
}

function FixturesSection({ fixtures, selected, selectedId, setSelectedId, updateFixture, setFixtures, removeSelected }) {
  const updateChannel = (channelId, field, value) => setFixtures(fixtures.map((fixture) => fixture.id !== selectedId ? fixture : { ...fixture, channels: fixture.channels.map((channel) => channel.id === channelId ? { ...channel, [field]: value } : channel) }))
  return <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
    <section className="rounded-xl border border-white/10 bg-[#11141b] p-3">
      <div className="mb-2 flex items-center justify-between px-2"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace fixtures</span><span className="badge badge-sm">{fixtures.length}</span></div>
      <div className="space-y-1">{fixtures.length ? fixtures.map((fixture) => <button key={fixture.id} className={`w-full rounded-lg px-3 py-2 text-left ${selectedId === fixture.id ? 'bg-primary/20 text-primary-content' : 'hover:bg-white/5'}`} onClick={() => setSelectedId(fixture.id)}><div className="font-medium">{fixture.name}</div><div className="text-xs text-slate-500">U{fixture.universe} · {fixture.address}–{fixture.address + fixture.channels.length - 1} · {fixture.model}</div></button>) : <div className="py-16 text-center text-sm text-slate-500">No fixtures added</div>}</div>
    </section>
    <section className="rounded-xl border border-white/10 bg-[#11141b] p-5">
      {!selected ? <div className="grid min-h-96 place-items-center text-slate-500">Select or add a fixture</div> : <>
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Fixture properties</h2><p className="text-sm text-slate-500">{selected.manufacturer} · {selected.model} · {selected.mode}</p></div><button className="btn btn-ghost btn-square btn-sm text-error" onClick={removeSelected}><Trash2 size={17} /></button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-4"><Field label="Name"><input className="input w-full" value={selected.name} onChange={(event) => updateFixture('name', event.target.value)} /></Field><Field label="Universe"><input className="input w-full" type="number" min={1} value={selected.universe} onChange={(event) => updateFixture('universe', Number(event.target.value))} /></Field><Field label="Address"><input className="input w-full" type="number" min={1} max={512} value={selected.address} onChange={(event) => updateFixture('address', Number(event.target.value))} /></Field><Field label="Channels"><input className="input w-full" value={selected.channels.length} disabled /></Field></div>
        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">Channel properties</h3>
        <div className="overflow-x-auto"><table className="table table-sm"><thead><tr><th>DMX</th><th>Name</th><th>Kind</th><th>Group</th><th>Default</th></tr></thead><tbody>{selected.channels.map((channel) => <tr key={channel.id}><td>{selected.address + channel.offset}</td><td><input className="input input-sm w-40" value={channel.name} onChange={(event) => updateChannel(channel.id, 'name', event.target.value)} /></td><td><select className="select select-sm" value={channel.kind} onChange={(event) => updateChannel(channel.id, 'kind', event.target.value)}>{channelKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></td><td><input className="input input-sm w-28" value={channel.group} onChange={(event) => updateChannel(channel.id, 'group', event.target.value)} /></td><td><input className="input input-sm w-20" type="number" min={0} max={255} value={channel.defaultValue} onChange={(event) => updateChannel(channel.id, 'defaultValue', Number(event.target.value))} /></td></tr>)}</tbody></table></div>
      </>}
    </section>
  </div>
}

function GroupsSection({ fixtures, groups, setGroups }) {
  const [selectedId, setSelectedId] = useState(groups[0]?.id || null)
  const selected = groups.find((group) => group.id === selectedId)
  const addGroup = () => { const group = { id: crypto.randomUUID(), name: `Group ${groups.length + 1}`, width: 4, height: 2, fixtureIds: [], layout: [] }; setGroups([...groups, group]); setSelectedId(group.id) }
  const update = (changes) => setGroups(groups.map((group) => group.id === selectedId ? { ...group, ...changes } : group))
  const toggleFixture = (fixtureId) => update({ fixtureIds: selected.fixtureIds.includes(fixtureId) ? selected.fixtureIds.filter((id) => id !== fixtureId) : [...selected.fixtureIds, fixtureId] })
  const removeGroup = (groupId) => { const remaining = groups.filter((group) => group.id !== groupId); setGroups(remaining); if (selectedId === groupId) setSelectedId(remaining[0]?.id || null) }
  const removeSelected = () => removeGroup(selectedId)
  return <div className="grid gap-4 lg:grid-cols-[280px_1fr]"><section className="rounded-xl border border-white/10 bg-[#11141b] p-3"><button className="btn btn-primary btn-sm mb-3 w-full" onClick={addGroup}><Plus size={15} /> New group</button>{groups.map((group) => <div key={group.id} className={`mb-1 flex items-center rounded-lg ${selectedId === group.id ? 'bg-primary/20' : 'hover:bg-white/5'}`}><button className="min-w-0 flex-1 px-3 py-2 text-left" onClick={() => setSelectedId(group.id)}><div className="truncate">{group.name}</div><div className="text-xs text-slate-500">{group.fixtureIds.length} fixtures · {group.width}×{group.height}</div></button><button className="btn btn-error btn-square btn-sm mr-1 shrink-0" title={`Delete ${group.name}`} aria-label={`Delete ${group.name}`} onClick={() => removeGroup(group.id)}><Trash2 size={15} /></button></div>)}</section><section className="rounded-xl border border-white/10 bg-[#11141b] p-5">{selected ? <><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Fixture group</h2><p className="text-xs text-slate-500">Deleting a group does not delete its fixtures.</p></div><button className="btn btn-error btn-outline btn-sm" onClick={removeSelected}><Trash2 size={15} /> Delete group</button></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Group name"><input className="input w-full" value={selected.name} onChange={(event) => update({ name: event.target.value })} /></Field><Field label="Grid width"><input className="input w-full" type="number" min={1} value={selected.width} onChange={(event) => update({ width: Number(event.target.value) })} /></Field><Field label="Grid height"><input className="input w-full" type="number" min={1} value={selected.height} onChange={(event) => update({ height: Number(event.target.value) })} /></Field></div><h3 className="mt-6 mb-2 font-medium">Assigned fixtures</h3><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{fixtures.map((fixture) => <label key={fixture.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 p-3"><input type="checkbox" className="checkbox checkbox-primary checkbox-sm" checked={selected.fixtureIds.includes(fixture.id)} onChange={() => toggleFixture(fixture.id)} /><span><span className="block text-sm">{fixture.name}</span><span className="text-xs text-slate-500">U{fixture.universe} A{fixture.address}</span></span></label>)}</div></> : <div className="grid min-h-80 place-items-center text-slate-500">Create a fixture group</div>}</section></div>
}

function ChannelGroupsSection({ channelGroups, setChannelGroups }) {
  const add = () => setChannelGroups([...channelGroups, { id: crypto.randomUUID(), name: `Channel group ${channelGroups.length + 1}`, color: '#7c3aed' }])
  const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= channelGroups.length) return; const next = [...channelGroups]; [next[index], next[target]] = [next[target], next[index]]; setChannelGroups(next) }
  return <section className="max-w-3xl rounded-xl border border-white/10 bg-[#11141b] p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Channel groups</h2><p className="text-sm text-slate-500">Organize channel functions for presets and effects</p></div><button className="btn btn-primary btn-sm" onClick={add}><Plus size={15} /> Add group</button></div><div className="space-y-2">{channelGroups.map((group, index) => <div key={group.id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3"><input type="color" className="size-8 rounded" value={group.color} onChange={(event) => setChannelGroups(channelGroups.map((item) => item.id === group.id ? { ...item, color: event.target.value } : item))} /><input className="input input-sm flex-1" value={group.name} onChange={(event) => setChannelGroups(channelGroups.map((item) => item.id === group.id ? { ...item, name: event.target.value } : item))} /><button className="btn btn-ghost btn-square btn-sm" onClick={() => move(index, -1)}><ArrowUp size={15} /></button><button className="btn btn-ghost btn-square btn-sm" onClick={() => move(index, 1)}><ArrowDown size={15} /></button><button className="btn btn-ghost btn-square btn-sm text-error" onClick={() => setChannelGroups(channelGroups.filter((item) => item.id !== group.id))}><Trash2 size={15} /></button></div>)}</div></section>
}

function RemapSection({ fixtures, setFixtures }) {
  const remap = (fixtureId, targetId) => setFixtures(fixtures.map((fixture) => fixture.id === fixtureId ? { ...fixture, remap: targetId || null } : fixture))
  return <section className="rounded-xl border border-white/10 bg-[#11141b] p-5"><h2 className="font-semibold">Fixture remapping</h2><p className="mt-1 text-sm text-slate-500">Redirect a fixture to another compatible fixture without changing programmed functions.</p><div className="mt-4 overflow-x-auto"><table className="table"><thead><tr><th>Source fixture</th><th>Channels</th><th>Remap target</th><th>Status</th></tr></thead><tbody>{fixtures.map((fixture) => { const targets = fixtures.filter((target) => target.id !== fixture.id && target.channels.length === fixture.channels.length); return <tr key={fixture.id}><td>{fixture.name}</td><td>{fixture.channels.length}</td><td><select className="select select-sm w-64" value={fixture.remap || ''} onChange={(event) => remap(fixture.id, event.target.value)}><option value="">No remapping</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></td><td><span className={`badge badge-sm ${fixture.remap ? 'badge-warning' : 'badge-ghost'}`}>{fixture.remap ? 'Remapped' : 'Direct'}</span></td></tr> })}</tbody></table></div></section>
}

function PanelDialog({ form, setForm, onClose, onSubmit }) {
  return <Dialog title="Add RGB panel" onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-3"><Field label="Panel name"><input className="input w-full" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Universe"><input className="input w-full" type="number" min={1} value={form.universe} onChange={(event) => setForm({ ...form, universe: Number(event.target.value) })} /></Field><Field label="Start address"><input className="input w-full" type="number" min={1} max={512} value={form.address} onChange={(event) => setForm({ ...form, address: Number(event.target.value) })} /></Field><Field label="Components"><select className="select w-full" value={form.components} onChange={(event) => setForm({ ...form, components: event.target.value })}><option>RGB</option><option>RGBW</option><option>BGR</option></select></Field><Field label="Columns"><input className="input w-full" type="number" min={1} value={form.columns} onChange={(event) => setForm({ ...form, columns: Number(event.target.value) })} /></Field><Field label="Rows"><input className="input w-full" type="number" min={1} value={form.rows} onChange={(event) => setForm({ ...form, rows: Number(event.target.value) })} /></Field><Field label="Width (mm)"><input className="input w-full" type="number" value={form.width} onChange={(event) => setForm({ ...form, width: Number(event.target.value) })} /></Field><Field label="Height (mm)"><input className="input w-full" type="number" value={form.height} onChange={(event) => setForm({ ...form, height: Number(event.target.value) })} /></Field><Field label="Orientation"><select className="select w-full" value={form.orientation} onChange={(event) => setForm({ ...form, orientation: event.target.value })}><option>Top-left</option><option>Top-right</option><option>Bottom-left</option><option>Bottom-right</option></select></Field></div><label className="mt-4 flex items-center gap-3"><input type="checkbox" className="checkbox checkbox-primary" checked={form.serpentine} onChange={(event) => setForm({ ...form, serpentine: event.target.checked })} /> Serpentine wiring</label></Dialog>
}

function OflBrowser({ onClose, onAdd, nextAddress }) {
  const [fixtures, setFixtures] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modeIndex, setModeIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [universe, setUniverse] = useState(1)
  const [address, setAddress] = useState(nextAddress)
  const [gap, setGap] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => { fetch('/api/fixtures/ofl').then((response) => { if (!response.ok) throw new Error('OFL API unavailable'); return response.json() }).then(setFixtures).catch((reason) => setError(reason.message)) }, [])
  const matches = fixtures.filter((fixture) => `${fixture.manufacturerKey} ${fixture.name}`.toLowerCase().includes(search.toLowerCase())).slice(0, 100)
  const mode = selected?.modes?.[modeIndex]
  const lastAddress = mode ? address + (quantity - 1) * (mode.channels.length + gap) + mode.channels.length - 1 : address
  const add = () => { if (!mode) return; if (address < 1 || quantity < 1 || gap < 0 || lastAddress > 512) return setError(`Fixtures require addresses ${address}–${lastAddress}; universe ${universe} ends at 512.`); onAdd(selected, mode, { quantity, universe, address, gap }) }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><div className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-base-200"><div className="flex items-center justify-between border-b border-white/10 p-4"><div><h2 className="text-lg font-semibold">Open Fixture Library</h2><p className="text-sm text-slate-500">Fixtures loaded from the local OFL collection</p></div><button className="btn btn-ghost btn-square btn-sm" onClick={onClose}><X size={18} /></button></div><div className="grid min-h-0 flex-1 lg:grid-cols-[360px_1fr]"><div className="overflow-y-auto border-r border-white/10 p-3"><input className="input input-sm mb-3 w-full" placeholder="Search manufacturer or model" value={search} onChange={(event) => setSearch(event.target.value)} />{error && <div className="alert alert-error text-sm">{error}</div>}{matches.map((fixture) => <button key={`${fixture.manufacturerKey}/${fixture.fixtureKey}`} className={`mb-1 w-full rounded-lg px-3 py-2 text-left ${selected?.fixtureKey === fixture.fixtureKey && selected?.manufacturerKey === fixture.manufacturerKey ? 'bg-primary/20' : 'hover:bg-white/5'}`} onClick={() => { setSelected(fixture); setModeIndex(0) }}><div>{fixture.name}</div><div className="text-xs text-slate-500">{fixture.manufacturerKey} · {fixture.categories?.join(', ')}</div></button>)}</div><div className="overflow-y-auto p-5">{selected ? <><h3 className="text-xl font-semibold">{selected.name}</h3><p className="text-sm text-slate-500">{selected.manufacturerKey} · {selected.categories?.join(', ')}</p><Field label="Mode"><select className="select mt-5 w-full max-w-sm" value={modeIndex} onChange={(event) => setModeIndex(Number(event.target.value))}>{selected.modes?.map((item, index) => <option key={item.name} value={index}>{item.name} ({item.channels.length} channels)</option>)}</select></Field><section className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4"><h4 className="font-medium">Patch fixtures</h4><p className="mt-1 text-xs text-slate-500">Add multiple copies with optional unused DMX channels between each fixture.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Amount"><input className="input w-full" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></Field><Field label="Universe"><input className="input w-full" type="number" min={1} value={universe} onChange={(event) => setUniverse(Math.max(1, Number(event.target.value)))} /></Field><Field label="Start address"><input className="input w-full" type="number" min={1} max={512} value={address} onChange={(event) => setAddress(Number(event.target.value))} /></Field><Field label="Gap"><input className="input w-full" type="number" min={0} value={gap} onChange={(event) => setGap(Math.max(0, Number(event.target.value)))} /></Field></div>{mode && <p className={`mt-3 text-xs ${lastAddress > 512 ? 'text-error' : 'text-slate-400'}`}>DMX range: U{universe} · {address}–{lastAddress}</p>}</section>{mode && <div className="mt-5 rounded-lg border border-white/10 p-4"><h4 className="mb-2 font-medium">Channel map</h4><ol className="grid gap-1 text-sm sm:grid-cols-2">{mode.channels.map((channel, index) => <li key={index} className="text-slate-400"><span className="mr-2 text-slate-600">{index + 1}</span>{typeof channel === 'string' ? channel : 'Matrix channel'}</li>)}</ol></div>}<button className="btn btn-primary mt-5" disabled={!mode} onClick={add}>Add {quantity} fixture{quantity === 1 ? '' : 's'} to workspace</button></> : <div className="grid h-full place-items-center text-slate-500">Select a fixture definition</div>}</div></div></div></div>
}

function Dialog({ title, children, onClose, onSubmit }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/10 bg-base-200 shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><h2 className="text-lg font-semibold">{title}</h2><button className="btn btn-ghost btn-square btn-sm" onClick={onClose}><X size={18} /></button></div><div className="p-5">{children}<div className="mt-6 flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={onSubmit}>Add</button></div></div></div></div>
}

function inferChannelKind(name) {
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

function channelGroup(kind) {
  if (['Red', 'Green', 'Blue', 'White', 'Amber', 'UV'].includes(kind)) return 'Color'
  if (['Pan', 'Tilt'].includes(kind)) return 'Position'
  if (kind === 'Intensity') return 'Intensity'
  return kind
}

function Field({ label, children }) {
  return <label className="flex flex-col gap-2 text-sm text-slate-400"><span>{label}</span>{children}</label>
}

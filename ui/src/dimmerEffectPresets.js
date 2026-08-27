import { fixtureOrders } from './colorEffectPresets.js'

export const beatMultipliers = ['÷2', '÷3', '÷4', '÷6', '÷8', '÷12', 'x1', 'x2', 'x3', 'x4', 'x6', 'x8', 'x12']
export const dimmerEffectTypes = ['Yo-yo', 'Chase', 'Rain', 'Scanner', 'Meteor', 'Curve']

const pattern = (name, dimmerType, duration, colors, parameters = {}) => ({
  name,
  effects: [{ type: 'dimmerEffect', dimmerType, duration, colors, fixtureOrder: fixtureOrders[0], offset: 0, randomize: 0, ...parameters }]
})

const beatPattern = (name, dimmerType, beatMultiplier, colors, parameters = {}) => ({
  name,
  effects: [{ type: 'dimmerEffect', dimmerType, beatMultiplier, colors, fixtureOrder: fixtureOrders[0], offset: 0, randomize: 0, ...parameters }]
})

const curve = (name, duration, curveDef, timeOffset = 0) => ({
  name,
  effects: [{ type: 'dimmerEffect', dimmerType: 'Curve', duration, curve: curveDef, timeOffset, fixtureOrder: fixtureOrders[0] }]
})

export const dimmerEffectPresets = [
  pattern('Barn Doors', 'Yo-yo', 2, ['#000000', '#ffffff'], { phase: 0, center: 50, steepness: 0 }),
  beatPattern('Beat Meteor', 'Meteor', 'x4', ['#000000', '#ffffff'], { length: 2, distance: 19, phase: 0, trail: 60 }),
  beatPattern('Beat Strike', 'Yo-yo', 'x1', ['#5f5f5f', '#ffffff'], { phase: 0, center: 0, steepness: 50 }),
  pattern('Can-Can', 'Chase', 0.8, ['#000000', '#ffffff'], { stepsPerSample: 1, phase: 0, timeOffset: 100, delay: 0, smoothness: 0 }),
  pattern('Droplets', 'Rain', 1, ['#000000', '#ffffff'], { length: 5, distance: 5, phase: 0, fringe: 100, noise: 0 }),
  pattern('Marching Ants', 'Chase', 1, ['#000000', '#ffffff'], { stepsPerSample: 1, phase: 0, timeOffset: 25, delay: 0, smoothness: 0 }),
  pattern('Rain', 'Rain', 1, ['#000000', '#ffffff'], { length: 6, distance: 6, phase: 0, fringe: 100, noise: 0 }),
  pattern('Searchlight', 'Scanner', 10, ['#000000', '#ffffff'], { length: 2, overshoot: 2, phase: 0, fringe: 0, noise: 0 }),
  pattern('Shades', 'Chase', 5, ['#cbcbcb', '#929292', '#ffffff', '#515151'], { stepsPerSample: 6, phase: 0, timeOffset: 100, delay: 0, smoothness: 0 }),
  beatPattern('Beat Flash', 'Curve', 'x1', ['#000000', '#ffffff'], {
    timeOffset: 0,
    curve: [
      { from: 0, to: 0.06, fromValue: 1, toValue: 1, type: 'constant' },
      { from: 0.06, to: 1, fromValue: 0.5, toValue: 0.5, type: 'constant' }
    ]
  }),
  beatPattern('Beat Flash 4x', 'Curve', 'x1', ['#000000', '#ffffff'], {
    timeOffset: 0,
    curve: [
      { from: 0, to: 0.06, fromValue: 1, toValue: 1, type: 'constant' },
      { from: 0.06, to: 0.25, fromValue: 0, toValue: 0, type: 'constant' },
      { from: 0.25, to: 0.31, fromValue: 0.25, toValue: 0.25, type: 'constant' },
      { from: 0.31, to: 0.5, fromValue: 0, toValue: 0, type: 'constant' },
      { from: 0.5, to: 0.55, fromValue: 0.25, toValue: 0.25, type: 'constant' },
      { from: 0.55, to: 0.75, fromValue: 0, toValue: 0, type: 'constant' },
      { from: 0.75, to: 0.80, fromValue: 0.25, toValue: 0.25, type: 'constant' },
      { from: 0.80, to: 1, fromValue: 0, toValue: 0, type: 'constant' }
    ]
  }),
  curve('Light Wave', 1, [
    { from: 0, to: 0.5, fromValue: 1, toValue: 0, type: 'curveDown' },
    { from: 0.5, to: 1, fromValue: 0, toValue: 0, type: 'constant' }
  ], 10),
  curve('Lightning', 0.1, [
    { from: 0, to: 0.25, fromValue: 1, toValue: 1, type: 'constant' },
    { from: 0.25, to: 1, fromValue: 0, toValue: 0, type: 'constant' }
  ], 0),
  curve('Pulse Alternating', 5, [
    { from: 0, to: 0.25, fromValue: 0.5, toValue: 1, type: 'sine' },
    { from: 0.25, to: 0.5, fromValue: 1, toValue: 0.5, type: 'sine' },
    { from: 0.5, to: 0.75, fromValue: 0.5, toValue: 0, type: 'sine' },
    { from: 0.75, to: 1, fromValue: 0, toValue: 0.5, type: 'sine' }
  ], 0),
  curve('Pulse Decreasing', 5, [
    { from: 0, to: 1, fromValue: 1, toValue: 0, type: 'linear' }
  ], 0),
  curve('Pulse Increasing', 5, [
    { from: 0, to: 1, fromValue: 0, toValue: 1, type: 'linear' }
  ], 0),
  curve('Random Fade', 5, [
    { from: 0, to: 0.25, fromValue: 0, toValue: 1, type: 'easeInOut' },
    { from: 0.25, to: 1, fromValue: 1, toValue: 0, type: 'linear' }
  ], 15),
  curve('Venetian Blinds', 1, [
    { from: 0, to: 0.5, fromValue: 1, toValue: 1, type: 'constant' },
    { from: 0.5, to: 1, fromValue: 0, toValue: 0, type: 'constant' }
  ], 10)
]

export const dimmerFields = {
  'Yo-yo': [percent('phase', 'Phase'), percent('center', 'Center', 50), percent('steepness', 'Steep', 50)],
  Chase: [number('stepsPerSample', 'Steps', 1, 20, 1), percent('phase', 'Phase'), percent('timeOffset', 'Offset', 100), percent('delay', 'Delay'), percent('smoothness', 'Smooth')],
  Rain: [number('length', 'Length'), number('distance', 'Distance'), percent('phase', 'Phase'), percent('fringe', 'Fringe'), percent('noise', 'Noise')],
  Scanner: [number('length', 'Length'), number('overshoot', 'Overshoot'), percent('phase', 'Phase'), percent('fringe', 'Fringe'), percent('noise', 'Noise')],
  Meteor: [number('length', 'Length'), number('distance', 'Distance'), percent('phase', 'Phase'), percent('trail', 'Trail')]
}

function percent(key, label, defaultValue = 0) {
  return { key, label, default: defaultValue }
}

function number(key, label, min = 0, max = 40, defaultValue = 1) {
  return { key, label, min, max, default: defaultValue }
}

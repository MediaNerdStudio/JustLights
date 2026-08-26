const preset = (name, positionType, duration, parameters = {}) => ({ name, effects: [{ type: 'positionEffect', positionType, duration, fixtureOrder: 'Left to Right', mirrorPan: false, mirrorTilt: false, relative: false, timeOffset: 0, panOffset: 0, tiltOffset: 0, ...parameters }] })

export const positionEffectPresets = [
  preset('Slow circle', 'Circle', 7, { width: 80, height: 80 }),
  preset('Figure eight', 'Figure eight', 5, { width: 85, height: 85 }),
  preset('Triangle', 'Triangle', 4, { width: 65, height: 65 }),
  preset('Triangle Wide', 'Triangle', 4, { width: 100, height: 55 }),
  preset('Wedge Straight', 'Wedge Straight', 4, { width: 90, height: 70 }),
  preset('Wedge Curved', 'Wedge Curved', 4, { width: 90, height: 70 }),
  preset('Tilt Track 1', 'Tilt Track 1', 3, { width: 0, height: 90 }),
  preset('Tilt Track 2', 'Tilt Track 2', 3, { width: 35, height: 100 }),
  preset('Pan Track', 'Pan Track', 3, { width: 100, height: 0 }),
  preset('Zig Zag 2', 'Zig Zag', 4, { width: 100, height: 70, count: 2 }),
  preset('Zig Zag 5', 'Zig Zag', 5, { width: 100, height: 70, count: 5 }),
  preset('Bow tie', 'Bow tie', 4, { width: 90, height: 80 }),
  preset('Flower', 'Flower', 6, { width: 85, height: 85, petals: 5 }),
  preset('Half Flower 3', 'Half Flower', 5, { width: 85, height: 70, petals: 3 }),
  preset('Half Flower 5', 'Half Flower', 6, { width: 85, height: 70, petals: 5 }),
  preset('Random Dots', 'Random Dots', 1, { width: 100, height: 100 }),
]

export const positionEffectTypes = ['Circle', 'Figure eight', 'Triangle', 'Wedge Straight', 'Wedge Curved', 'Tilt Track 1', 'Tilt Track 2', 'Pan Track', 'Zig Zag', 'Bow tie', 'Flower', 'Half Flower', 'Random Dots']

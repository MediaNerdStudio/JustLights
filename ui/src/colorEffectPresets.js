const effect = (name, colorType, duration, colors, parameters = {}) => ({ name, effects: [{ type: 'colorEffect', colorType, duration, colors, fixtureOrder: 'Left to Right', offset: 0, randomize: 0, ...parameters }] })

export const colorEffectPresets = [
  effect('Beat Comet', 'Rain', 1, ['#001e51', '#00f935'], { length: 3, distance: 30, phase: 0, fringe: 100, noise: 75 }),
  effect('Butterflies', 'Chase', 3, ['#000000', '#fcaedb', '#000000', '#fb82c2', '#000000', '#fb2d89'], { stepsPerSample: 3, phase: 0, timeOffset: 100, delay: 0, smoothness: 0 }),
  effect('Confetti', 'Rain', 0.5, ['#000000', '#008485', '#ff32a7', '#b439ff', '#12a1d3', '#e99e01'], { length: 5, distance: 5, phase: 0, fringe: 100, noise: 0 }),
  effect('Cop Light', 'Chase', 3, ['#000000', '#000000', '#0071ff'], { stepsPerSample: 6, phase: 0, timeOffset: 100, delay: 0, smoothness: 50 }),
  effect('Elevator', 'Rain', 0.8, ['#000000', '#ff2600', '#ffffff', '#20f900', '#0071ff'], { length: 5, distance: 12, phase: 0, fringe: 0, noise: 0 }),
  effect('Fill', 'Fill', 3, ['#000000', '#fffb0c', '#65fa35', '#ff3f71']),
  effect('Fire', 'Fire', 0, ['#000000', '#ff2600', '#ff9300', '#fffb00', '#ffffff'], { speed: 50, sparking: 50, cooling: 50 }),
  effect('Glittering Snow', 'Sparkle', 0, ['#b1b6bb', '#ffffff'], { interval: 0.1, lifetime: 0.5, fringe: 50, noise: 50, usePalette: false }),
  effect('Green Boas', 'Snakes', 0, ['#000000', '#32bf3c', '#bafa41', '#27fa7a'], { lengthMin: 5, lengthMax: 30, distanceMin: 5, distanceMax: 20, speed: 50, fringe: 0, noise: 0 }),
  effect('High Striker', 'Yo-yo', 0.8, ['#000000', '#0075ce', '#f3cf00'], { phase: 0, center: 50, steepness: 20 }),
  effect('Jellyfish', 'Jellyfish', 0, ['#6b35ff', '#ab82ff', '#ff9aff'], { count: 20, size: 50, speed: 50, fringe: 50, usePalette: true }),
  effect('K.I.T.T.', 'Scanner', 1, ['#000000', '#ff2600'], { length: 1, overshoot: 0, phase: 0, fringe: 50, noise: 0 }),
  effect('Meteor Shower', 'Meteor', 1.6, ['#000000', '#daf6ff', '#b2d0ff', '#ddd7ff'], { length: 2, distance: 19, phase: 0, trail: 60, usePalette: false }),
  effect('Paper Streamers', 'Snakes', 0, ['#000000', '#a7f401', '#ff3094', '#4dc9ff', '#edc703'], { lengthMin: 5, lengthMax: 20, distanceMin: 2, distanceMax: 8, speed: 25, fringe: 0, noise: 0 }),
  effect('Purple Rain', 'Rain', 1, ['#000000', '#bb3aff'], { length: 3, distance: 3, phase: 0, fringe: 100, noise: 75 }),
  effect('Ripple', 'Fire', 0, ['#040951', '#011279', '#9cfde1'], { speed: 0, sparking: 0, cooling: 75 }),
  effect('Scroll', 'Chase', 4, ['#ff496a', '#e7ad45', '#5ebabe'], { stepsPerSample: 3, phase: 0, timeOffset: 100, delay: 0, smoothness: 0 }),
  effect('Signals', 'Snakes', 0, ['#100436', '#c3ebff'], { lengthMin: 2, lengthMax: 5, distanceMin: 2, distanceMax: 8, speed: 25, fringe: 100, noise: 50 }),
  effect('Sparkle', 'Sparkle', 0, ['#000000', '#ff9300', '#fffb00', '#ffffff'], { interval: 0.2, lifetime: 1, fringe: 100, noise: 0, usePalette: true }),
  effect('Sweep', 'Chase', 5, ['#ff74a0', '#fe9c70', '#d2d100', '#00c9cb', '#009f95'], { stepsPerSample: 6, phase: 0, timeOffset: 100, delay: 0, smoothness: 0 }),
  effect('Waterfall', 'Chase', 5, ['#43ccff', '#21bbfe', '#0088fe', '#21bbfe', '#43ccff', '#6ecddb', '#eefeee', '#6ecddb'], { stepsPerSample: 1, phase: 0, timeOffset: 70, delay: 0, smoothness: 100 }),
  effect('Birthday Party', 'Curves', 10, [], { curveMode: 'HSB', hueTemplate: 'Sine', hueStart: 180, hueEnd: 360, saturation: 100, brightness: 100, white: 0, timeOffset: 17 }),
  effect('Pastel Rainbow', 'Curves', 10, [], { curveMode: 'HSB', hueTemplate: 'Ramp', hueStart: 0, hueEnd: 360, saturation: 50, brightness: 100, white: 0, timeOffset: 0 }),
  effect('Rainbow', 'Curves', 10, [], { curveMode: 'HSB', hueTemplate: 'Ramp', hueStart: 0, hueEnd: 360, saturation: 100, brightness: 100, white: 0, timeOffset: 0 }),
  effect('Rainbow Wave', 'Curves', 10, [], { curveMode: 'HSB', hueTemplate: 'Ramp', hueStart: 0, hueEnd: 360, saturation: 100, brightness: 100, white: 0, timeOffset: 3 }),
  effect('Treasure Flower', 'Curves', 10, [], { curveMode: 'HSB', hueTemplate: 'Sine', hueStart: 45, hueEnd: 90, saturation: 100, brightness: 100, white: 0, timeOffset: 5 }),
]

export const fixtureOrders = ['Left to Right', 'Right to Left', 'Top to Bottom', 'Bottom to Top', 'By Address, Ascending', 'By Address, Descending', 'Random (Fixed)', 'Random (Variable)']
export const colorEffectTypes = ['Chase', 'Scanner', 'Yo-yo', 'Fill', 'Rain', 'Meteor', 'Sparkle', 'Fire', 'Jellyfish', 'Snakes', 'Curves']

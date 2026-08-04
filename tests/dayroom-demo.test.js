const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const html = fs.readFileSync(
  new URL('../dayroom/dayroom-canvas-demo.html', `file://${__filename}`),
  'utf8',
)
const match = html.match(/<script>([\s\S]*?)<\/script>/)
assert.ok(match, 'expected an inline demo script')
assert.match(
  html,
  /const lightLayers = \[glowCanvas, shadowCanvas\]/,
  'reading-mode transition should include both light canvases',
)
assert.match(
  html,
  /snapshot\.getContext\('2d'\)\.drawImage\(layer, 0, 0\)/,
  'reading-mode transition should preserve the outgoing light frame',
)

const source = match[1].replace(
  /\n\s+render\(minute\)\n\s+\}\)\(\)\s*$/,
  '\n    })()',
)

const element = {
  addEventListener() {},
  getContext() { return {} },
  setAttribute() {},
  style: {},
  textContent: '',
  value: '',
}
const windowObject = {}
const context = {
  Date,
  Math,
  Object,
  addEventListener() {},
  console,
  document: {
    documentElement: { style: { setProperty() {} } },
    getElementById() { return element },
    hidden: false,
  },
  matchMedia() {
    return { addEventListener() {} }
  },
  setInterval() {},
  window: windowObject,
}

vm.runInNewContext(source, context)
const api = windowObject.__dayroomDemo
assert.ok(api, 'expected the demo diagnostics API')

const minimum = {
  accent: { minute: -1, ratio: Infinity },
  ink: { minute: -1, ratio: Infinity },
  muted: { minute: -1, ratio: Infinity },
}

for (let minute = 0; minute < 1440; minute += 1) {
  const color = api.colorAt(minute)
  for (const key of Object.keys(minimum)) {
    const ratio = api.contrastRatio(color[key], color.paper)
    if (ratio < minimum[key].ratio) {
      minimum[key] = { minute, ratio }
    }
  }
}

for (const [key, result] of Object.entries(minimum)) {
  const expected = key === 'accent' ? 3.2 : 4.5
  assert.ok(
    result.ratio >= expected,
    `${key} contrast fell below ${expected} at minute ${result.minute}: ${result.ratio}`,
  )
}

assert.equal(api.readingModeAt(369), 'night')
assert.equal(api.readingModeAt(370), 'day')
assert.equal(api.readingModeAt(1159), 'day')
assert.equal(api.readingModeAt(1160), 'night')

let modeChanges = 0
let previousMode = api.readingModeAt(0)
for (let minute = 0; minute < 1440; minute += 1) {
  const mode = api.readingModeAt(minute)
  if (mode !== previousMode) {
    modeChanges += 1
    previousMode = mode
  }
}

assert.equal(modeChanges, 2, 'reading mode should switch only at dawn and dusk')

for (const boundary of [370, 1160]) {
  const before = api.colorAt(boundary - 1).paper
  const after = api.colorAt(boundary).paper
  const largestChannelStep = Math.max(
    ...before.map((channel, index) => Math.abs(after[index] - channel)),
  )
  assert.ok(
    largestChannelStep <= 4,
    `paper should not jump at the reading-mode boundary ${boundary}`,
  )
}

const dawnBlueHour = api.colorAt(330).paper
const duskBlueHour = api.colorAt(1160).paper
assert.ok(dawnBlueHour[2] > dawnBlueHour[0] + 20, 'dawn should include a blue hour')
assert.ok(duskBlueHour[2] > duskBlueHour[0] + 20, 'dusk should include a blue hour')

const morning = api.lightAt(540)
const noon = api.lightAt(750)
const afternoon = api.lightAt(960)
for (const sample of [noon, afternoon]) {
  assert.equal(sample.slant, morning.slant, 'sunlight projection angle should stay fixed')
  assert.equal(sample.verticalSlant, morning.verticalSlant, 'sunlight vertical angle should stay fixed')
  assert.equal(sample.stretch, morning.stretch, 'sunlight projection size should stay fixed')
}
assert.ok(noon.alpha > morning.alpha, 'only the sunlight strength should increase toward noon')

const twilightMorning = api.twilightAt(330)
const twilightEvening = api.twilightAt(1170)
assert.ok(twilightMorning.intensity >= 0.5, 'dawn should retain a diffuse window projection')
assert.ok(twilightEvening.intensity >= 0.5, 'dusk should retain a diffuse window projection')
assert.equal(twilightMorning.slant, morning.slant, 'twilight should reuse the fixed window shape')
assert.equal(twilightEvening.stretch, morning.stretch, 'twilight should reuse the fixed window size')
assert.ok(
  api.perceptualStrength(0.1) > 0.2,
  'perceptual mapping should keep weak light visibly present',
)

for (const [start, end] of [[270, 420], [1080, 1230]]) {
  for (let minute = start; minute <= end; minute += 1) {
    const presence = Math.max(
      api.perceptualStrength(api.lightAt(minute).daylight),
      api.perceptualStrength(api.moonlightAt(minute).intensity),
      api.twilightAt(minute).intensity,
    )
    assert.ok(
      presence >= 0.4,
      `window projection disappeared near twilight at minute ${minute}: ${presence}`,
    )
  }
}

assert.equal(api.moonlightAt(750).intensity, 0)
assert.ok(api.moonlightAt(1260).intensity > 0.5)
assert.ok(api.moonlightAt(0).intensity > 0.7)
assert.equal(api.moonlightAt(0).slant, morning.slant, 'moonlight should reuse the fixed window shape')
assert.equal(api.moonlightAt(0).stretch, morning.stretch, 'moonlight should reuse the fixed window size')

process.stdout.write(
  `PASS: Dayroom 1440-minute contrast and light-model test ${JSON.stringify(minimum)}\n`,
)

const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const html = fs.readFileSync(
  new URL('../dayroom/dayroom-canvas-demo.html', `file://${__filename}`),
  'utf8',
)
const match = html.match(/<script>([\s\S]*?)<\/script>/)
assert.ok(match, 'expected an inline demo script')

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

const morning = api.lightAt(540)
const noon = api.lightAt(750)
const afternoon = api.lightAt(960)
for (const sample of [noon, afternoon]) {
  assert.equal(sample.slant, morning.slant, 'sunlight projection angle should stay fixed')
  assert.equal(sample.verticalSlant, morning.verticalSlant, 'sunlight vertical angle should stay fixed')
  assert.equal(sample.stretch, morning.stretch, 'sunlight projection size should stay fixed')
}
assert.ok(noon.alpha > morning.alpha, 'only the sunlight strength should increase toward noon')

assert.equal(api.moonlightAt(750).intensity, 0)
assert.ok(api.moonlightAt(1260).intensity > 0.5)
assert.ok(api.moonlightAt(0).intensity > 0.7)
assert.equal(api.moonlightAt(0).slant, morning.slant, 'moonlight should reuse the fixed window shape')
assert.equal(api.moonlightAt(0).stretch, morning.stretch, 'moonlight should reuse the fixed window size')

process.stdout.write(
  `PASS: Dayroom 1440-minute contrast and light-model test ${JSON.stringify(minimum)}\n`,
)

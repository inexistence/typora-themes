const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const moduleSource = fs.readFileSync(
  new URL('../canopy/canopy/canopy-module.js', `file://${__filename}`),
  'utf8',
)
const cssSource = fs.readFileSync(
  new URL('../canopy/canopy.css', `file://${__filename}`),
  'utf8',
)
const runtimeKey = Symbol.for('typora-themes-runtime@1')
const frames = []
const timers = []
const elements = []
const pendingPlays = []
const storedValues = new Map()
let factory = null
let fakeNow = Date.parse('2026-08-06T06:00:00Z')

class FakeDate extends Date {
  constructor(value) {
    super(value === undefined ? fakeNow : value)
  }

  static now() {
    return fakeNow
  }

  static parse(value) {
    return Date.parse(value)
  }

  static UTC(...values) {
    return Date.UTC(...values)
  }
}

function createStyle() {
  const properties = new Map()
  return {
    properties,
    setProperty(name, value) {
      properties.set(name, String(value))
    },
    getPropertyValue(name) {
      return properties.get(name) ?? ''
    },
    removeProperty(name) {
      properties.delete(name)
    },
  }
}

function createClassList() {
  const values = new Set()
  return {
    values,
    add(...names) {
      names.forEach(name => values.add(name))
    },
    remove(...names) {
      names.forEach(name => values.delete(name))
    },
    toggle(name, enabled) {
      if (enabled) {
        values.add(name)
      } else {
        values.delete(name)
      }
    },
    contains(name) {
      return values.has(name)
    },
  }
}

function createElement(tagName) {
  const listeners = new Map()
  const element = {
    tagName,
    id: '',
    className: '',
    classList: createClassList(),
    children: [],
    hidden: false,
    style: createStyle(),
    isConnected: false,
    setAttribute() {},
    append(...children) {
      this.children.push(...children)
      children.forEach(child => {
        child.isConnected = this.isConnected
      })
    },
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    dispatch(type) {
      listeners.get(type)?.()
    },
    remove() {
      this.isConnected = false
      this.children.forEach(child => child.remove())
    },
  }

  if (tagName === 'video') {
    Object.assign(element, {
      paused: true,
      readyState: 1,
      duration: 12,
      currentTime: 0,
      playbackRate: 1,
      play() {
        this.paused = false
        return new Promise((resolve, reject) => pendingPlays.push({ reject, resolve }))
      },
      pause() {
        this.paused = true
      },
    })
  }

  elements.push(element)
  return element
}

const root = {
  classList: createClassList(),
  style: createStyle(),
}

const document = {
  body: {
    append(element) {
      element.isConnected = true
      element.children.forEach(child => {
        child.isConnected = true
      })
    },
  },
  documentElement: root,
  createElement,
  getElementById(id) {
    return elements.find(element => element.isConnected && element.id === id) ?? null
  },
}

const window = {
  localStorage: {
    getItem(key) {
      return storedValues.get(key) ?? null
    },
    setItem(key, value) {
      storedValues.set(key, value)
    },
  },
  [runtimeKey]: {
    register(themeId, registeredFactory) {
      assert.equal(themeId, 'canopy')
      factory = registeredFactory
    },
  },
}

const context = {
  Date: FakeDate,
  HTMLMediaElement: { HAVE_CURRENT_DATA: 1 },
  Intl,
  Math,
  Number,
  Object,
  String,
  Symbol,
  URL,
  Array,
  cancelAnimationFrame(id) {
    const index = frames.findIndex(frame => frame.id === id)
    if (index >= 0) {
      frames.splice(index, 1)
    }
  },
  clearTimeout(id) {
    const timer = timers.find(item => item.id === id)
    if (timer) {
      timer.cleared = true
    }
  },
  document,
  requestAnimationFrame(callback) {
    const id = frames.length + 1
    frames.push({ callback, id })
    return id
  },
  setTimeout(callback, delay) {
    const id = timers.length + 1
    timers.push({ callback, delay, id, cleared: false })
    return id
  },
  window,
}

function flushFrames() {
  while (frames.length) {
    frames.shift().callback()
  }
}

function flushNextFrame() {
  frames.shift()?.callback()
}

function connected(id) {
  return elements.filter(element => element.isConnected && (!id || element.id === id))
}

function atmosphereLayerCount() {
  return connected().filter(element => element.className.includes('canopy-atmosphere-layer')).length
}

function parseColor(value) {
  const normalized = value.replace(/\s*!important\s*$/, '').trim()
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(normalized)?.[1]
  if (hex) {
    const expanded = hex.length === 3
      ? Array.from(hex, character => character.repeat(2)).join('')
      : hex
    return {
      alpha: 1,
      rgb: [0, 2, 4].map(index => Number.parseInt(expanded.slice(index, index + 2), 16)),
    }
  }
  const values = normalized.match(/[\d.]+/g).map(Number)
  return {
    alpha: values[3] ?? 1,
    rgb: values.slice(0, 3),
  }
}

function parseRgb(value) {
  return parseColor(value).rgb
}

function rootThemeTokens() {
  const rootBlock = cssSource.match(/:root\s*{([\s\S]*?)\n}/)?.[1] ?? ''
  return Object.fromEntries(
    Array.from(rootBlock.matchAll(/(--[\w-]+):\s*([^;]+);/g), match => [match[1], match[2]]),
  )
}

function printThemeDeclarations() {
  const printRootBlock = cssSource.match(/@media print\s*{\s*:root\s*{([\s\S]*?)\n  }/)?.[1] ?? ''
  return Object.fromEntries(
    Array.from(printRootBlock.matchAll(/(--[\w-]+):\s*([^;]+);/g), match => [match[1], match[2]]),
  )
}

function printThemeTokens() {
  return Object.fromEntries(Object.entries(printThemeDeclarations()).map(([property, value]) => [
    property,
    value.replace(/\s*!important\s*$/, ''),
  ]))
}

function tokenValue(tokens, property) {
  const value = tokens[property]
  const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
  return reference ? tokenValue(tokens, reference) : value
}

function tokenColor(tokens, property) {
  return parseColor(tokenValue(tokens, property))
}

function tokenRgb(tokens, property) {
  return tokenColor(tokens, property).rgb
}

function composite(foreground, background) {
  return foreground.rgb.map((channel, index) => (
    channel * foreground.alpha + background[index] * (1 - foreground.alpha)
  ))
}

function luminance(color) {
  const channels = color.map(channel => {
    const value = channel / 255
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(first, second) {
  const firstLuminance = luminance(first)
  const secondLuminance = luminance(second)
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05)
}

const INFORMATIVE_CONTRAST_PAIRS = [
  ['body', '--text-color', '--bg-color'],
  ['heading', '--heading-color', '--bg-color'],
  ['muted', '--muted-text-color', '--bg-color'],
  ['metadata', '--meta-content-color', '--surface-muted-color'],
  ['sidebar', '--side-bar-text-color', '--side-bar-bg-color'],
  ['active file', '--active-file-text-color', '--active-file-bg-color'],
  ['hover item', '--item-hover-text-color', '--item-hover-bg-color'],
  ['inline code', '--code-text-color', '--code-bg-color'],
  ['code body', '--code-fence-text-color', '--code-fence-bg-color'],
  ['code control', '--code-control-color', '--code-fence-bg-color'],
  ['active code tab', '--code-tab-active-text-color', '--code-tab-active-bg-color'],
  ['math body', '--math-editor-text-color', '--math-editor-bg-color'],
  ['math command', '--math-command-color', '--math-editor-bg-color'],
  ['math parameter', '--math-parameter-color', '--math-editor-bg-color'],
  ['math metadata', '--math-meta-color', '--math-editor-bg-color'],
  ['mark', '--mark-text-color', '--mark-bg-color'],
  ['tip', '--alert-tip-text-color', '--alert-tip-bg-color'],
  ['primary button', '--primary-btn-text-color', '--primary-color'],
  ...['comment', 'keyword', 'string', 'number', 'variable', 'operator', 'tag', 'error']
    .map(name => [`syntax ${name}`, `--syntax-${name}`, '--code-fence-bg-color']),
]

const TRANSLUCENT_ALERT_PAIRS = [
  ['note', '--alert-note-text-color', '--alert-note-bg-color'],
  ['important', '--alert-important-text-color', '--alert-important-bg-color'],
  ['warning', '--alert-warning-text-color', '--alert-warning-bg-color'],
  ['caution', '--alert-caution-text-color', '--alert-caution-bg-color'],
]

const TRANSLUCENT_ALERT_BORDER_PAIRS = [
  ['note border', '--alert-note-border-color', '--alert-note-bg-color'],
  ['important border', '--alert-important-border-color', '--alert-important-bg-color'],
  ['warning border', '--alert-warning-border-color', '--alert-warning-bg-color'],
  ['caution border', '--alert-caution-border-color', '--alert-caution-bg-color'],
]

const DECORATIVE_CONTRAST_PAIRS = [
  ['markdown marker', '--md-char-color', '--bg-color'],
  ['code gutter', '--code-gutter-color', '--code-fence-bg-color'],
  ['diagram line', '--diagram-line-color', '--diagram-bg-color'],
  ['diagram node border', '--diagram-node-border-color', '--diagram-node-bg-color'],
  ['primary accent', '--primary-color', '--bg-color'],
  ['active file border', '--active-file-border-color', '--active-file-bg-color'],
]

const PRINT_SEMANTIC_PROPERTIES = [
  '--bg-color', '--text-color', '--heading-color', '--muted-text-color',
  '--md-char-color', '--meta-content-color', '--primary-color',
  '--primary-btn-border-color', '--primary-btn-text-color', '--surface-color',
  '--surface-muted-color', '--surface-strong-color', '--surface-raised-color',
  '--border-color', '--border-soft-color', '--border-strong-color', '--divider-color',
  '--code-bg-color', '--code-text-color', '--code-fence-bg-color',
  '--code-fence-text-color', '--code-control-color', '--code-control-hover-bg-color',
  '--code-tab-active-bg-color', '--code-tab-active-text-color', '--code-border-color',
  '--code-gutter-color', '--code-cursor-color', '--code-active-line-color',
  '--code-selection-color', '--math-editor-bg-color', '--math-editor-text-color',
  '--math-command-color', '--math-parameter-color', '--math-meta-color',
  '--math-cursor-color', '--math-selection-color', '--diagram-bg-color',
  '--diagram-node-bg-color', '--diagram-node-border-color', '--diagram-line-color',
  '--diagram-label-bg-color', '--syntax-comment', '--syntax-keyword',
  '--syntax-string', '--syntax-number', '--syntax-variable', '--syntax-operator',
  '--syntax-tag', '--syntax-error', '--selection-color', '--shadow-color',
  '--shadow-strong-color', '--mark-bg-color', '--mark-text-color',
  '--table-header-text-color', '--quote-bg-color', '--quote-border-color',
  '--alert-note-bg-color', '--alert-note-border-color', '--alert-note-text-color',
  '--alert-tip-bg-color', '--alert-tip-border-color', '--alert-tip-text-color',
  '--alert-important-bg-color', '--alert-important-border-color',
  '--alert-important-text-color', '--alert-warning-bg-color',
  '--alert-warning-border-color', '--alert-warning-text-color',
  '--alert-caution-bg-color', '--alert-caution-border-color',
  '--alert-caution-text-color', '--side-bar-bg-color', '--side-bar-text-color',
  '--active-file-bg-color', '--active-file-text-color', '--active-file-border-color',
  '--item-hover-bg-color', '--item-hover-text-color', '--blur-text-color',
  '--canopy-text-edge-color', '--canopy-text-edge-radius',
  '--canopy-text-edge-opacity',
]

function assertSceneContrast(scene, label) {
  const tokens = scene.theme
  INFORMATIVE_CONTRAST_PAIRS.forEach(([name, foreground, background]) => {
    const ratio = contrast(tokenRgb(tokens, foreground), tokenRgb(tokens, background))
    assert.ok(ratio >= 4.5, `${name} contrast ${ratio.toFixed(3)} at ${label}`)
  })
  TRANSLUCENT_ALERT_PAIRS.forEach(([name, foreground, background]) => {
    const alertBackground = composite(tokenColor(tokens, background), tokenRgb(tokens, '--bg-color'))
    const ratio = contrast(tokenRgb(tokens, foreground), alertBackground)
    assert.ok(ratio >= 4.5, `${name} contrast ${ratio.toFixed(3)} at ${label}`)
  })
  TRANSLUCENT_ALERT_BORDER_PAIRS.forEach(([name, foreground, background]) => {
    const alertBackground = composite(tokenColor(tokens, background), tokenRgb(tokens, '--bg-color'))
    const ratio = contrast(tokenRgb(tokens, foreground), alertBackground)
    assert.ok(ratio >= 3, `${name} contrast ${ratio.toFixed(3)} at ${label}`)
  })
  DECORATIVE_CONTRAST_PAIRS.forEach(([name, foreground, background]) => {
    const ratio = contrast(tokenRgb(tokens, foreground), tokenRgb(tokens, background))
    assert.ok(ratio >= 3, `${name} contrast ${ratio.toFixed(3)} at ${label}`)
  })

  const paper = tokenRgb(tokens, '--bg-color')
  const maximumPossible = Math.max(contrast([0, 0, 0], paper), contrast([255, 255, 255], paper))
  if (maximumPossible >= 7) {
    const bodyContrast = contrast(tokenRgb(tokens, '--text-color'), paper)
    const headingContrast = contrast(tokenRgb(tokens, '--heading-color'), paper)
    assert.ok(bodyContrast >= 6.95, `body missed preferred contrast at ${label}`)
    assert.ok(headingContrast >= 6.95, `heading missed preferred contrast at ${label}`)
  }
}

async function main() {
  assert.match(
    cssSource,
    /body\s*{[^}]*--bg-color:\s*inherit\s*!important;[^}]*background-color:\s*var\(--bg-color\)\s*!important;[^}]*isolation:\s*isolate;/,
  )
  assertSceneContrast({ theme: rootThemeTokens() }, 'CSS fallback')
  vm.runInNewContext(moduleSource, context)
  assert.equal(typeof factory, 'function')
  assert.equal(typeof factory.sceneAt, 'function')

  const springNoon = factory.sceneAt(Date.parse('2026-03-20T04:00:00Z'))
  const summerEvening = factory.sceneAt(Date.parse('2026-06-21T10:45:00Z'))
  const autumnDawn = factory.sceneAt(Date.parse('2026-09-23T21:30:00Z'))
  const winterMidnight = factory.sceneAt(Date.parse('2026-12-21T16:00:00Z'))

  assert.equal(springNoon.season, 'spring')
  assert.equal(springNoon.mode, 'day')
  assert.equal(springNoon.phase, 'day')
  assert.ok(springNoon.solar.sunrise < springNoon.solar.noon)
  assert.ok(springNoon.solar.noon < springNoon.solar.sunset)
  assert.equal(summerEvening.season, 'summer')
  assert.ok(Number(summerEvening.atmosphere['--canopy-horizon-opacity']) > 0)
  assert.equal(autumnDawn.season, 'autumn')
  assert.ok(Number.parseFloat(autumnDawn.atmosphere['--canopy-sun-x']) < 50)
  assert.equal(winterMidnight.season, 'winter')
  assert.equal(winterMidnight.mode, 'night')
  assert.equal(winterMidnight.phase, 'night')
  assert.equal(winterMidnight.video['--canopy-shadow-opacity'], '0.620')
  assert.equal(winterMidnight.atmosphere['--canopy-season-opacity'], '0.270')
  assert.equal(winterMidnight.atmosphere['--canopy-ambient-opacity'], '0.250')
  assert.equal(winterMidnight.atmosphere['--canopy-ambient-bottom-opacity'], '0.240')
  assert.ok(Number(winterMidnight.atmosphere['--canopy-direct-opacity']) <= 0.15)
  assert.ok(Number(winterMidnight.atmosphere['--canopy-ambient-highlight-opacity']) <= 0.053)
  assert.equal(winterMidnight.atmosphere['--canopy-beam-opacity'], '0.020')
  assert.equal(winterMidnight.contrastMode, 'light-ink')
  assert.equal(winterMidnight.contrastGuard, 1)
  assert.equal(springNoon.contrastGuard, 1)
  assert.equal(springNoon.theme['--canopy-text-edge-radius'], '0.000px')
  assert.equal(springNoon.theme['--canopy-text-edge-opacity'], '0.000')

  const dawnRegression = factory.sceneAt(Date.parse('2026-04-04T21:45:00Z'))
  const duskRegression = factory.sceneAt(Date.parse('2026-11-04T09:00:00Z'))
  const independentModes = factory.sceneAt(Date.parse('2026-01-11T09:05:00Z'))
  const summerDawn = factory.sceneAt(Date.parse('2026-08-05T21:40:00Z'))
  assertSceneContrast(dawnRegression, '2026-04-05 05:45')
  assertSceneContrast(duskRegression, '2026-11-04 17:00')
  assertSceneContrast(summerDawn, '2026-08-06 05:40')
  assert.equal(independentModes.mode, 'day')
  assert.equal(independentModes.contrastMode, 'light-ink')
  assert.equal(summerDawn.phase, 'dawn')
  assert.ok(summerDawn.contrastGuard <= 0.25)
  assert.ok(Number(summerDawn.atmosphere['--canopy-season-opacity']) <= 0.2)
  assert.ok(Number(summerDawn.atmosphere['--canopy-ambient-opacity']) <= 0.2)
  assert.ok(Number(summerDawn.atmosphere['--canopy-direct-opacity']) <= 0.28)
  assert.ok(Number(summerDawn.atmosphere['--canopy-horizon-opacity']) <= 0.2)
  assert.ok(Number(summerDawn.video['--canopy-shadow-opacity']) <= 0.48)
  assert.ok(Number.parseFloat(summerDawn.theme['--canopy-text-edge-radius']) > 0.5)
  assert.ok(Number(summerDawn.theme['--canopy-text-edge-opacity']) > 0.25)
  assert.ok(dawnRegression.contrastGuard < springNoon.contrastGuard)
  assert.ok(Number(dawnRegression.atmosphere['--canopy-ambient-opacity']) < 0.2)
  assert.ok(Number(dawnRegression.video['--canopy-shadow-opacity']) < 0.5)

  const printDeclarations = printThemeDeclarations()
  PRINT_SEMANTIC_PROPERTIES.forEach(property => {
    assert.match(printDeclarations[property] ?? '', /!important\s*$/, `${property} print override`)
  })
  assertSceneContrast({
    theme: { ...winterMidnight.theme, ...printThemeTokens() },
  }, 'winter midnight print')

  for (let day = 0; day < 365; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const scene = factory.sceneAt(Date.UTC(2026, 0, day + 1, hour - 8))
      assertSceneContrast(scene, `${scene.dateKey} ${hour}:00`)
      assert.ok(scene.contrastGuard >= 0 && scene.contrastGuard <= 1)
      assert.ok(['dark-ink', 'light-ink'].includes(scene.contrastMode))
      assert.ok(['night', 'dawn', 'day', 'dusk'].includes(scene.phase))
      assert.ok(!Object.values(scene.atmosphere).some(value => String(value).includes('NaN')))
    }
  }

  for (let month = 0; month < 12; month += 1) {
    let contrastModeChanges = 0
    let previousContrastMode = ''
    for (let minute = 0; minute < 1440; minute += 1) {
      const scene = factory.sceneAt(Date.UTC(2026, month, 21, 0, minute - 480))
      assertSceneContrast(scene, `${scene.dateKey} minute ${minute}`)
      if (previousContrastMode && previousContrastMode !== scene.contrastMode) {
        contrastModeChanges += 1
      }
      previousContrastMode = scene.contrastMode
    }
    assert.equal(contrastModeChanges, 2, `contrast mode should flip twice in month ${month + 1}`)
  }

  const visibleContext = { hidden: false, reducedMotion: false }
  const first = factory({
    context: visibleContext,
    themesBaseUrl: 'file:///tmp/user/themes/',
  })
  assert.equal(atmosphereLayerCount(), 6)
  assert.notEqual(root.style.getPropertyValue('--bg-color'), '')
  assert.equal(typeof window.__canopyDebug, 'object')
  const cachedPrepaint = JSON.parse(storedValues.get('typora-themes-prepaint:canopy'))
  assert.equal(cachedPrepaint.version, 1)
  assert.equal(cachedPrepaint.properties['--bg-color'], root.style.getPropertyValue('--bg-color'))
  assert.ok(cachedPrepaint.rootClasses.includes('canopy-starting'))
  assert.ok(root.classList.contains('canopy-contrast-flip'))
  assert.ok(root.classList.contains('canopy-starting'))

  while (!connected(VIDEO_ID).length && frames.length) {
    flushNextFrame()
  }
  const startupVideo = connected(VIDEO_ID)[0]
  assert.ok(startupVideo)
  const startupVideoLayer = connected(VIDEO_LAYER_ID)[0]
  assert.ok(startupVideoLayer)
  assert.equal(startupVideoLayer.style.mixBlendMode, 'multiply')
  assert.ok(root.classList.contains('canopy-video-active'))
  assert.equal(startupVideoLayer.style.opacity, 'var(--canopy-shadow-opacity, 0.78)')
  flushFrames()
  assert.equal(root.classList.contains('canopy-contrast-flip'), false)
  assert.equal(root.classList.contains('canopy-starting'), false)
  assert.equal(startupVideoLayer.style.opacity, 'var(--canopy-shadow-opacity, 0.78)')

  const debug = window.__canopyDebug
  debug.preset('winter-midnight')
  assert.equal(debug.getScene().mode, 'night')
  assert.ok(root.classList.contains('canopy-night'))
  assert.ok(root.classList.contains('canopy-contrast-flip'))
  flushFrames()
  assert.equal(root.classList.contains('canopy-contrast-flip'), false)
  debug.show()
  assert.equal(connected('canopy-debug-hud').length, 1)
  const debugSpeed = connected().find(element => element.className === 'canopy-debug-speed')
  const minuteSpeed = debugSpeed.children.find(option => option.value === '1440')
  assert.equal(minuteSpeed.textContent, '1440 秒/天（1 秒 = 1 分钟）')
  debug.play({ dayDurationSeconds: 60 })
  assert.equal(debug.getState().playing, true)
  assert.ok(root.classList.contains('canopy-debug-playing'))
  const previewStart = debug.getState().timestamp
  fakeNow += 1000
  const previewTick = timers.find(timer => !timer.cleared && timer.delay === 250)
  assert.ok(previewTick)
  previewTick.callback()
  assert.equal(debug.getState().timestamp - previewStart, 24 * 60_000)
  debug.pause()
  assert.equal(debug.getState().playing, false)
  assert.equal(root.classList.contains('canopy-debug-playing'), false)
  debug.play({ dayDurationSeconds: 1440 })
  assert.equal(debug.getState().dayDurationSeconds, 1440)
  const minutePreviewStart = debug.getState().timestamp
  fakeNow += 1000
  const minutePreviewTick = timers.find(timer => !timer.cleared && timer.delay === 250)
  assert.ok(minutePreviewTick)
  minutePreviewTick.callback()
  assert.equal(debug.getState().timestamp - minutePreviewStart, 60_000)
  debug.pause()
  debug.preset('winter-midnight')
  debug.stepMinutes(90)
  assert.equal(debug.getState().timestamp, Date.parse('2026-12-21T17:30:00Z'))
  debug.reset()
  assert.equal(debug.getState().timestamp, null)

  flushFrames()
  assert.equal(connected(VIDEO_ID).length, 1)
  const firstVideo = connected(VIDEO_ID)[0]
  firstVideo.dispatch('playing')
  assert.ok(root.classList.contains('canopy-video-active'))

  first.update(visibleContext)
  first.update(visibleContext)
  flushFrames()
  assert.equal(atmosphereLayerCount(), 6)
  assert.equal(connected(VIDEO_ID).length, 1)

  first.update({ hidden: false, reducedMotion: true })
  flushFrames()
  assert.equal(firstVideo.paused, true)
  assert.equal(root.classList.contains('canopy-video-active'), false)

  debug.preset('winter-midnight')
  assert.ok(root.classList.contains('canopy-contrast-flip'))
  first.update(visibleContext)
  flushNextFrame()
  assert.equal(root.classList.contains('canopy-video-active'), false)
  first.destroy()
  flushFrames()
  assert.equal(connected().length, 0)
  assert.equal(root.style.getPropertyValue('--bg-color'), '')
  assert.equal(root.style.getPropertyValue('--side-bar-text-color'), '')
  assert.equal(root.style.getPropertyValue('--canopy-text-edge-opacity'), '')
  assert.equal(root.classList.contains('canopy-night'), false)
  assert.equal(root.classList.contains('canopy-contrast-flip'), false)
  assert.equal(window.__canopyDebug, undefined)

  const second = factory({
    context: visibleContext,
    themesBaseUrl: 'file:///tmp/user/themes/',
  })
  flushFrames()
  const secondVideo = connected(VIDEO_ID)[0]
  secondVideo.dispatch('playing')
  assert.ok(root.classList.contains('canopy-video-active'))

  pendingPlays[0].reject(new Error('late rejection from destroyed Canopy instance'))
  await Promise.resolve()
  assert.ok(
    root.classList.contains('canopy-video-active'),
    'a destroyed instance changed the active Canopy instance state',
  )

  second.destroy()
  process.stdout.write('PASS: Canopy scene and lifecycle tests\n')
}

const VIDEO_ID = 'canopy-leaves-overlay'
const VIDEO_LAYER_ID = 'canopy-video-layer'

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

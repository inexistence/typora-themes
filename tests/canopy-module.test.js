const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const moduleSource = fs.readFileSync(
  new URL('../canopy/canopy/canopy-module.js', `file://${__filename}`),
  'utf8',
)
const runtimeKey = Symbol.for('typora-themes-runtime@1')
const frames = []
const timers = []
const elements = []
const pendingPlays = []
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
    },
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    dispatch(type) {
      listeners.get(type)?.()
    },
    remove() {
      this.isConnected = false
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
    },
  },
  documentElement: root,
  createElement,
  getElementById(id) {
    return elements.find(element => element.isConnected && element.id === id) ?? null
  },
}

const window = {
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

function connected(id) {
  return elements.filter(element => element.isConnected && (!id || element.id === id))
}

function atmosphereLayerCount() {
  return connected().filter(element => element.className.includes('canopy-atmosphere-layer')).length
}

function parseRgb(value) {
  return value.match(/\d+/g).slice(0, 3).map(Number)
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

async function main() {
  vm.runInNewContext(moduleSource, context)
  assert.equal(typeof factory, 'function')
  assert.equal(typeof factory.sceneAt, 'function')

  const springNoon = factory.sceneAt(Date.parse('2026-03-20T04:00:00Z'))
  const summerEvening = factory.sceneAt(Date.parse('2026-06-21T10:45:00Z'))
  const autumnDawn = factory.sceneAt(Date.parse('2026-09-23T21:30:00Z'))
  const winterMidnight = factory.sceneAt(Date.parse('2026-12-21T16:00:00Z'))

  assert.equal(springNoon.season, 'spring')
  assert.equal(springNoon.mode, 'day')
  assert.ok(springNoon.solar.sunrise < springNoon.solar.noon)
  assert.ok(springNoon.solar.noon < springNoon.solar.sunset)
  assert.equal(summerEvening.season, 'summer')
  assert.ok(Number(summerEvening.atmosphere['--canopy-horizon-opacity']) > 0)
  assert.equal(autumnDawn.season, 'autumn')
  assert.ok(Number.parseFloat(autumnDawn.atmosphere['--canopy-sun-x']) < 50)
  assert.equal(winterMidnight.season, 'winter')
  assert.equal(winterMidnight.mode, 'night')
  assert.equal(winterMidnight.video['--canopy-shadow-opacity'], '0.620')
  assert.equal(winterMidnight.atmosphere['--canopy-season-opacity'], '0.27')
  assert.equal(winterMidnight.atmosphere['--canopy-ambient-opacity'], '0.250')
  assert.equal(winterMidnight.atmosphere['--canopy-ambient-bottom-opacity'], '0.240')
  assert.ok(Number(winterMidnight.atmosphere['--canopy-direct-opacity']) <= 0.15)
  assert.ok(Number(winterMidnight.atmosphere['--canopy-ambient-highlight-opacity']) <= 0.053)
  assert.equal(winterMidnight.atmosphere['--canopy-beam-opacity'], '0.020')

  for (const month of [0, 2, 5, 8, 11]) {
    for (let hour = 0; hour < 24; hour += 2) {
      const scene = factory.sceneAt(Date.UTC(2026, month, 21, hour - 8))
      const paper = parseRgb(scene.theme['--bg-color'])
      const text = parseRgb(scene.theme['--text-color'])
      assert.ok(contrast(paper, text) >= 4.5, `low text contrast at month ${month + 1}, hour ${hour}`)
      assert.ok(!Object.values(scene.atmosphere).some(value => String(value).includes('NaN')))
    }
  }

  const visibleContext = { hidden: false, reducedMotion: false }
  const first = factory({
    context: visibleContext,
    themesBaseUrl: 'file:///tmp/user/themes/',
  })
  assert.equal(atmosphereLayerCount(), 6)
  assert.notEqual(root.style.getPropertyValue('--bg-color'), '')
  assert.equal(typeof window.__canopyDebug, 'object')

  const debug = window.__canopyDebug
  debug.preset('winter-midnight')
  assert.equal(debug.getScene().mode, 'night')
  assert.ok(root.classList.contains('canopy-night'))
  debug.show()
  assert.equal(connected('canopy-debug-hud').length, 1)
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

  first.destroy()
  assert.equal(connected().length, 0)
  assert.equal(root.style.getPropertyValue('--bg-color'), '')
  assert.equal(root.classList.contains('canopy-night'), false)
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

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

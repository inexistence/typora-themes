const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const moduleSource = fs.readFileSync(
  new URL('../sunlit/sunlit/sunlit-module.js', `file://${__filename}`),
  'utf8',
)
const runtimeKey = Symbol.for('typora-themes-runtime@1')
const frames = []
const videos = []
const activeClasses = new Set()
const pendingPlays = []
let factory = null

function createVideo() {
  const listeners = new Map()
  return {
    isConnected: false,
    paused: true,
    readyState: 1,
    style: {},
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    setAttribute() {},
    play() {
      this.paused = false
      return new Promise((resolve, reject) => pendingPlays.push({ reject, resolve }))
    },
    pause() {
      this.paused = true
    },
    remove() {
      this.isConnected = false
    },
  }
}

const document = {
  body: {
    append(video) {
      video.isConnected = true
      videos.push(video)
    },
  },
  documentElement: {
    classList: {
      toggle(name, enabled) {
        if (enabled) {
          activeClasses.add(name)
        } else {
          activeClasses.delete(name)
        }
      },
    },
  },
  createElement(tagName) {
    assert.equal(tagName, 'video')
    return createVideo()
  },
  getElementById() {
    return videos.find(video => video.isConnected) ?? null
  },
}

const window = {
  [runtimeKey]: {
    register(themeId, registeredFactory) {
      assert.equal(themeId, 'sunlit')
      factory = registeredFactory
    },
  },
}

const context = {
  HTMLMediaElement: { HAVE_CURRENT_DATA: 1 },
  Object,
  Symbol,
  URL,
  cancelAnimationFrame() {},
  document,
  requestAnimationFrame(callback) {
    frames.push(callback)
    return frames.length
  },
  window,
}

function flushFrame() {
  const callback = frames.shift()
  assert.ok(callback, 'expected a scheduled animation frame')
  callback()
}

async function main() {
  vm.runInNewContext(moduleSource, context)
  assert.equal(typeof factory, 'function')

  const moduleContext = { hidden: false, reducedMotion: false }
  const first = factory({
    context: moduleContext,
    themesBaseUrl: 'file:///tmp/user/themes/',
  })
  first.update(moduleContext)
  flushFrame()
  assert.ok(activeClasses.has('sunlit-video-active'))

  first.destroy()
  const second = factory({
    context: moduleContext,
    themesBaseUrl: 'file:///tmp/user/themes/',
  })
  second.update(moduleContext)
  flushFrame()
  assert.ok(activeClasses.has('sunlit-video-active'))

  pendingPlays[0].reject(new Error('late rejection from old video'))
  await Promise.resolve()
  assert.ok(
    activeClasses.has('sunlit-video-active'),
    'a destroyed instance changed the active instance state',
  )

  second.destroy()
  process.stdout.write('PASS: Sunlit stale playback callback test\n')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

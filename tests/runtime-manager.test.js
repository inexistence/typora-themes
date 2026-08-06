const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const runtimeSource = fs.readFileSync(
  new URL('../runtime/typora-themes-runtime.js', `file://${__filename}`),
  'utf8',
)
const runtimeKey = Symbol.for('typora-themes-runtime@1')
const configKey = Symbol.for('typora-themes-runtime-config@1')
const frames = []
const observers = []
const moduleScripts = []
const factories = new Map()
const lifecycle = []
let themeId = 'folio'
let nextFrame = 0

class FakeScript {
  constructor() {
    this.dataset = {}
    this.listeners = new Map()
    this.src = ''
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener)
  }

  emit(type) {
    this.listeners.get(type)?.()
  }

  remove() {
    const index = moduleScripts.indexOf(this)
    if (index >= 0) {
      moduleScripts.splice(index, 1)
    }
  }
}

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback
    observers.push(this)
  }

  observe() {}

  disconnect() {}
}

class FakeHTMLLinkElement {}

const mediaListeners = new Set()
const media = {
  matches: false,
  addEventListener(type, listener) {
    if (type === 'change') {
      mediaListeners.add(listener)
    }
  },
  removeEventListener(type, listener) {
    if (type === 'change') {
      mediaListeners.delete(listener)
    }
  },
}
const documentListeners = new Map()
const windowListeners = new Map()

const document = {
  body: {},
  currentScript: { src: 'file:///tmp/user/themes/typora-themes-runtime.js' },
  documentElement: {},
  head: {
    append(script) {
      moduleScripts.push(script)
      queueMicrotask(() => {
        const id = script.dataset.typoraThemeModule
        window[runtimeKey].register(id, factories.get(id))
        script.emit('load')
      })
    },
  },
  hidden: false,
  addEventListener(type, listener) {
    documentListeners.set(type, listener)
  },
  removeEventListener(type) {
    documentListeners.delete(type)
  },
  createElement(tagName) {
    assert.equal(tagName, 'script')
    return new FakeScript()
  },
  querySelectorAll(selector) {
    assert.equal(selector, 'script[data-typora-theme-module]')
    return [...moduleScripts]
  },
}

const window = {
  addEventListener(type, listener) {
    windowListeners.set(type, listener)
  },
  removeEventListener(type) {
    windowListeners.delete(type)
  },
  matchMedia() {
    return media
  },
}
window[configKey] = Object.freeze({
  folio: 'folio/folio-module.js',
  sunlit: 'sunlit/sunlit-module.js',
  canopy: 'canopy/canopy-module.js',
})

function moduleFactory(name) {
  return ({ context, themesBaseUrl }) => {
    lifecycle.push(`create:${name}:${context.hidden}:${themesBaseUrl}`)
    return {
      update(nextContext) {
        lifecycle.push(`update:${name}:${nextContext.reducedMotion}`)
      },
      destroy() {
        lifecycle.push(`destroy:${name}`)
      },
    }
  }
}

factories.set('folio', moduleFactory('folio'))
factories.set('sunlit', moduleFactory('sunlit'))
factories.set('canopy', moduleFactory('canopy'))

const context = {
  HTMLLinkElement: FakeHTMLLinkElement,
  MutationObserver: FakeMutationObserver,
  Symbol,
  URL,
  cancelAnimationFrame(id) {
    const index = frames.findIndex(frame => frame.id === id)
    if (index >= 0) {
      frames.splice(index, 1)
    }
  },
  console,
  document,
  getComputedStyle() {
    return {
      getPropertyValue(property) {
        if (property === '--typora-theme-id') {
          return themeId
        }
        return ''
      },
    }
  },
  queueMicrotask,
  requestAnimationFrame(callback) {
    const id = ++nextFrame
    frames.push({ callback, id })
    return id
  },
  window,
}

async function settle() {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve()
    const pending = frames.splice(0)
    pending.forEach(frame => frame.callback())
  }
}

async function main() {
  vm.runInNewContext(runtimeSource, context)
  await settle()

  assert.equal(moduleScripts.length, 1)
  assert.match(moduleScripts[0].src, /folio\/folio-module\.js$/)
  assert.equal(lifecycle.filter(item => item.startsWith('create:folio')).length, 1)

  themeId = 'sunlit'
  observers.forEach(observer => observer.callback())
  await settle()
  assert.equal(lifecycle.filter(item => item === 'destroy:folio').length, 1)
  assert.equal(lifecycle.filter(item => item.startsWith('create:sunlit')).length, 1)
  assert.equal(moduleScripts.length, 2)
  assert.match(moduleScripts[1].src, /sunlit\/sunlit-module\.js$/)

  media.matches = true
  mediaListeners.forEach(listener => listener())
  await settle()
  assert.ok(lifecycle.includes('update:sunlit:true'))

  themeId = 'canopy'
  observers.forEach(observer => observer.callback())
  await settle()
  assert.equal(lifecycle.filter(item => item === 'destroy:sunlit').length, 1)
  assert.equal(lifecycle.filter(item => item.startsWith('create:canopy')).length, 1)
  assert.equal(moduleScripts.length, 3)
  assert.match(moduleScripts[2].src, /canopy\/canopy-module\.js$/)

  themeId = ''
  observers.forEach(observer => observer.callback())
  await settle()
  assert.equal(lifecycle.filter(item => item === 'destroy:canopy').length, 1)

  window[runtimeKey].destroy()
  assert.equal(moduleScripts.length, 0)
  assert.equal(window[runtimeKey], undefined)
  assert.equal(window[configKey], undefined)

  process.stdout.write('PASS: shared runtime lifecycle test\n')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

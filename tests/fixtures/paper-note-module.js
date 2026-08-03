(() => {
  'use strict'

  const runtime = window[Symbol.for('typora-themes-runtime@1')]
  if (!runtime?.register) {
    return
  }

  runtime.register('paper-note', () => ({
    update() {},
    destroy() {},
  }))
})()

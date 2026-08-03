/*
 * Typora Themes Runtime
 * One shared lifecycle manager for optional theme enhancements.
 */

(() => {
  'use strict'

  const RUNTIME_KEY = Symbol.for('typora-themes-runtime@1')
  const CONFIG_KEY = Symbol.for('typora-themes-runtime-config@1')
  if (window[RUNTIME_KEY]) {
    return
  }

  const scriptUrl = document.currentScript?.src ?? ''
  if (!scriptUrl) {
    return
  }

  const themesBaseUrl = new URL('.', scriptUrl).href
  const configuredModules = window[CONFIG_KEY]
  const moduleFiles = Object.freeze(
    configuredModules && typeof configuredModules === 'object'
      ? { ...configuredModules }
      : {},
  )
  const factories = new Map()
  const pendingLoads = new Map()
  const failedLoads = new Set()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  let activeTheme = ''
  let activeInstance = null
  let scheduledFrame = 0
  let revision = 0
  let destroyed = false

  function report(message, error) {
    console.warn(`[Typora Themes] ${message}`, error)
  }

  function readThemeId() {
    const style = getComputedStyle(document.documentElement)
    const explicit = style.getPropertyValue('--typora-theme-id').trim()
    if (Object.prototype.hasOwnProperty.call(moduleFiles, explicit)) {
      return explicit
    }
    if (style.getPropertyValue('--folio-enhancer-enabled').trim() === '1') {
      return 'folio'
    }
    if (style.getPropertyValue('--sunlit-enhancer-enabled').trim() === '1') {
      return 'sunlit'
    }
    return ''
  }

  function currentContext() {
    return Object.freeze({
      hidden: document.hidden,
      reducedMotion: reducedMotion.matches,
    })
  }

  function destroyActive() {
    const instance = activeInstance
    activeInstance = null
    activeTheme = ''
    try {
      instance?.destroy?.()
    } catch (error) {
      report('Failed to destroy the active theme module.', error)
    }
  }

  function updateActive(context) {
    try {
      activeInstance?.update?.(context)
      return true
    } catch (error) {
      report('Failed to update the active theme module.', error)
      destroyActive()
      return false
    }
  }

  function loadModule(themeId) {
    if (factories.has(themeId)) {
      return Promise.resolve()
    }
    if (failedLoads.has(themeId)) {
      return Promise.reject(new Error(`Theme module unavailable: ${themeId}`))
    }
    if (pendingLoads.has(themeId)) {
      return pendingLoads.get(themeId)
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = new URL(moduleFiles[themeId], themesBaseUrl).href
      script.async = true
      script.dataset.typoraThemeModule = themeId
      script.addEventListener('load', () => {
        pendingLoads.delete(themeId)
        if (factories.has(themeId)) {
          resolve()
        } else {
          failedLoads.add(themeId)
          reject(new Error(`Theme module did not register: ${themeId}`))
        }
      }, { once: true })
      script.addEventListener('error', () => {
        pendingLoads.delete(themeId)
        failedLoads.add(themeId)
        reject(new Error(`Failed to load theme module: ${themeId}`))
      }, { once: true })
      document.head.append(script)
    })

    pendingLoads.set(themeId, promise)
    return promise
  }

  async function reconcile(expectedRevision) {
    scheduledFrame = 0
    if (destroyed || expectedRevision !== revision) {
      return
    }

    const desiredTheme = readThemeId()
    const context = currentContext()
    if (desiredTheme === activeTheme && activeInstance) {
      updateActive(context)
      return
    }

    destroyActive()
    if (!desiredTheme) {
      return
    }

    try {
      await loadModule(desiredTheme)
    } catch (error) {
      report(`Failed to load the ${desiredTheme} theme module.`, error)
      return
    }
    if (destroyed || expectedRevision !== revision || readThemeId() !== desiredTheme) {
      return
    }

    const factory = factories.get(desiredTheme)
    if (!factory) {
      return
    }
    try {
      activeInstance = factory({
        context: currentContext(),
        themesBaseUrl,
      }) ?? null
      activeTheme = activeInstance ? desiredTheme : ''
      updateActive(currentContext())
    } catch (error) {
      report(`Failed to start the ${desiredTheme} theme module.`, error)
      destroyActive()
    }
  }

  function scheduleReconcile() {
    revision += 1
    if (!scheduledFrame && !destroyed) {
      scheduledFrame = requestAnimationFrame(() => reconcile(revision))
    }
  }

  function notifyContextChange() {
    updateActive(currentContext())
    scheduleReconcile()
  }

  function onResourceLoad(event) {
    if (event.target instanceof HTMLLinkElement
      && event.target.matches('link[rel~="stylesheet"]')) {
      scheduleReconcile()
    }
  }

  const observer = new MutationObserver(scheduleReconcile)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style'],
  })
  if (document.head) {
    observer.observe(document.head, {
      attributes: true,
      attributeFilter: ['disabled', 'href', 'rel'],
      childList: true,
      subtree: true,
    })
  }

  document.addEventListener('visibilitychange', notifyContextChange)
  document.addEventListener('load', onResourceLoad, true)
  window.addEventListener('pageshow', notifyContextChange)
  window.addEventListener('focus', notifyContextChange)
  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener('change', notifyContextChange)
  } else {
    reducedMotion.addListener?.(notifyContextChange)
  }

  window[RUNTIME_KEY] = {
    register(themeId, factory) {
      if (Object.prototype.hasOwnProperty.call(moduleFiles, themeId)
        && typeof factory === 'function') {
        factories.set(themeId, factory)
        failedLoads.delete(themeId)
        scheduleReconcile()
      }
    },
    destroy() {
      destroyed = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', notifyContextChange)
      document.removeEventListener('load', onResourceLoad, true)
      window.removeEventListener('pageshow', notifyContextChange)
      window.removeEventListener('focus', notifyContextChange)
      if (reducedMotion.removeEventListener) {
        reducedMotion.removeEventListener('change', notifyContextChange)
      } else {
        reducedMotion.removeListener?.(notifyContextChange)
      }
      if (scheduledFrame) {
        cancelAnimationFrame(scheduledFrame)
      }
      destroyActive()
      document.querySelectorAll('script[data-typora-theme-module]').forEach(script => script.remove())
      delete window[RUNTIME_KEY]
      delete window[CONFIG_KEY]
    },
  }

  scheduleReconcile()
})()

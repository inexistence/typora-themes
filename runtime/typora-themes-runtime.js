/*
 * Typora Themes Runtime
 * One shared lifecycle manager for optional theme enhancements.
 */

(() => {
  'use strict'

  const RUNTIME_KEY = Symbol.for('typora-themes-runtime@1')
  const CONFIG_KEY = Symbol.for('typora-themes-runtime-config@1')
  const PREPAINT_PREFIX = 'typora-themes-prepaint:'
  const PREPAINT_VERSION = 1
  const PREPAINT_MAX_AGE_MS = 30 * 60 * 1000
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
  let activePrepaint = null

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

  function applyCachedPrepaint(themeId) {
    if (!themeId) {
      return
    }
    try {
      const cached = JSON.parse(window.localStorage?.getItem(`${PREPAINT_PREFIX}${themeId}`) ?? 'null')
      const cacheAge = Date.now() - cached?.savedAt
      if (cached?.version !== PREPAINT_VERSION
        || !Number.isFinite(cacheAge)
        || cacheAge < 0
        || cacheAge > PREPAINT_MAX_AGE_MS
        || !cached.properties
        || typeof cached.properties !== 'object') {
        return
      }
      const appliedProperties = []
      const appliedRootClasses = []
      Object.entries(cached.properties).forEach(([property, value]) => {
        if (property.startsWith('--') && typeof value === 'string') {
          document.documentElement.style.setProperty(property, value)
          appliedProperties.push(property)
        }
      })
      if (Array.isArray(cached.rootClasses)) {
        cached.rootClasses.forEach(className => {
          if (typeof className === 'string' && /^[a-z0-9-]+$/.test(className)) {
            document.documentElement.classList.add(className)
            appliedRootClasses.push(className)
          }
        })
      }
      activePrepaint = {
        themeId,
        properties: appliedProperties,
        rootClasses: appliedRootClasses,
      }
    } catch {
      /* Storage can be unavailable for file origins; the CSS fallback remains. */
    }
  }

  function clearCachedPrepaint() {
    if (!activePrepaint) {
      return
    }
    activePrepaint.properties.forEach(property => {
      document.documentElement.style.removeProperty(property)
    })
    activePrepaint.rootClasses.forEach(className => {
      document.documentElement.classList.remove(className)
    })
    activePrepaint = null
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
    if (activePrepaint && activePrepaint.themeId !== desiredTheme) {
      clearCachedPrepaint()
    }
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
      if (activePrepaint?.themeId === desiredTheme) {
        clearCachedPrepaint()
      }
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
      if (activeInstance && activePrepaint?.themeId === desiredTheme) {
        activePrepaint = null
      }
      updateActive(currentContext())
    } catch (error) {
      report(`Failed to start the ${desiredTheme} theme module.`, error)
      if (activePrepaint?.themeId === desiredTheme) {
        clearCachedPrepaint()
      }
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
        const resolvesPendingLoad = pendingLoads.has(themeId)
        factories.set(themeId, factory)
        failedLoads.delete(themeId)
        /* The reconcile already awaiting this script can create the instance
         * immediately. Scheduling another frame here would deliberately paint
         * one frame of the static fallback before every enhanced theme. */
        if (!resolvesPendingLoad) {
          scheduleReconcile()
        }
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
      clearCachedPrepaint()
      destroyActive()
      document.querySelectorAll('script[data-typora-theme-module]').forEach(script => script.remove())
      delete window[RUNTIME_KEY]
      delete window[CONFIG_KEY]
    },
  }

  /* Start before the first rendering opportunity. Later changes still use
   * scheduleReconcile() so bursts of theme and visibility events are merged. */
  const initialTheme = readThemeId()
  applyCachedPrepaint(initialTheme)
  revision += 1
  void reconcile(revision)
})()

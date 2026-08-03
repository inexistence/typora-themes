/*
 * Sunlit Enhancer (experimental)
 * Injects the local dappled-light video only while the Sunlit theme is active.
 */

(() => {
  'use strict'

  const INSTANCE_KEY = Symbol.for('sunlit-enhancer@1')
  if (window[INSTANCE_KEY]) {
    return
  }

  const ENABLE_PROPERTY = '--sunlit-enhancer-enabled'
  const ACTIVE_CLASS = 'sunlit-video-active'
  const VIDEO_ID = 'sunlit-leaves-overlay'
  const scriptUrl = document.currentScript?.src ?? ''
  const videoUrl = scriptUrl
    ? new URL('sunlit/leaves.mp4', scriptUrl).href
    : ''
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  let video = null
  let scheduledFrame = 0
  let destroyed = false

  function isEnabled() {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(ENABLE_PROPERTY)
      .trim() === '1'
  }

  function shouldPlay() {
    return Boolean(videoUrl)
      && isEnabled()
      && !document.hidden
      && !reducedMotion.matches
  }

  function setActive(active) {
    document.documentElement.classList.toggle(ACTIVE_CLASS, active)
    if (video) {
      video.style.opacity = active
        ? 'var(--sunlit-shadow-opacity, 0.78)'
        : '0'
    }
  }

  function ensureVideo() {
    if (video?.isConnected) {
      return video
    }

    video = document.getElementById(VIDEO_ID)
    if (!video) {
      video = document.createElement('video')
      video.id = VIDEO_ID
      video.src = videoUrl
      video.loop = true
      video.autoplay = true
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.preload = 'auto'
      video.setAttribute('muted', '')
      video.setAttribute('aria-hidden', 'true')
      video.setAttribute('contenteditable', 'false')

      Object.assign(video.style, {
        position: 'fixed',
        zIndex: '89',
        inset: '0',
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center top',
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
        opacity: '0',
        transition: 'opacity 700ms cubic-bezier(0.16, 1, 0.3, 1)',
      })

      video.addEventListener('playing', () => {
        if (shouldPlay()) {
          setActive(true)
        }
      })
      video.addEventListener('canplay', scheduleReconcile)
      video.addEventListener('error', () => setActive(false))
      document.body.append(video)
    }

    return video
  }

  function reconcile() {
    scheduledFrame = 0
    if (destroyed) {
      return
    }

    if (!shouldPlay()) {
      setActive(false)
      video?.pause()
      return
    }

    const target = ensureVideo()
    const playResult = target.play()
    if (playResult?.catch) {
      playResult.catch(() => setActive(false))
    }
    if (!target.paused && target.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setActive(true)
    }
  }

  function scheduleReconcile() {
    if (!scheduledFrame && !destroyed) {
      scheduledFrame = requestAnimationFrame(reconcile)
    }
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

  document.addEventListener('visibilitychange', scheduleReconcile)
  document.addEventListener('load', onResourceLoad, true)
  window.addEventListener('pageshow', scheduleReconcile)
  window.addEventListener('focus', scheduleReconcile)
  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener('change', scheduleReconcile)
  } else {
    reducedMotion.addListener?.(scheduleReconcile)
  }
  scheduleReconcile()

  window[INSTANCE_KEY] = {
    destroy() {
      destroyed = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', scheduleReconcile)
      document.removeEventListener('load', onResourceLoad, true)
      window.removeEventListener('pageshow', scheduleReconcile)
      window.removeEventListener('focus', scheduleReconcile)
      if (reducedMotion.removeEventListener) {
        reducedMotion.removeEventListener('change', scheduleReconcile)
      } else {
        reducedMotion.removeListener?.(scheduleReconcile)
      }
      if (scheduledFrame) {
        cancelAnimationFrame(scheduledFrame)
      }
      setActive(false)
      video?.pause()
      video?.remove()
      video = null
      delete window[INSTANCE_KEY]
    },
  }
})()

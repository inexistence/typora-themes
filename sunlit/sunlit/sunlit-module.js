/* Sunlit module for Typora Themes Runtime. */

(() => {
  'use strict'

  const runtime = window[Symbol.for('typora-themes-runtime@1')]
  if (!runtime?.register) {
    return
  }

  runtime.register('sunlit', ({ context, themesBaseUrl }) => {
  const ACTIVE_CLASS = 'sunlit-video-active'
  const VIDEO_ID = 'sunlit-leaves-overlay'
  const videoUrl = new URL('sunlit/assets/leaves.mp4', themesBaseUrl).href

  let video = null
  let scheduledFrame = 0
  let destroyed = false
  let currentContext = context

  function shouldPlay() {
    return !currentContext.hidden && !currentContext.reducedMotion
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

    document.getElementById(VIDEO_ID)?.remove()
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
      if (!destroyed && shouldPlay()) {
        setActive(true)
      }
    })
    video.addEventListener('canplay', scheduleReconcile)
    video.addEventListener('error', () => {
      if (!destroyed) {
        setActive(false)
      }
    })
    document.body.append(video)

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
    try {
      const playResult = target.play()
      if (playResult?.catch) {
        playResult.catch(() => {
          if (!destroyed && video === target) {
            setActive(false)
          }
        })
      }
    } catch {
      setActive(false)
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

  return {
    update(nextContext) {
      currentContext = nextContext
      scheduleReconcile()
    },
    destroy() {
      destroyed = true
      if (scheduledFrame) {
        cancelAnimationFrame(scheduledFrame)
      }
      setActive(false)
      video?.pause()
      video?.remove()
      video = null
    },
  }
  })
})()

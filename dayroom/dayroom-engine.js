(() => {
  'use strict'

  const INTERIOR_SKY_CARD = Object.freeze([
    [178, 196, 201], [181, 191, 190], [185, 188, 179], [187, 186, 175],
    [197, 190, 173], [208, 192, 171], [196, 183, 170], [186, 168, 161],
    [183, 161, 164], [159, 145, 161], [136, 134, 159], [107, 113, 137],
    [87, 92, 112], [73, 77, 92], [55, 54, 60], [44, 40, 43],
  ])

  const SEASCAPE_SKY_CARD = Object.freeze([
    [1, 2, 15], [2, 8, 42], [4, 18, 75], [12, 39, 116],
    [28, 76, 162], [101, 121, 193], [201, 151, 184], [254, 204, 160],
    [244, 227, 193], [219, 223, 221], [184, 207, 231], [135, 179, 230],
    [101, 157, 225], [128, 174, 227], [181, 203, 227], [223, 220, 207],
    [251, 221, 164], [254, 188, 93], [254, 127, 57], [223, 96, 113],
    [137, 98, 165], [73, 84, 165], [23, 51, 130], [5, 19, 77],
  ])

  const READING_PALETTES = Object.freeze({
    day: {
      ink: [45, 45, 51],
      heading: [35, 35, 42],
      muted: [116, 115, 123],
      marker: [163, 162, 170],
      accent: [111, 118, 152],
      markText: [45, 45, 51],
      markBg: [236, 222, 211],
    },
    night: {
      ink: [240, 239, 242],
      heading: [247, 246, 248],
      muted: [184, 183, 191],
      marker: [137, 138, 148],
      accent: [196, 201, 229],
      markText: [240, 239, 242],
      markBg: [82, 75, 84],
    },
  })

  const SEASCAPE_BAND_MINUTES = Object.freeze({
    1: 350, 2: 390, 3: 480, 4: 540, 5: 630, 6: 720, 7: 810, 8: 900,
    9: 1050, 10: 1110, 11: 1140, 12: 1170, 13: 1200, 14: 1260,
    15: 1320, 16: 90,
  })

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount
  }

  function smoothstep(edge0, edge1, value) {
    const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return amount * amount * (3 - 2 * amount)
  }

  function mixColor(from, to, amount) {
    return from.map((channel, index) => Math.round(lerp(channel, to[index], amount)))
  }

  function toLinear(channel) {
    const value = channel / 255
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4)
  }

  function fromLinear(channel) {
    const value = channel <= 0.0031308
      ? channel * 12.92
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055
    return Math.round(clamp(value, 0, 1) * 255)
  }

  function rgbToOklab(color) {
    const [red, green, blue] = color.map(toLinear)
    const lightRoot = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
    const mediumRoot = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
    const shortRoot = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)
    return [
      0.2104542553 * lightRoot + 0.793617785 * mediumRoot - 0.0040720468 * shortRoot,
      1.9779984951 * lightRoot - 2.428592205 * mediumRoot + 0.4505937099 * shortRoot,
      0.0259040371 * lightRoot + 0.7827717662 * mediumRoot - 0.808675766 * shortRoot,
    ]
  }

  function oklabToRgb(color) {
    const lightRoot = color[0] + 0.3963377774 * color[1] + 0.2158037573 * color[2]
    const mediumRoot = color[0] - 0.1055613458 * color[1] - 0.0638541728 * color[2]
    const shortRoot = color[0] - 0.0894841775 * color[1] - 1.291485548 * color[2]
    const light = lightRoot * lightRoot * lightRoot
    const medium = mediumRoot * mediumRoot * mediumRoot
    const short = shortRoot * shortRoot * shortRoot
    return [
      fromLinear(4.0767416621 * light - 3.3077115913 * medium + 0.2309699292 * short),
      fromLinear(-1.2684380046 * light + 2.6097574011 * medium - 0.3413193965 * short),
      fromLinear(-0.0041960863 * light - 0.7034186147 * medium + 1.707614701 * short),
    ]
  }

  function mixOklabColor(from, to, amount) {
    const fromLab = rgbToOklab(from)
    const toLab = rgbToOklab(to)
    return oklabToRgb(fromLab.map((channel, index) => lerp(channel, toLab[index], amount)))
  }

  function reduceChromaOklab(color, chromaScale) {
    const lab = rgbToOklab(color)
    return oklabToRgb([lab[0], lab[1] * chromaScale, lab[2] * chromaScale])
  }

  const HYBRID_SKY_CARD = Object.freeze(
    SEASCAPE_SKY_CARD.map(color => Object.freeze(reduceChromaOklab(color, 0.42))),
  )

  function relativeLuminance(color) {
    const channels = color.map(channel => {
      const value = channel / 255
      return value <= 0.04045
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }

  function contrastRatio(first, second) {
    const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
    const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
    return (lighter + 0.05) / (darker + 0.05)
  }

  function ensureContrast(foreground, background, target, fallback) {
    if (contrastRatio(foreground, background) >= target) {
      return foreground
    }

    let low = 0
    let high = 1
    for (let index = 0; index < 12; index += 1) {
      const amount = (low + high) / 2
      const candidate = mixColor(foreground, fallback, amount)
      if (contrastRatio(candidate, background) >= target) {
        high = amount
      } else {
        low = amount
      }
    }
    return mixColor(foreground, fallback, high)
  }

  function valueFromStops(stops, value, key, mixer = mixColor) {
    const upperIndex = stops.findIndex(stop => stop.at >= value)
    const upper = stops[Math.max(upperIndex, 1)]
    const lower = stops[Math.max(upperIndex - 1, 0)]
    const amount = smoothstep(lower.at, upper.at, value)
    return mixer(lower[key], upper[key], amount)
  }

  function readingModeAt(value) {
    return value >= 370 && value < 1160 ? 'day' : 'night'
  }

  function lightAt(value) {
    const sunrise = 330
    const sunset = 1170
    const daylight = smoothstep(sunrise, sunrise + 70, value)
      * (1 - smoothstep(sunset - 80, sunset, value))
    const phase = clamp((value - sunrise) / (sunset - sunrise), 0, 1)
    const altitude = Math.sin(Math.PI * phase)

    return {
      daylight,
      phase,
      altitude,
      horizonWarmth: 1 - Math.pow(altitude, 0.5),
      slant: 0.31,
      verticalSlant: 0.1,
      stretch: 1.68,
      softness: lerp(14, 9, altitude),
      alpha: daylight * lerp(0.12, 0.17, altitude),
    }
  }

  function perceptualStrength(value) {
    return Math.pow(clamp(value, 0, 1), 0.65)
  }

  function twilightAt(value) {
    const morning = smoothstep(270, 330, value)
      * (1 - smoothstep(360, 420, value))
    const evening = smoothstep(1080, 1140, value)
      * (1 - smoothstep(1170, 1230, value))
    const intensity = Math.max(morning, evening) * 0.55

    return {
      intensity,
      warmth: evening > morning ? 1 : 0,
      slant: 0.31,
      verticalSlant: 0.1,
      stretch: 1.68,
      softness: 22,
    }
  }

  function horizonEmphasisAt(value) {
    const sunlight = lightAt(value)
    const twilight = twilightAt(value)
    const presence = clamp(
      Math.max(sunlight.horizonWarmth * sunlight.daylight, twilight.intensity * 1.8),
      0,
      1,
    )
    return smoothstep(0.08, 0.72, presence)
  }

  function lightCoherenceAt(value) {
    const sunlight = lightAt(value)
    const twilight = twilightAt(value)
    const horizonEmphasis = horizonEmphasisAt(value)
    const lightPresence = smoothstep(
      0.02,
      0.42,
      Math.max(sunlight.daylight, twilight.intensity),
    )
    const diffusion = horizonEmphasis * lightPresence

    return {
      diffusion,
      ambientOpacity: lerp(0.035, 0.087, diffusion),
      shadowContrast: lerp(1, 0.86, diffusion),
      shadowChroma: lerp(0.06, 0.12, diffusion),
      slatSoftness: lerp(1, 1.16, diffusion),
      edgeFeather: diffusion * 0.9,
    }
  }

  function moonlightAt(value) {
    const sunset = 1170
    const sunrise = 330
    const duration = 1440 - sunset + sunrise
    const elapsed = value >= sunset ? value - sunset : value + 1440 - sunset
    const phase = clamp(elapsed / duration, 0, 1)
    const altitude = Math.sin(Math.PI * phase)
    const envelope = value >= 720
      ? smoothstep(1130, 1230, value)
      : 1 - smoothstep(270, 370, value)

    return {
      phase,
      altitude,
      intensity: envelope * lerp(0.72, 1, altitude),
      slant: 0.31,
      verticalSlant: 0.1,
      stretch: 1.68,
      softness: lerp(24, 15, altitude),
      alpha: envelope * lerp(0.105, 0.065, altitude),
    }
  }

  function stateAt(value) {
    if (value < 300) return '深夜'
    if (value < 420) return '清晨'
    if (value < 690) return '上午'
    if (value < 840) return '正午'
    if (value < 1050) return '下午'
    if (value < 1200) return '黄昏'
    return '夜晚'
  }

  function formatTime(value) {
    const hours = Math.floor(value / 60)
    const minutes = value % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  function skyAtChronological(minute, skyCard) {
    const amount = (minute / 1440) * skyCard.length
    const rawLower = Math.floor(amount)
    const lower = rawLower % skyCard.length
    const upper = (lower + 1) % skyCard.length
    const t = amount - rawLower
    return mixColor(skyCard[lower], skyCard[upper], t)
  }

  function buildInteriorPalette(skyCard) {
    function card(index) {
      return skyCard[index - 1]
    }

    function paperTint(index, whiteAmount) {
      return mixOklabColor(card(index), [255, 255, 255], whiteAmount)
    }

    const environmentStops = [
      { at: 0, glow: card(16), glowOpacity: 0.045 },
      { at: 270, glow: card(14), glowOpacity: 0.05 },
      { at: 330, glow: card(12), glowOpacity: 0.065 },
      { at: 350, glow: card(1), glowOpacity: 0.09 },
      { at: 390, glow: card(2), glowOpacity: 0.14 },
      { at: 480, glow: card(3), glowOpacity: 0.1 },
      { at: 540, glow: card(5), glowOpacity: 0.075 },
      { at: 750, glow: card(6), glowOpacity: 0.04 },
      { at: 990, glow: card(7), glowOpacity: 0.1 },
      { at: 1050, glow: card(8), glowOpacity: 0.15 },
      { at: 1110, glow: card(9), glowOpacity: 0.22 },
      { at: 1160, glow: card(10), glowOpacity: 0.15 },
      { at: 1200, glow: card(12), glowOpacity: 0.075 },
      { at: 1260, glow: card(14), glowOpacity: 0.05 },
      { at: 1440, glow: card(16), glowOpacity: 0.045 },
    ]

    const paperSurfaceStops = [
      { at: 0, paper: card(16) },
      { at: 270, paper: card(14) },
      { at: 330, paper: card(13) },
      { at: 360, paper: card(12) },
      { at: 390, paper: card(1) },
      { at: 480, paper: paperTint(2, 0.18) },
      { at: 540, paper: paperTint(5, 0.42) },
      { at: 750, paper: paperTint(4, 0.62) },
      { at: 990, paper: paperTint(7, 0.45) },
      { at: 1050, paper: paperTint(8, 0.3) },
      { at: 1110, paper: paperTint(9, 0.12) },
      { at: 1160, paper: card(11) },
      { at: 1200, paper: card(13) },
      { at: 1260, paper: card(14) },
      { at: 1440, paper: card(16) },
    ]

    return {
      card,
      environmentStops,
      paperAt(value) {
        return valueFromStops(paperSurfaceStops, value, 'paper', mixOklabColor)
      },
      glowAt(value) {
        const upperIndex = environmentStops.findIndex(stop => stop.at >= value)
        const upper = environmentStops[Math.max(upperIndex, 1)]
        const lower = environmentStops[Math.max(upperIndex - 1, 0)]
        const amount = smoothstep(lower.at, upper.at, value)
        return {
          glow: mixColor(lower.glow, upper.glow, amount),
          glowOpacity: lerp(lower.glowOpacity, upper.glowOpacity, amount),
        }
      },
    }
  }

  function buildSeascapePalette(skyCard) {
    function card(index) {
      const minute = SEASCAPE_BAND_MINUTES[index] ?? ((index - 1) / 15) * 1440
      return skyAtChronological(minute, skyCard)
    }

    const glowOpacityStops = [
      { at: 0, opacity: 0.045 },
      { at: 330, opacity: 0.08 },
      { at: 390, opacity: 0.14 },
      { at: 720, opacity: 0.06 },
      { at: 1110, opacity: 0.22 },
      { at: 1440, opacity: 0.045 },
    ]

    return {
      card,
      environmentStops: null,
      paperAt(value) {
        const sky = skyAtChronological(value, skyCard)
        const daylight = lightAt(value).daylight
        const whiteAmount = lerp(0.22, 0.68, daylight)
        const chromaScale = lerp(0.15, 0.38, daylight)
        const base = reduceChromaOklab(sky, chromaScale)
        return mixOklabColor(base, [255, 255, 255], whiteAmount)
      },
      glowAt(value) {
        return {
          glow: skyAtChronological(value, skyCard),
          glowOpacity: valueFromStops(glowOpacityStops, value, 'opacity', lerp),
        }
      },
    }
  }

  function buildHybridPalette(skyCard) {
    const interior = buildInteriorPalette(INTERIOR_SKY_CARD)
    const seascape = buildSeascapePalette(skyCard)

    function materialPaperAt(value) {
      const interiorPaper = reduceChromaOklab(interior.paperAt(value), 0.08)
      const dayMaterial = mixOklabColor(interiorPaper, [248, 245, 237], 0.64)
      const nightMaterial = mixOklabColor(interiorPaper, [43, 43, 48], 0.5)
      const surfaceDaylight = smoothstep(345, 390, value)
        * (1 - smoothstep(1100, 1170, value))
      return mixOklabColor(nightMaterial, dayMaterial, surfaceDaylight)
    }

    return {
      card(index) {
        return reduceChromaOklab(seascape.card(index), 0.42)
      },
      environmentStops: null,
      paperAt(value) {
        return materialPaperAt(value)
      },
      glowAt(value) {
        const glow = seascape.glowAt(value)
        const horizonEmphasis = horizonEmphasisAt(value)
        const coherence = lightCoherenceAt(value)
        return {
          glow: reduceChromaOklab(glow.glow, lerp(0.2, 0.68, horizonEmphasis)),
          glowOpacity: glow.glowOpacity * lerp(0.45, 1.15, horizonEmphasis),
          ambient: reduceChromaOklab(glow.glow, lerp(0.12, 0.28, horizonEmphasis)),
          ambientOpacity: coherence.ambientOpacity,
        }
      },
      accentAt(value, paper, fallback) {
        const sky = skyAtChronological(value, skyCard)
        const seaAccent = reduceChromaOklab(sky, 0.5)
        const amount = lerp(0.28, 0.42, lightAt(value).daylight)
        const candidate = mixOklabColor(fallback, seaAccent, amount)
        return ensureContrast(candidate, paper, 3.2, fallback)
      },
    }
  }

  function readablePalette(paper) {
    const mode = relativeLuminance(paper) >= 0.18 ? 'day' : 'night'
    const palette = READING_PALETTES[mode]
    const darkFallback = [0, 0, 0]
    const lightFallback = [255, 255, 255]
    const fallback = contrastRatio(lightFallback, paper)
      >= contrastRatio(darkFallback, paper)
      ? lightFallback
      : darkFallback
    const ink = ensureContrast(palette.ink, paper, 4.6, fallback)
    return {
      mode,
      ink,
      heading: ensureContrast(palette.heading, paper, 4.8, ink),
      muted: ensureContrast(palette.muted, paper, 3.2, ink),
      marker: ensureContrast(palette.marker, paper, 1.9, ink),
      accent: ensureContrast(palette.accent, paper, 3.2, ink),
      markText: ink,
      markBg: palette.markBg,
    }
  }

  function createPaletteModel(paletteId) {
    const skyCard = paletteId === 'interior' ? INTERIOR_SKY_CARD : SEASCAPE_SKY_CARD
    const builder = paletteId === 'seascape'
      ? buildSeascapePalette
      : paletteId === 'hybrid'
        ? buildHybridPalette
        : buildInteriorPalette
    const model = builder(skyCard)

    function colorAt(value) {
      const paper = model.paperAt(value)
      const readable = readablePalette(paper)
      const glow = model.glowAt(value)
      return {
        paper,
        mode: readable.mode,
        ink: readable.ink,
        heading: readable.heading,
        muted: readable.muted,
        marker: readable.marker,
        accent: model.accentAt
          ? model.accentAt(value, paper, readable.accent)
          : readable.accent,
        markText: readable.markText,
        markBg: readable.markBg,
        glow: glow.glow,
        glowOpacity: glow.glowOpacity,
        ambient: glow.ambient ?? glow.glow,
        ambientOpacity: glow.ambientOpacity ?? 0,
      }
    }

    return {
      skyCard,
      card: model.card,
      colorAt,
      paperAt: model.paperAt,
    }
  }

  function createDayroomPanel(options) {
    const {
      container,
      paletteId = 'interior',
      prefix = paletteId,
    } = options

    const palette = createPaletteModel(paletteId)
    const card = palette.card
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

    const glowCanvas = container.querySelector(`[data-layer="glow"]`)
    const shadowCanvas = container.querySelector(`[data-layer="shadow"]`)
    const shell = container.querySelector('[data-shell]')
    const glowContext = glowCanvas.getContext('2d')
    const shadowContext = shadowCanvas.getContext('2d')

    let minute = 0
    let resizeFrame = 0
    let activeReadingMode = null
    let fallbackModeTransition = null
    const offscreenCache = new Map()

    function setTheme(value, color = palette.colorAt(value)) {
      container.style.setProperty('--paper-bg', color.paper.join(' '))
      container.style.setProperty('--ink', color.ink.join(' '))
      container.style.setProperty('--heading', color.heading.join(' '))
      container.style.setProperty('--muted', color.muted.join(' '))
      container.style.setProperty('--md-char', color.marker.join(' '))
      container.style.setProperty('--accent', color.accent.join(' '))
      container.style.setProperty('--mark-text', color.markText.join(' '))
      container.style.setProperty('--mark-bg', color.markBg.join(' '))
      container.style.setProperty('--room-glow', color.glow.join(' '))
      container.style.setProperty('--night-glow-opacity', String(color.glowOpacity))
      container.style.setProperty('--ambient-wash', color.ambient.join(' '))
      container.style.setProperty('--ambient-wash-opacity', String(color.ambientOpacity))
      container.style.setProperty('--daylight-opacity', '1')
      container.style.setProperty('--glow-blend-mode', paletteId === 'hybrid' ? 'normal' : 'screen')
      activeReadingMode = color.mode
    }

    function fitCanvas(canvas, context) {
      const ratio = Math.min(devicePixelRatio || 1, 2)
      const width = container.clientWidth
      const height = container.clientHeight
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      return { width, height, ratio }
    }

    function offscreenCanvas(key, width, height) {
      const cacheKey = `${prefix}:${key}`
      const cached = offscreenCache.get(cacheKey)
      if (cached?.width === width && cached.height === height) {
        return cached
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      offscreenCache.set(cacheKey, canvas)
      return canvas
    }

    function drawGlow(value) {
      const { width, height } = fitCanvas(glowCanvas, glowContext)
      const moonlight = moonlightAt(value)
      const twilight = twilightAt(value)
      const horizonEmphasis = paletteId === 'hybrid' ? horizonEmphasisAt(value) : 0
      const horizonBoost = lerp(1, 1.65, horizonEmphasis)
      glowContext.clearRect(0, 0, width, height)

      if (twilight.intensity > 0.015) {
        const sourceX = width * 0.26
        const sourceY = height * 0.16
        const twilightTone = mixColor(card(1), card(9), twilight.warmth)
        const twilightGlow = glowContext.createRadialGradient(
          sourceX, sourceY, 0, sourceX, sourceY, Math.max(width, height) * 0.78,
        )
        twilightGlow.addColorStop(0, `rgb(${twilightTone.join(' ')} / ${twilight.intensity * 0.075 * horizonBoost})`)
        twilightGlow.addColorStop(0.48, `rgb(${twilightTone.join(' ')} / ${twilight.intensity * 0.026 * horizonBoost})`)
        twilightGlow.addColorStop(1, `rgb(${twilightTone.join(' ')} / 0)`)
        glowContext.fillStyle = twilightGlow
        glowContext.fillRect(0, 0, width, height)
      }

      if (moonlight.intensity > 0.015) {
        const sourceX = width * 0.78
        const sourceY = height * 0.06
        const moonGlow = glowContext.createRadialGradient(
          sourceX, sourceY, 0, sourceX, sourceY, Math.max(width, height) * 0.72,
        )
        moonGlow.addColorStop(0, `rgb(${card(11).join(' ')} / ${moonlight.intensity * 0.07})`)
        moonGlow.addColorStop(0.42, `rgb(${card(12).join(' ')} / ${moonlight.intensity * 0.025})`)
        moonGlow.addColorStop(1, `rgb(${card(13).join(' ')} / 0)`)
        glowContext.fillStyle = moonGlow
        glowContext.fillRect(0, 0, width, height)
      }
    }

    function drawShadow(value) {
      const { width, height } = fitCanvas(shadowCanvas, shadowContext)
      const sunlight = lightAt(value)
      const moonlight = moonlightAt(value)
      const twilight = twilightAt(value)
      const sunStrength = perceptualStrength(sunlight.daylight)
      const moonStrength = perceptualStrength(moonlight.intensity)
      const twilightStrength = twilight.intensity
      const horizonEmphasis = paletteId === 'hybrid' ? horizonEmphasisAt(value) : 0
      const coherence = paletteId === 'hybrid'
        ? lightCoherenceAt(value)
        : {
            diffusion: 0,
            shadowContrast: 1,
            shadowChroma: 0.12,
            slatSoftness: 1,
            edgeFeather: 0,
          }
      const horizonBoost = lerp(1, 1.65, horizonEmphasis)
      const strength = Math.max(sunStrength, moonStrength, twilightStrength)
      shadowContext.clearRect(0, 0, width, height)

      if (strength < 0.015) {
        return
      }

      const altitude = sunStrength >= moonStrength ? sunlight.altitude : moonlight.altitude
      const shadeStrength = Math.max(sunStrength, twilightStrength * 0.72)
      const currentSky = paletteId === 'seascape' || paletteId === 'hybrid'
        ? skyAtChronological(value, palette.skyCard)
        : null
      const shadowTone = currentSky
        ? mixOklabColor(
            reduceChromaOklab(
              currentSky,
              paletteId === 'hybrid' ? coherence.shadowChroma : 0.12,
            ),
            [48, 53, 66],
            lerp(0.68, 0.52, altitude)
              * (paletteId === 'hybrid' ? lerp(1, 0.9, coherence.diffusion) : 1),
          )
        : mixColor(card(14), card(11), altitude)
      const shadowAlpha = shadeStrength * lerp(0.4, 0.28, altitude)
        * coherence.shadowContrast
      const lightTone = currentSky
        ? reduceChromaOklab(
            currentSky,
            paletteId === 'hybrid'
              ? lerp(0.28, 0.78, horizonEmphasis)
              : 0.58,
          )
        : mixColor(card(9), card(6), altitude)
      const lightAlpha = sunStrength * lerp(0.22, 0.16, altitude)
        * (paletteId === 'hybrid' ? lerp(1, 1.45, horizonEmphasis) : 1)
      const skewX = 0.3
      const skewY = 0.11
      const stretch = 1.75
      const sourceSoftness = sunStrength >= moonStrength ? sunlight.softness : moonlight.softness
      const twilightWeight = twilightStrength
        / Math.max(sunStrength + moonStrength + twilightStrength, 0.001)
      const baseSoftness = lerp(
        sourceSoftness,
        twilight.softness,
        clamp(twilightWeight * 1.25, 0, 1),
      ) * coherence.slatSoftness
      const projectionWidth = Math.min(width * 0.58, 420) * stretch
      const projectionHeight = Math.min(height * 0.72, 500) * stretch * 0.78
      const positionX = width * 0.035
      const positionY = height * 0.02
      const frameThickness = 8.5
      const slatCount = 18
      const innerHeight = projectionHeight - frameThickness * 2
      const spacing = innerHeight / slatCount
      const openAmount = 0.5
      const slatThickness = spacing * lerp(0.88, 0.12, openAmount)
      const gapHeight = spacing - slatThickness

      shadowContext.save()
      shadowContext.translate(positionX, positionY)
      shadowContext.transform(1, skewY, skewX, 1, 0, 0)

      const offscreenWidth = Math.ceil(projectionWidth + 80)
      const offscreenHeight = Math.ceil(projectionHeight + 80)
      const maskCanvas = offscreenCanvas('mask', offscreenWidth, offscreenHeight)
      const maskContext = maskCanvas.getContext('2d')
      maskContext.clearRect(0, 0, offscreenWidth, offscreenHeight)

      for (let index = 0; index < slatCount; index += 1) {
        const y = frameThickness + index * spacing + slatThickness
        const verticalPosition = index / slatCount
        const slatSoftness = baseSoftness * (0.55 + verticalPosition)
        const distanceFromCenter = Math.abs(index - slatCount / 2) / (slatCount / 2)
        const slatAlpha = 1 - distanceFromCenter * 0.1
        const padding = slatSoftness * 1.2
        const gradient = maskContext.createLinearGradient(0, y - padding, 0, y + gapHeight + padding)
        gradient.addColorStop(0, 'rgb(255 255 255 / 0)')
        gradient.addColorStop(padding / (gapHeight + padding * 2), `rgb(255 255 255 / ${slatAlpha})`)
        gradient.addColorStop(1 - padding / (gapHeight + padding * 2), `rgb(255 255 255 / ${slatAlpha})`)
        gradient.addColorStop(1, 'rgb(255 255 255 / 0)')
        maskContext.fillStyle = gradient
        maskContext.fillRect(frameThickness, y - padding, projectionWidth - frameThickness * 2, gapHeight + padding * 2)
      }

      maskContext.globalCompositeOperation = 'destination-in'
      const horizontalFade = maskContext.createLinearGradient(frameThickness, 0, projectionWidth - frameThickness, 0)
      horizontalFade.addColorStop(0, 'rgb(255 255 255 / 0.1)')
      horizontalFade.addColorStop(0.06, 'rgb(255 255 255 / 0.55)')
      horizontalFade.addColorStop(lerp(0.15, 0.22, coherence.edgeFeather), 'rgb(255 255 255 / 1)')
      horizontalFade.addColorStop(0.5, 'rgb(255 255 255 / 1)')
      horizontalFade.addColorStop(lerp(0.72, 0.64, coherence.edgeFeather), 'rgb(255 255 255 / 0.8)')
      horizontalFade.addColorStop(lerp(0.85, 0.78, coherence.edgeFeather), 'rgb(255 255 255 / 0.35)')
      horizontalFade.addColorStop(lerp(0.94, 0.88, coherence.edgeFeather), 'rgb(255 255 255 / 0.12)')
      horizontalFade.addColorStop(1, 'rgb(255 255 255 / 0.02)')
      maskContext.fillStyle = horizontalFade
      maskContext.fillRect(0, 0, offscreenWidth, offscreenHeight)

      const verticalFade = maskContext.createLinearGradient(0, frameThickness, 0, projectionHeight - frameThickness)
      verticalFade.addColorStop(0, 'rgb(255 255 255 / 0.08)')
      verticalFade.addColorStop(0.05, 'rgb(255 255 255 / 0.6)')
      verticalFade.addColorStop(lerp(0.12, 0.18, coherence.edgeFeather), 'rgb(255 255 255 / 1)')
      verticalFade.addColorStop(lerp(0.75, 0.68, coherence.edgeFeather), 'rgb(255 255 255 / 0.85)')
      verticalFade.addColorStop(lerp(0.88, 0.8, coherence.edgeFeather), 'rgb(255 255 255 / 0.35)')
      verticalFade.addColorStop(lerp(0.95, 0.88, coherence.edgeFeather), 'rgb(255 255 255 / 0.1)')
      verticalFade.addColorStop(1, 'rgb(255 255 255 / 0.02)')
      maskContext.fillStyle = verticalFade
      maskContext.fillRect(0, 0, offscreenWidth, offscreenHeight)

      maskContext.globalCompositeOperation = 'destination-out'
      const mullionWidth = frameThickness * 0.5
      const mullionSoftness = baseSoftness * 0.9
      const mullionX = projectionWidth * 0.47
      const mullionGradient = maskContext.createLinearGradient(
        mullionX - mullionWidth - mullionSoftness, 0,
        mullionX + mullionWidth + mullionSoftness, 0,
      )
      mullionGradient.addColorStop(0, 'rgb(255 255 255 / 0)')
      mullionGradient.addColorStop(0.15, 'rgb(255 255 255 / 1)')
      mullionGradient.addColorStop(0.85, 'rgb(255 255 255 / 1)')
      mullionGradient.addColorStop(1, 'rgb(255 255 255 / 0)')
      maskContext.fillStyle = mullionGradient
      maskContext.fillRect(mullionX - mullionWidth - mullionSoftness, 0, (mullionWidth + mullionSoftness) * 2, projectionHeight)

      const mullionY = projectionHeight * 0.4
      const crossGradient = maskContext.createLinearGradient(
        0, mullionY - mullionWidth - mullionSoftness,
        0, mullionY + mullionWidth + mullionSoftness,
      )
      crossGradient.addColorStop(0, 'rgb(255 255 255 / 0)')
      crossGradient.addColorStop(0.15, 'rgb(255 255 255 / 1)')
      crossGradient.addColorStop(0.85, 'rgb(255 255 255 / 1)')
      crossGradient.addColorStop(1, 'rgb(255 255 255 / 0)')
      maskContext.fillStyle = crossGradient
      maskContext.fillRect(0, mullionY - mullionWidth - mullionSoftness, projectionWidth, (mullionWidth + mullionSoftness) * 2)

      const cordX = projectionWidth * 0.73
      const cordWidth = 1.5
      const cordSoftness = baseSoftness * 0.4
      const cordGradient = maskContext.createLinearGradient(
        cordX - cordWidth - cordSoftness, 0,
        cordX + cordWidth + cordSoftness, 0,
      )
      cordGradient.addColorStop(0, 'rgb(255 255 255 / 0)')
      cordGradient.addColorStop(0.25, 'rgb(255 255 255 / 0.6)')
      cordGradient.addColorStop(0.75, 'rgb(255 255 255 / 0.6)')
      cordGradient.addColorStop(1, 'rgb(255 255 255 / 0)')
      maskContext.fillStyle = cordGradient
      maskContext.fillRect(cordX - cordWidth - cordSoftness, frameThickness, (cordWidth + cordSoftness) * 2, projectionHeight - frameThickness * 2)
      maskContext.globalCompositeOperation = 'source-over'

      if (moonStrength > 0.015) {
        const moonCanvas = offscreenCanvas('moon-gaps', offscreenWidth, offscreenHeight)
        const moonContext = moonCanvas.getContext('2d')
        moonContext.clearRect(0, 0, offscreenWidth, offscreenHeight)
        const moonGradient = moonContext.createRadialGradient(
          projectionWidth * 0.4, projectionHeight * 0.43, 0,
          projectionWidth * 0.4, projectionHeight * 0.43, projectionWidth * 0.78,
        )
        const moonTone = [210, 220, 235]
        moonGradient.addColorStop(0, `rgb(${moonTone.join(' ')} / ${moonStrength * 0.2})`)
        moonGradient.addColorStop(0.52, `rgb(${moonTone.join(' ')} / ${moonStrength * 0.1})`)
        moonGradient.addColorStop(1, `rgb(${moonTone.join(' ')} / 0)`)
        moonContext.fillStyle = moonGradient
        moonContext.fillRect(0, 0, offscreenWidth, offscreenHeight)
        moonContext.globalCompositeOperation = 'destination-in'
        moonContext.drawImage(maskCanvas, 0, 0)
        moonContext.globalCompositeOperation = 'source-over'
        glowContext.save()
        glowContext.translate(positionX, positionY)
        glowContext.transform(1, skewY, skewX, 1, 0, 0)
        glowContext.drawImage(moonCanvas, 0, 0)
        glowContext.restore()
      }

      if (twilightStrength > 0.015) {
        const twilightCanvas = offscreenCanvas('twilight-gaps', offscreenWidth, offscreenHeight)
        const twilightContext = twilightCanvas.getContext('2d')
        twilightContext.clearRect(0, 0, offscreenWidth, offscreenHeight)
        const twilightGradient = twilightContext.createRadialGradient(
          projectionWidth * 0.39, projectionHeight * 0.44, 0,
          projectionWidth * 0.39, projectionHeight * 0.44, projectionWidth * 0.82,
        )
        const twilightTone = mixColor(card(1), card(9), twilight.warmth)
        twilightGradient.addColorStop(0, `rgb(${twilightTone.join(' ')} / ${twilightStrength * 0.15 * horizonBoost})`)
        twilightGradient.addColorStop(0.55, `rgb(${twilightTone.join(' ')} / ${twilightStrength * 0.07 * horizonBoost})`)
        twilightGradient.addColorStop(1, `rgb(${twilightTone.join(' ')} / 0)`)
        twilightContext.fillStyle = twilightGradient
        twilightContext.fillRect(0, 0, offscreenWidth, offscreenHeight)
        twilightContext.globalCompositeOperation = 'destination-in'
        twilightContext.drawImage(maskCanvas, 0, 0)
        twilightContext.globalCompositeOperation = 'source-over'
        glowContext.save()
        glowContext.translate(positionX, positionY)
        glowContext.transform(1, skewY, skewX, 1, 0, 0)
        glowContext.drawImage(twilightCanvas, 0, 0)
        glowContext.restore()
      }

      if (shadeStrength > 0.015) {
        const shadeCanvas = offscreenCanvas('shade-stripes', offscreenWidth, offscreenHeight)
        const shadeContext = shadeCanvas.getContext('2d')
        shadeContext.clearRect(0, 0, offscreenWidth, offscreenHeight)
        shadeContext.fillStyle = `rgb(${shadowTone.join(' ')} / ${shadowAlpha})`
        shadeContext.fillRect(0, 0, projectionWidth, projectionHeight)
        shadeContext.globalCompositeOperation = 'destination-out'
        shadeContext.drawImage(maskCanvas, 0, 0)
        shadeContext.globalCompositeOperation = 'destination-in'
        const shadeHorizontalFade = shadeContext.createLinearGradient(0, 0, projectionWidth, 0)
        shadeHorizontalFade.addColorStop(0, 'rgb(255 255 255 / 0)')
        shadeHorizontalFade.addColorStop(0.08, 'rgb(255 255 255 / 0.18)')
        shadeHorizontalFade.addColorStop(lerp(0.22, 0.28, coherence.edgeFeather), 'rgb(255 255 255 / 0.9)')
        shadeHorizontalFade.addColorStop(0.52, 'rgb(255 255 255 / 1)')
        shadeHorizontalFade.addColorStop(lerp(0.76, 0.68, coherence.edgeFeather), 'rgb(255 255 255 / 0.76)')
        shadeHorizontalFade.addColorStop(lerp(0.93, 0.86, coherence.edgeFeather), 'rgb(255 255 255 / 0.14)')
        shadeHorizontalFade.addColorStop(1, 'rgb(255 255 255 / 0)')
        shadeContext.fillStyle = shadeHorizontalFade
        shadeContext.fillRect(0, 0, projectionWidth, projectionHeight)
        const shadeVerticalFade = shadeContext.createLinearGradient(0, 0, 0, projectionHeight)
        shadeVerticalFade.addColorStop(0, 'rgb(255 255 255 / 0)')
        shadeVerticalFade.addColorStop(0.09, 'rgb(255 255 255 / 0.22)')
        shadeVerticalFade.addColorStop(lerp(0.22, 0.28, coherence.edgeFeather), 'rgb(255 255 255 / 0.9)')
        shadeVerticalFade.addColorStop(lerp(0.58, 0.54, coherence.edgeFeather), 'rgb(255 255 255 / 1)')
        shadeVerticalFade.addColorStop(lerp(0.8, 0.72, coherence.edgeFeather), 'rgb(255 255 255 / 0.58)')
        shadeVerticalFade.addColorStop(lerp(0.96, 0.88, coherence.edgeFeather), 'rgb(255 255 255 / 0.08)')
        shadeVerticalFade.addColorStop(1, 'rgb(255 255 255 / 0)')
        shadeContext.fillStyle = shadeVerticalFade
        shadeContext.fillRect(0, 0, projectionWidth, projectionHeight)
        shadeContext.globalCompositeOperation = 'source-over'
        shadowContext.drawImage(shadeCanvas, 0, 0)
      }

      if (sunStrength > 0.015) {
        const lightCanvas = offscreenCanvas('light', offscreenWidth, offscreenHeight)
        const lightContext = lightCanvas.getContext('2d')
        lightContext.clearRect(0, 0, offscreenWidth, offscreenHeight)
        const lightGradient = lightContext.createRadialGradient(
          projectionWidth * 0.4, projectionHeight * 0.45, 0,
          projectionWidth * 0.4, projectionHeight * 0.45, projectionWidth * 0.8,
        )
        lightGradient.addColorStop(0, `rgb(${lightTone.join(' ')} / ${lightAlpha * 0.9})`)
        lightGradient.addColorStop(0.5, `rgb(${lightTone.join(' ')} / ${lightAlpha * 0.6})`)
        lightGradient.addColorStop(1, `rgb(${lightTone.join(' ')} / ${lightAlpha * 0.15})`)
        lightContext.fillStyle = lightGradient
        lightContext.fillRect(0, 0, offscreenWidth, offscreenHeight)
        lightContext.globalCompositeOperation = 'destination-in'
        lightContext.drawImage(maskCanvas, 0, 0)
        lightContext.globalCompositeOperation = 'source-over'

        const softGlowCanvas = offscreenCanvas('soft-glow', offscreenWidth, offscreenHeight)
        const glow = softGlowCanvas.getContext('2d')
        glow.clearRect(0, 0, offscreenWidth, offscreenHeight)
        const glowGradient = glow.createRadialGradient(
          projectionWidth * 0.38, projectionHeight * 0.42, 0,
          projectionWidth * 0.38, projectionHeight * 0.42, projectionWidth * 0.7,
        )
        const glowColor = currentSky
          ? reduceChromaOklab(
              currentSky,
              paletteId === 'hybrid'
                ? lerp(0.18, 0.6, horizonEmphasis)
                : 0.42,
            )
          : card(8)
        glowGradient.addColorStop(0, `rgb(${glowColor.join(' ')} / ${lightAlpha * 0.35})`)
        glowGradient.addColorStop(0.5, `rgb(${glowColor.join(' ')} / ${lightAlpha * 0.15})`)
        glowGradient.addColorStop(1, `rgb(${glowColor.join(' ')} / 0)`)
        glow.fillStyle = glowGradient
        glow.fillRect(0, 0, offscreenWidth, offscreenHeight)
        glow.globalCompositeOperation = 'destination-in'
        glow.drawImage(maskCanvas, 0, 0)
        glow.globalCompositeOperation = 'source-over'
        if (paletteId === 'hybrid') {
          glowContext.save()
          glowContext.translate(positionX, positionY)
          glowContext.transform(1, skewY, skewX, 1, 0, 0)
          glowContext.drawImage(lightCanvas, 0, 0)
          glowContext.drawImage(softGlowCanvas, 0, 0)
          glowContext.restore()
        } else {
          shadowContext.drawImage(lightCanvas, 0, 0)
          shadowContext.drawImage(softGlowCanvas, 0, 0)
        }
      }

      shadowContext.restore()
    }

    function drawScene(value) {
      drawGlow(value)
      drawShadow(value)
    }

    function dissolveModeChange(apply) {
      fallbackModeTransition?.cancel()

      const rect = shell.getBoundingClientRect()
      const clone = shell.cloneNode(true)
      const preservedProperties = [
        '--paper-bg', '--ink', '--heading', '--muted', '--md-char',
        '--accent', '--mark-text', '--mark-bg', '--border',
      ]

      clone.removeAttribute('id')
      clone.setAttribute('aria-hidden', 'true')
      clone.classList.add('mode-transition-clone')
      for (const property of preservedProperties) {
        clone.style.setProperty(property, container.style.getPropertyValue(property))
      }
      clone.style.top = `${rect.top + scrollY}px`
      clone.style.left = `${rect.left + scrollX}px`
      clone.style.width = `${rect.width}px`
      clone.style.height = `${rect.height}px`
      clone.style.minHeight = '0'

      document.body.append(clone)
      shell.style.opacity = '0'
      apply()

      const duration = 480
      const easing = 'cubic-bezier(0.25, 1, 0.5, 1)'
      const cssTransition = `opacity ${duration}ms ${easing}`
      let cleanupTimer = 0
      const transition = {
        cancel() {
          clearTimeout(cleanupTimer)
          clone.remove()
          shell.style.removeProperty('opacity')
          shell.style.removeProperty('transition')
        },
      }
      fallbackModeTransition = transition

      clone.style.transition = cssTransition
      shell.style.transition = cssTransition
      clone.getBoundingClientRect()
      clone.style.opacity = '0'
      shell.style.opacity = '1'

      cleanupTimer = setTimeout(() => {
        if (fallbackModeTransition === transition) {
          transition.cancel()
          fallbackModeTransition = null
        }
      }, duration + 80)
    }

    function render(value) {
      const nextMinute = Math.round(Number(value))
      const nextColor = palette.colorAt(nextMinute)
      const nextMode = nextColor.mode
      const shouldTransition = activeReadingMode !== null
        && nextMode !== activeReadingMode
        && !reducedMotion.matches

      const apply = () => {
        minute = nextMinute
        setTheme(minute, nextColor)
        drawScene(minute)
      }

      if (shouldTransition) {
        dissolveModeChange(apply)
        return
      }

      apply()
    }

    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => drawScene(minute))
    })
    resizeObserver.observe(container)

    return {
      paletteId,
      prefix,
      render,
      colorAt: palette.colorAt,
      paperAt: palette.paperAt,
      contrastRatio,
      getMinute: () => minute,
      destroy() {
        resizeObserver.disconnect()
        fallbackModeTransition?.cancel()
      },
    }
  }

  Object.defineProperty(window, 'DayroomEngine', {
    configurable: true,
    value: Object.freeze({
      createDayroomPanel,
      createPaletteModel,
      PALETTES: Object.freeze({
        interior: INTERIOR_SKY_CARD,
        seascape: SEASCAPE_SKY_CARD,
        hybrid: HYBRID_SKY_CARD,
      }),
      contrastRatio,
      lightAt,
      moonlightAt,
      readingModeAt,
      stateAt,
      formatTime,
    }),
  })
})()

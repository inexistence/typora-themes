/* Canopy module for Typora Themes Runtime. */

(() => {
  'use strict'

  const runtime = window[Symbol.for('typora-themes-runtime@1')]
  if (!runtime?.register) {
    return
  }

  const THEME_ID = 'canopy'
  const ACTIVE_CLASS = 'canopy-video-active'
  const NIGHT_CLASS = 'canopy-night'
  const DEBUG_PLAYING_CLASS = 'canopy-debug-playing'
  const DEBUG_KEY = '__canopyDebug'
  const VIDEO_ID = 'canopy-leaves-overlay'
  const SHANGHAI_LATITUDE = 31.23
  const SHANGHAI_LONGITUDE = 121.47
  const SHANGHAI_UTC_OFFSET_MINUTES = 8 * 60
  const FULL_CIRCLE = Math.PI * 2

  const DEBUG_PRESETS = Object.freeze({
    'spring-noon': '2026-03-20T12:00:00+08:00',
    'summer-sunset': '2026-06-21T18:45:00+08:00',
    'autumn-dawn': '2026-09-24T05:30:00+08:00',
    'winter-midnight': '2026-12-22T00:00:00+08:00',
  })

  const shanghaiFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const SEASON_ANCHORS = Object.freeze([
    {
      day: -10,
      name: 'winter',
      paper: [218, 222, 224],
      sky: [151, 171, 195],
      highlight: [233, 213, 187],
      horizon: [163, 138, 174],
      shadow: [51, 52, 68],
    },
    {
      day: 79,
      name: 'spring',
      paper: [235, 237, 217],
      sky: [196, 214, 188],
      highlight: [255, 225, 184],
      horizon: [236, 170, 178],
      shadow: [65, 77, 91],
    },
    {
      day: 172,
      name: 'summer',
      paper: [240, 236, 209],
      sky: [184, 211, 219],
      highlight: [255, 234, 176],
      horizon: [244, 184, 116],
      shadow: [53, 68, 82],
    },
    {
      day: 266,
      name: 'autumn',
      paper: [235, 220, 194],
      sky: [213, 172, 128],
      highlight: [255, 193, 112],
      horizon: [211, 105, 94],
      shadow: [73, 56, 70],
    },
    {
      day: 355,
      name: 'winter',
      paper: [218, 222, 224],
      sky: [151, 171, 195],
      highlight: [233, 213, 187],
      horizon: [163, 138, 174],
      shadow: [51, 52, 68],
    },
    {
      day: 444,
      name: 'spring',
      paper: [235, 237, 217],
      sky: [196, 214, 188],
      highlight: [255, 225, 184],
      horizon: [236, 170, 178],
      shadow: [65, 77, 91],
    },
  ])

  const ROOT_PROPERTIES = Object.freeze([
    '--bg-color', '--text-color', '--heading-color', '--muted-text-color',
    '--md-char-color', '--meta-content-color', '--primary-color',
    '--primary-btn-border-color', '--primary-btn-text-color', '--surface-color',
    '--surface-muted-color', '--surface-strong-color', '--surface-raised-color',
    '--border-color', '--border-soft-color', '--border-strong-color',
    '--divider-color', '--code-bg-color', '--code-text-color',
    '--code-fence-bg-color', '--code-fence-text-color', '--code-control-color',
    '--code-control-hover-bg-color', '--code-tab-active-bg-color',
    '--code-tab-active-text-color', '--code-border-color', '--code-gutter-color',
    '--code-cursor-color', '--code-active-line-color', '--code-selection-color',
    '--math-editor-bg-color', '--math-editor-text-color', '--math-command-color',
    '--math-parameter-color', '--math-meta-color', '--math-cursor-color',
    '--math-selection-color', '--diagram-bg-color', '--diagram-node-bg-color',
    '--diagram-node-border-color', '--diagram-line-color', '--diagram-label-bg-color',
    '--syntax-comment', '--syntax-keyword', '--syntax-string', '--syntax-number',
    '--syntax-variable', '--syntax-operator', '--syntax-tag', '--syntax-error',
    '--selection-color', '--shadow-color', '--shadow-strong-color',
    '--mark-bg-color', '--mark-text-color', '--table-header-text-color',
    '--quote-bg-color', '--quote-border-color', '--alert-note-bg-color',
    '--alert-note-border-color', '--alert-note-text-color', '--alert-tip-bg-color',
    '--alert-tip-border-color', '--alert-tip-text-color',
    '--alert-important-bg-color', '--alert-important-border-color',
    '--alert-important-text-color', '--alert-warning-bg-color',
    '--alert-warning-border-color', '--alert-warning-text-color',
    '--alert-caution-bg-color', '--alert-caution-border-color',
    '--alert-caution-text-color', '--side-bar-bg-color', '--active-file-bg-color',
    '--active-file-text-color', '--active-file-border-color',
    '--item-hover-bg-color', '--item-hover-text-color', '--blur-text-color',
    '--canopy-shadow-opacity', '--canopy-static-shadow-opacity',
    '--canopy-video-contrast', '--canopy-video-brightness',
    '--canopy-video-sepia', '--canopy-video-saturation', '--canopy-video-hue',
  ])

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value))
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount
  }

  function smoothstep(edge0, edge1, value) {
    const amount = clamp((value - edge0) / (edge1 - edge0))
    return amount * amount * (3 - 2 * amount)
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
    return Math.round(clamp(value) * 255)
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

  function mixColor(from, to, amount) {
    const fromLab = rgbToOklab(from)
    const toLab = rgbToOklab(to)
    return oklabToRgb(fromLab.map((channel, index) => lerp(channel, toLab[index], amount)))
  }

  function relativeLuminance(color) {
    const channels = color.map(toLinear)
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

  function rgb(color) {
    return `rgb(${color.join(' ')})`
  }

  function rgba(color, alpha) {
    return `rgb(${color.join(' ')} / ${alpha})`
  }

  function colorChannels(color) {
    return color.join(' ')
  }

  function paletteAtDay(dayOfYear) {
    const upperIndex = SEASON_ANCHORS.findIndex(anchor => anchor.day >= dayOfYear)
    const upper = SEASON_ANCHORS[Math.max(upperIndex, 1)]
    const lower = SEASON_ANCHORS[Math.max(upperIndex - 1, 0)]
    const amount = smoothstep(lower.day, upper.day, dayOfYear)
    return {
      name: amount < 0.5 ? lower.name : upper.name,
      paper: mixColor(lower.paper, upper.paper, amount),
      sky: mixColor(lower.sky, upper.sky, amount),
      highlight: mixColor(lower.highlight, upper.highlight, amount),
      horizon: mixColor(lower.horizon, upper.horizon, amount),
      shadow: mixColor(lower.shadow, upper.shadow, amount),
    }
  }

  function shanghaiParts(value) {
    const date = value instanceof Date ? value : new Date(value)
    const parts = Object.fromEntries(
      shanghaiFormatter.formatToParts(date)
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, Number(part.value)]),
    )
    const start = Date.UTC(parts.year, 0, 1)
    const current = Date.UTC(parts.year, parts.month - 1, parts.day)
    return {
      ...parts,
      dayOfYear: Math.floor((current - start) / 86_400_000) + 1,
      minute: parts.hour * 60 + parts.minute + parts.second / 60,
      dateKey: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    }
  }

  function shanghaiTimestamp(year, month, day, minute) {
    const normalizedMinute = ((minute % 1440) + 1440) % 1440
    return Date.UTC(year, month - 1, day)
      - SHANGHAI_UTC_OFFSET_MINUTES * 60_000
      + normalizedMinute * 60_000
  }

  function formatMinute(minute) {
    const normalized = Math.floor(((minute % 1440) + 1440) % 1440)
    const hours = Math.floor(normalized / 60)
    const minutes = normalized % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  function solarTimes(dayOfYear) {
    const gamma = FULL_CIRCLE / 365 * (dayOfYear - 1)
    const equationOfTime = 229.18 * (
      0.000075
      + 0.001868 * Math.cos(gamma)
      - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2 * gamma)
      - 0.040849 * Math.sin(2 * gamma)
    )
    const declination = 0.006918
      - 0.399912 * Math.cos(gamma)
      + 0.070257 * Math.sin(gamma)
      - 0.006758 * Math.cos(2 * gamma)
      + 0.000907 * Math.sin(2 * gamma)
      - 0.002697 * Math.cos(3 * gamma)
      + 0.00148 * Math.sin(3 * gamma)
    const latitude = SHANGHAI_LATITUDE * Math.PI / 180
    const zenith = 90.833 * Math.PI / 180
    const hourAngle = Math.acos(clamp(
      Math.cos(zenith) / (Math.cos(latitude) * Math.cos(declination))
        - Math.tan(latitude) * Math.tan(declination),
      -1,
      1,
    )) * 180 / Math.PI
    const solarNoon = 720
      - 4 * SHANGHAI_LONGITUDE
      - equationOfTime
      + SHANGHAI_UTC_OFFSET_MINUTES
    return {
      dawn: solarNoon - hourAngle * 4 - 45,
      sunrise: solarNoon - hourAngle * 4,
      noon: solarNoon,
      sunset: solarNoon + hourAngle * 4,
      dusk: solarNoon + hourAngle * 4 + 45,
    }
  }

  function colorAtStops(stops, value) {
    const upperIndex = stops.findIndex(stop => stop.at >= value)
    const upper = stops[Math.max(upperIndex, 1)]
    const lower = stops[Math.max(upperIndex - 1, 0)]
    return mixColor(lower.color, upper.color, smoothstep(lower.at, upper.at, value))
  }

  function skyAt(minute, solar, season) {
    const stops = [
      { at: 0, color: [30, 34, 54] },
      { at: solar.dawn, color: mixColor([67, 72, 105], season.sky, 0.18) },
      { at: solar.sunrise - 12, color: mixColor([225, 132, 139], season.horizon, 0.42) },
      { at: solar.sunrise + 42, color: mixColor([244, 210, 180], season.highlight, 0.35) },
      { at: solar.noon, color: mixColor([188, 211, 230], season.sky, 0.34) },
      { at: solar.sunset - 85, color: mixColor([226, 205, 174], season.highlight, 0.28) },
      { at: solar.sunset + 8, color: mixColor([237, 113, 79], season.horizon, 0.48) },
      { at: solar.dusk, color: mixColor([101, 76, 124], season.shadow, 0.25) },
      { at: 1440, color: [30, 34, 54] },
    ]
    return colorAtStops(stops, minute)
  }

  function themeTokens(paper, season, mode) {
    const darkFallback = [18, 18, 22]
    const lightFallback = [247, 244, 231]
    const fallback = mode === 'day' ? darkFallback : lightFallback
    const textBase = mode === 'day' ? [55, 58, 50] : [224, 224, 214]
    const headingBase = mode === 'day' ? [34, 37, 31] : [247, 240, 222]
    const mutedBase = mode === 'day' ? [105, 108, 96] : [170, 172, 162]
    const markerBase = mode === 'day' ? [153, 153, 139] : [126, 130, 124]
    const ink = ensureContrast(textBase, paper, 4.7, fallback)
    const heading = ensureContrast(headingBase, paper, 5.2, fallback)
    const muted = ensureContrast(mutedBase, paper, 3.5, ink)
    const marker = ensureContrast(markerBase, paper, 2.2, ink)
    const accentBase = mixColor(
      mode === 'day' ? [151, 91, 38] : [230, 185, 124],
      season.horizon,
      mode === 'day' ? 0.42 : 0.3,
    )
    const accent = ensureContrast(accentBase, paper, 3.4, ink)
    const surfacePole = mode === 'day' ? [255, 251, 239] : [85, 84, 98]
    const surface = mixColor(paper, surfacePole, mode === 'day' ? 0.22 : 0.16)
    const surfaceMuted = mixColor(paper, surfacePole, mode === 'day' ? 0.1 : 0.28)
    const surfaceStrong = mixColor(paper, surfacePole, mode === 'day' ? 0.04 : 0.42)
    const surfaceRaised = mixColor(paper, surfacePole, mode === 'day' ? 0.35 : 0.5)
    const divider = mixColor(paper, ink, mode === 'day' ? 0.18 : 0.23)
    const codeBackground = mixColor(paper, surfacePole, mode === 'day' ? 0.13 : 0.3)
    const markBackground = mixColor(paper, season.highlight, mode === 'day' ? 0.52 : 0.28)
    const selection = mixColor(paper, season.horizon, mode === 'day' ? 0.5 : 0.38)
    const syntax = mode === 'day'
      ? {
          comment: [112, 115, 107], keyword: [150, 75, 58], string: [70, 112, 77],
          number: [137, 85, 46], variable: [48, 94, 121], operator: [104, 88, 126],
          tag: [115, 94, 31], error: [180, 35, 24],
        }
      : {
          comment: [145, 149, 143], keyword: [225, 137, 123], string: [137, 190, 145],
          number: [220, 164, 111], variable: [130, 181, 214], operator: [180, 157, 207],
          tag: [207, 186, 112], error: [255, 123, 112],
        }

    return {
      '--bg-color': rgb(paper),
      '--text-color': rgb(ink),
      '--heading-color': rgb(heading),
      '--muted-text-color': rgb(muted),
      '--md-char-color': rgb(marker),
      '--meta-content-color': rgb(muted),
      '--primary-color': rgb(accent),
      '--primary-btn-border-color': rgb(accent),
      '--primary-btn-text-color': rgb(ensureContrast(mode === 'day' ? [255, 250, 240] : [35, 31, 38], accent, 4.5, fallback)),
      '--surface-color': rgb(surface),
      '--surface-muted-color': rgb(surfaceMuted),
      '--surface-strong-color': rgb(surfaceStrong),
      '--surface-raised-color': rgb(surfaceRaised),
      '--border-color': rgba(ink, mode === 'day' ? 0.14 : 0.16),
      '--border-soft-color': rgba(ink, mode === 'day' ? 0.08 : 0.1),
      '--border-strong-color': rgba(ink, mode === 'day' ? 0.23 : 0.28),
      '--divider-color': rgb(divider),
      '--code-bg-color': rgb(codeBackground),
      '--code-text-color': rgb(ink),
      '--code-fence-bg-color': rgb(surface),
      '--code-fence-text-color': rgb(ink),
      '--code-control-color': rgb(muted),
      '--code-control-hover-bg-color': rgb(surfaceMuted),
      '--code-tab-active-bg-color': rgb(surfaceStrong),
      '--code-tab-active-text-color': rgb(heading),
      '--code-border-color': rgba(ink, 0.16),
      '--code-gutter-color': rgb(marker),
      '--code-cursor-color': rgb(accent),
      '--code-active-line-color': rgba(accent, 0.12),
      '--code-selection-color': rgba(selection, 0.24),
      '--math-editor-bg-color': rgb(surfaceMuted),
      '--math-editor-text-color': rgb(ink),
      '--math-command-color': rgb(syntax.keyword),
      '--math-parameter-color': rgb(syntax.string),
      '--math-meta-color': rgb(muted),
      '--math-cursor-color': rgb(accent),
      '--math-selection-color': rgba(selection, 0.22),
      '--diagram-bg-color': rgb(surfaceRaised),
      '--diagram-node-bg-color': rgb(surfaceMuted),
      '--diagram-node-border-color': rgb(divider),
      '--diagram-line-color': rgb(muted),
      '--diagram-label-bg-color': rgb(surfaceRaised),
      '--syntax-comment': rgb(syntax.comment),
      '--syntax-keyword': rgb(syntax.keyword),
      '--syntax-string': rgb(syntax.string),
      '--syntax-number': rgb(syntax.number),
      '--syntax-variable': rgb(syntax.variable),
      '--syntax-operator': rgb(syntax.operator),
      '--syntax-tag': rgb(syntax.tag),
      '--syntax-error': rgb(syntax.error),
      '--selection-color': rgba(selection, 0.3),
      '--shadow-color': rgba(season.shadow, mode === 'day' ? 0.13 : 0.28),
      '--shadow-strong-color': rgba(season.shadow, mode === 'day' ? 0.22 : 0.4),
      '--mark-bg-color': rgb(markBackground),
      '--mark-text-color': rgb(ensureContrast(ink, markBackground, 4.5, fallback)),
      '--table-header-text-color': rgb(heading),
      '--quote-bg-color': rgb(surfaceMuted),
      '--quote-border-color': rgba(ink, 0.16),
      '--alert-note-bg-color': rgba(mode === 'day' ? [47, 123, 213] : [92, 157, 232], 0.14),
      '--alert-note-border-color': rgb(mode === 'day' ? [47, 123, 213] : [111, 174, 241]),
      '--alert-note-text-color': rgb(mode === 'day' ? [32, 90, 159] : [170, 208, 249]),
      '--alert-tip-bg-color': rgb(surfaceRaised),
      '--alert-tip-border-color': rgba(ink, 0.2),
      '--alert-tip-text-color': rgb(heading),
      '--alert-important-bg-color': rgba(mode === 'day' ? [111, 86, 160] : [164, 137, 214], 0.14),
      '--alert-important-border-color': rgb(mode === 'day' ? [128, 100, 178] : [185, 156, 230]),
      '--alert-important-text-color': rgb(mode === 'day' ? [98, 72, 143] : [211, 190, 244]),
      '--alert-warning-bg-color': rgba(mode === 'day' ? [177, 112, 24] : [222, 159, 79], 0.15),
      '--alert-warning-border-color': rgb(mode === 'day' ? [177, 112, 24] : [230, 169, 93]),
      '--alert-warning-text-color': rgb(mode === 'day' ? [128, 80, 15] : [242, 201, 143]),
      '--alert-caution-bg-color': rgba(mode === 'day' ? [180, 55, 48] : [234, 113, 104], 0.14),
      '--alert-caution-border-color': rgb(mode === 'day' ? [180, 55, 48] : [241, 126, 117]),
      '--alert-caution-text-color': rgb(mode === 'day' ? [143, 47, 42] : [249, 188, 180]),
      '--side-bar-bg-color': rgb(mixColor(paper, season.shadow, mode === 'day' ? 0.06 : 0.12)),
      '--active-file-bg-color': rgb(surfaceStrong),
      '--active-file-text-color': rgb(heading),
      '--active-file-border-color': rgb(accent),
      '--item-hover-bg-color': rgb(surfaceMuted),
      '--item-hover-text-color': rgb(heading),
      '--blur-text-color': rgb(marker),
    }
  }

  function sceneAt(value = Date.now()) {
    const time = shanghaiParts(value)
    const solar = solarTimes(time.dayOfYear)
    const season = paletteAtDay(time.dayOfYear)
    const minute = time.minute
    const solarPhase = clamp((minute - solar.sunrise) / (solar.sunset - solar.sunrise))
    const daylightAltitude = minute >= solar.sunrise && minute <= solar.sunset
      ? Math.sin(Math.PI * solarPhase)
      : 0
    const daylight = smoothstep(solar.sunrise - 35, solar.sunrise + 55, minute)
      * (1 - smoothstep(solar.sunset - 55, solar.sunset + 35, minute))
    const surfaceDaylight = smoothstep(solar.sunrise - 25, solar.sunrise + 45, minute)
      * (1 - smoothstep(solar.sunset - 45, solar.sunset + 30, minute))
    const dawn = smoothstep(solar.dawn - 25, solar.sunrise - 10, minute)
      * (1 - smoothstep(solar.sunrise + 15, solar.sunrise + 80, minute))
    const dusk = smoothstep(solar.sunset - 80, solar.sunset - 10, minute)
      * (1 - smoothstep(solar.sunset + 15, solar.dusk + 35, minute))
    const twilight = Math.max(dawn, dusk)
    const nightDuration = 1440 - solar.sunset + solar.sunrise
    const nightElapsed = minute >= solar.sunset
      ? minute - solar.sunset
      : minute + 1440 - solar.sunset
    const moonPhase = clamp(nightElapsed / nightDuration)
    const moonAltitude = Math.sin(Math.PI * moonPhase)
    const sky = skyAt(minute, solar, season)
    const dayPaper = mixColor([248, 245, 237], season.paper, 0.28)
    const nightPaper = mixColor([34, 34, 43], season.shadow, 0.22)
    const paper = mixColor(nightPaper, dayPaper, surfaceDaylight)
    const mode = relativeLuminance(paper) >= 0.18 ? 'day' : 'night'
    const horizonWarmth = 1 - Math.pow(daylightAltitude, 0.55)
    const sunX = mode === 'day'
      ? lerp(4, 94, solarPhase)
      : lerp(92, 8, moonPhase)
    const sunY = mode === 'day'
      ? 76 - daylightAltitude * 66
      : 68 - moonAltitude * 56
    const directColor = mode === 'day'
      ? mixColor(sky, season.highlight, lerp(0.62, 0.28, daylightAltitude))
      : mixColor([151, 181, 224], season.sky, 0.22)
    const directOpacity = mode === 'day'
      ? clamp(daylight * lerp(0.75, 0.46, daylightAltitude) + twilight * 0.3, 0, 0.75)
      : lerp(0.06, 0.15, moonAltitude)
    const shadowOpacity = mode === 'day'
      ? lerp(0.68, 0.78, horizonWarmth)
      : 0.62
    const dateSeed = Array.from(time.dateKey)
      .reduce((valueSoFar, character) => ((valueSoFar * 31) + character.charCodeAt(0)) >>> 0, 2166136261)

    return {
      key: `${time.dateKey}:${time.hour}:${time.minute}`,
      dateKey: time.dateKey,
      season: season.name,
      mode,
      time,
      solar,
      paper,
      shadowOpacity,
      videoRate: 0.9 + (dateSeed % 201) / 1000,
      videoPhase: (dateSeed % 10_000) / 10_000,
      theme: themeTokens(paper, season, mode),
      atmosphere: {
        '--canopy-sun-x': `${sunX.toFixed(2)}%`,
        '--canopy-sun-y': `${sunY.toFixed(2)}%`,
        '--canopy-season-angle': `${(145 + solarPhase * 34).toFixed(2)}deg`,
        '--canopy-season-sky': colorChannels(mixColor(sky, season.sky, 0.44)),
        '--canopy-season-highlight': colorChannels(season.highlight),
        '--canopy-season-horizon': colorChannels(season.horizon),
        '--canopy-season-shadow': colorChannels(season.shadow),
        '--canopy-season-opacity': mode === 'day' ? '0.34' : '0.27',
        '--canopy-season-highlight-opacity': mode === 'day' ? '0.24' : '0.14',
        '--canopy-season-horizon-opacity': (0.2 + twilight * 0.28).toFixed(3),
        '--canopy-wash-angle': `${(132 + solarPhase * 28).toFixed(2)}deg`,
        '--canopy-ambient-top': colorChannels(mixColor(sky, season.sky, 0.36)),
        '--canopy-ambient-bottom': colorChannels(mixColor(season.shadow, sky, 0.28)),
        '--canopy-ambient-highlight': colorChannels(directColor),
        '--canopy-ambient-opacity': (mode === 'day' ? lerp(0.36, 0.52, twilight) : 0.25).toFixed(3),
        '--canopy-ambient-bottom-opacity': (mode === 'day' ? 0.22 : 0.24).toFixed(3),
        '--canopy-ambient-highlight-opacity': (directOpacity * (mode === 'day' ? 0.72 : 0.35)).toFixed(3),
        '--canopy-ambient-radius': `${lerp(72, 52, daylightAltitude).toFixed(2)}%`,
        '--canopy-direct-color': colorChannels(directColor),
        '--canopy-direct-opacity': directOpacity.toFixed(3),
        '--canopy-direct-soft-opacity': (directOpacity * 0.28).toFixed(3),
        '--canopy-direct-radius': `${lerp(74, 56, daylightAltitude || moonAltitude).toFixed(2)}%`,
        '--canopy-beam-angle': `${lerp(108, 132, solarPhase).toFixed(2)}deg`,
        '--canopy-beam-color': colorChannels(mixColor(season.highlight, season.horizon, horizonWarmth)),
        '--canopy-beam-opacity': (mode === 'day'
          ? daylight * lerp(0.34, 0.12, daylightAltitude)
          : 0.02).toFixed(3),
        '--canopy-horizon-x': dusk > dawn ? '88%' : '12%',
        '--canopy-horizon-y': '82%',
        '--canopy-horizon-color': colorChannels(season.horizon),
        '--canopy-horizon-opacity': (twilight * 0.52).toFixed(3),
      },
      video: {
        '--canopy-shadow-opacity': shadowOpacity.toFixed(3),
        '--canopy-static-shadow-opacity': (shadowOpacity * 0.46).toFixed(3),
        '--canopy-video-contrast': mode === 'day' ? '1.06' : '1.12',
        '--canopy-video-brightness': mode === 'day' ? '1' : '0.94',
        '--canopy-video-sepia': mode === 'day' ? '0.03' : '0.08',
        '--canopy-video-saturation': mode === 'day' ? '1.08' : '1.26',
        '--canopy-video-hue': mode === 'day' ? '0deg' : '150deg',
      },
    }
  }

  function canopyFactory({ context, themesBaseUrl }) {
    const videoUrl = new URL('canopy/assets/leaves.mp4', themesBaseUrl).href
    const root = document.documentElement
    let currentContext = context
    let currentScene = null
    let video = null
    let scheduledFrame = 0
    let tickTimer = 0
    let previewTimer = 0
    let destroyed = false
    let activeBundle = 0
    let renderedKey = ''
    let debugTimestamp = null
    let previewPlaying = false
    let previewLastTick = 0
    let previewDayDurationSeconds = 90
    let debugHud = null
    let debugControls = null

    function clockNow() {
      return debugTimestamp ?? Date.now()
    }

    function createLayer(id, className) {
      document.getElementById(id)?.remove()
      const layer = document.createElement('div')
      layer.id = id
      layer.className = `canopy-atmosphere-layer ${className}`
      layer.setAttribute('aria-hidden', 'true')
      layer.setAttribute('contenteditable', 'false')
      document.body.append(layer)
      return layer
    }

    const bundles = ['a', 'b'].map(name => ({
      color: createLayer(`canopy-season-${name}`, 'canopy-season-color'),
      wash: createLayer(`canopy-wash-${name}`, 'canopy-ambient-wash'),
      direct: createLayer(`canopy-light-${name}`, 'canopy-direct-light'),
    }))

    function bundleElements(bundle) {
      return [bundle.color, bundle.wash, bundle.direct]
    }

    function setBundleScene(bundle, scene) {
      bundleElements(bundle).forEach(element => {
        Object.entries(scene.atmosphere).forEach(([property, value]) => {
          element.style.setProperty(property, value)
        })
      })
    }

    function activateBundle(index, immediate) {
      bundles.forEach((bundle, bundleIndex) => {
        bundleElements(bundle).forEach(element => {
          if (immediate) {
            element.style.transition = 'none'
          } else {
            element.style.removeProperty('transition')
          }
          element.classList.toggle('is-active', bundleIndex === index)
        })
      })
      if (immediate) {
        requestAnimationFrame(() => {
          if (!destroyed) {
            bundles.forEach(bundle => bundleElements(bundle).forEach(element => {
              element.style.removeProperty('transition')
            }))
          }
        })
      }
    }

    function applyRootScene(scene) {
      Object.entries(scene.theme).forEach(([property, value]) => root.style.setProperty(property, value))
      Object.entries(scene.video).forEach(([property, value]) => root.style.setProperty(property, value))
      root.classList.toggle(NIGHT_CLASS, scene.mode === 'night')
      if (video) {
        video.playbackRate = scene.videoRate
      }
    }

    function render(value = Date.now(), force = false) {
      if (destroyed) {
        return currentScene
      }
      const nextScene = sceneAt(value)
      if (!force && nextScene.key === renderedKey) {
        return currentScene
      }
      const nextBundle = renderedKey ? 1 - activeBundle : activeBundle
      setBundleScene(bundles[nextBundle], nextScene)
      applyRootScene(nextScene)
      activateBundle(nextBundle, !renderedKey || currentContext.reducedMotion)
      activeBundle = nextBundle
      renderedKey = nextScene.key
      currentScene = nextScene
      return nextScene
    }

    function updateDebugHud(scene = currentScene) {
      if (!debugControls || !scene) {
        return
      }
      debugControls.date.value = scene.dateKey
      debugControls.slider.value = String(Math.floor(scene.time.minute))
      debugControls.time.textContent = formatMinute(scene.time.minute)
      debugControls.play.textContent = previewPlaying ? '暂停' : '播放'
      debugControls.play.setAttribute('aria-pressed', String(previewPlaying))
      debugControls.speed.value = String(previewDayDurationSeconds)
      debugControls.mode.textContent = `${scene.season} · ${scene.mode}`
    }

    function pausePreview() {
      previewPlaying = false
      root.classList.remove(DEBUG_PLAYING_CLASS)
      if (previewTimer) {
        clearTimeout(previewTimer)
        previewTimer = 0
      }
      updateDebugHud()
    }

    function setDebugTime(value) {
      const timestamp = value instanceof Date
        ? value.getTime()
        : typeof value === 'number'
          ? value
          : Date.parse(value)
      if (!Number.isFinite(timestamp)) {
        throw new TypeError('Canopy debug time must be a valid Date, timestamp, or ISO string.')
      }
      pausePreview()
      debugTimestamp = timestamp
      const scene = render(debugTimestamp, true)
      updateDebugHud(scene)
      return scene
    }

    function setDebugDateMinute(dateKey, minute) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
      if (!match) {
        throw new TypeError('Canopy debug date must use YYYY-MM-DD.')
      }
      return setDebugTime(shanghaiTimestamp(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        Number(minute),
      ))
    }

    function resetDebugTime() {
      pausePreview()
      debugTimestamp = null
      const scene = render(Date.now(), true)
      updateDebugHud(scene)
      return scene
    }

    function stepDebugMinutes(amount) {
      const base = debugTimestamp ?? Date.now()
      return setDebugTime(base + Number(amount) * 60_000)
    }

    function schedulePreviewTick() {
      if (!previewTimer && previewPlaying && !destroyed) {
        previewTimer = setTimeout(runPreviewTick, 250)
      }
    }

    function runPreviewTick() {
      previewTimer = 0
      if (!previewPlaying || destroyed) {
        return
      }
      const realNow = Date.now()
      if (!currentContext.hidden) {
        const elapsedSeconds = Math.max(0, realNow - previewLastTick) / 1000
        const sceneTime = shanghaiParts(debugTimestamp ?? realNow)
        const nextMinute = sceneTime.minute
          + elapsedSeconds * 1440 / previewDayDurationSeconds
        debugTimestamp = shanghaiTimestamp(
          sceneTime.year,
          sceneTime.month,
          sceneTime.day,
          nextMinute,
        )
        updateDebugHud(render(debugTimestamp))
      }
      previewLastTick = realNow
      schedulePreviewTick()
    }

    function playPreview(options = {}) {
      const requestedDuration = typeof options === 'number'
        ? options
        : options.dayDurationSeconds
      if (requestedDuration !== undefined) {
        const duration = Number(requestedDuration)
        if (!Number.isFinite(duration) || duration <= 0) {
          throw new TypeError('Canopy preview day duration must be a positive number of seconds.')
        }
        previewDayDurationSeconds = clamp(duration, 10, 600)
      }
      if (debugTimestamp === null) {
        debugTimestamp = Date.now()
        render(debugTimestamp, true)
      }
      previewPlaying = true
      previewLastTick = Date.now()
      root.classList.add(DEBUG_PLAYING_CLASS)
      updateDebugHud()
      schedulePreviewTick()
      return getDebugState()
    }

    function togglePreview(options) {
      if (previewPlaying) {
        pausePreview()
      } else {
        playPreview(options)
      }
      return getDebugState()
    }

    function getDebugState() {
      return Object.freeze({
        dayDurationSeconds: previewDayDurationSeconds,
        playing: previewPlaying,
        timestamp: debugTimestamp,
        scene: currentScene,
      })
    }

    function createDebugButton(label, className) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = className
      button.textContent = label
      return button
    }

    function showDebugHud() {
      if (debugHud?.isConnected) {
        debugHud.hidden = false
        updateDebugHud()
        return debugHud
      }
      document.getElementById('canopy-debug-hud')?.remove()
      const hud = document.createElement('div')
      hud.id = 'canopy-debug-hud'
      hud.className = 'canopy-debug-hud'
      hud.setAttribute('role', 'group')
      hud.setAttribute('aria-label', 'Canopy 时间预览')
      hud.setAttribute('contenteditable', 'false')

      const date = document.createElement('input')
      date.type = 'date'
      date.className = 'canopy-debug-date'
      date.setAttribute('aria-label', '预览日期')

      const slider = document.createElement('input')
      slider.type = 'range'
      slider.className = 'canopy-debug-slider'
      slider.min = '0'
      slider.max = '1439'
      slider.step = '1'
      slider.setAttribute('aria-label', '预览时刻')

      const time = document.createElement('output')
      time.className = 'canopy-debug-time'

      const mode = document.createElement('span')
      mode.className = 'canopy-debug-mode'

      const play = createDebugButton('播放', 'canopy-debug-play')
      play.setAttribute('aria-pressed', 'false')

      const speed = document.createElement('select')
      speed.className = 'canopy-debug-speed'
      speed.setAttribute('aria-label', '完整一天的播放时长')
      const speedOptions = [
        [30, '30 秒/天'],
        [60, '60 秒/天'],
        [90, '90 秒/天'],
        [120, '120 秒/天'],
      ]
      speedOptions.forEach(([value, label]) => {
        const option = document.createElement('option')
        option.value = String(value)
        option.textContent = label
        speed.append(option)
      })

      const realtime = createDebugButton('实时', 'canopy-debug-realtime')
      const hide = createDebugButton('隐藏', 'canopy-debug-hide')

      slider.addEventListener('input', () => {
        const scene = currentScene ?? sceneAt(clockNow())
        setDebugDateMinute(date.value || scene.dateKey, Number(slider.value))
      })
      date.addEventListener('change', () => {
        const scene = currentScene ?? sceneAt(clockNow())
        setDebugDateMinute(date.value, scene.time.minute)
      })
      play.addEventListener('click', () => togglePreview({
        dayDurationSeconds: Number(speed.value),
      }))
      speed.addEventListener('change', () => {
        previewDayDurationSeconds = Number(speed.value)
        if (previewPlaying) {
          previewLastTick = Date.now()
        }
        updateDebugHud()
      })
      realtime.addEventListener('click', resetDebugTime)
      hide.addEventListener('click', () => {
        hud.hidden = true
      })

      hud.append(date, slider, time, mode, play, speed, realtime, hide)
      document.body.append(hud)
      debugHud = hud
      debugControls = { date, hide, mode, play, realtime, slider, speed, time }
      updateDebugHud()
      return hud
    }

    function hideDebugHud() {
      if (debugHud) {
        debugHud.hidden = true
      }
    }

    const debugApi = Object.freeze({
      getScene: () => currentScene,
      getState: getDebugState,
      hide: hideDebugHud,
      pause: pausePreview,
      play: playPreview,
      preset(name) {
        if (!Object.prototype.hasOwnProperty.call(DEBUG_PRESETS, name)) {
          throw new TypeError(`Unknown Canopy preset: ${name}`)
        }
        return setDebugTime(DEBUG_PRESETS[name])
      },
      reset: resetDebugTime,
      setTime: setDebugTime,
      show: showDebugHud,
      stepMinutes: stepDebugMinutes,
      toggle: togglePreview,
    })
    window[DEBUG_KEY] = debugApi

    function shouldPlay() {
      return !currentContext.hidden && !currentContext.reducedMotion
    }

    function setVideoActive(active) {
      root.classList.toggle(ACTIVE_CLASS, active)
      if (video) {
        video.style.opacity = active ? 'var(--canopy-shadow-opacity, 0.78)' : '0'
      }
    }

    function seedVideo(target) {
      if (!currentScene || !Number.isFinite(target.duration) || target.duration <= 0) {
        return
      }
      target.currentTime = currentScene.videoPhase * target.duration
      target.playbackRate = currentScene.videoRate
    }

    function ensureVideo() {
      if (video?.isConnected) {
        return video
      }
      document.getElementById(VIDEO_ID)?.remove()
      const target = document.createElement('video')
      video = target
      target.id = VIDEO_ID
      target.src = videoUrl
      target.loop = true
      target.autoplay = true
      target.muted = true
      target.defaultMuted = true
      target.playsInline = true
      target.preload = 'auto'
      target.setAttribute('muted', '')
      target.setAttribute('aria-hidden', 'true')
      target.setAttribute('contenteditable', 'false')
      Object.assign(target.style, {
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
      target.addEventListener('loadedmetadata', () => {
        if (!destroyed && video === target) {
          seedVideo(target)
        }
      })
      target.addEventListener('playing', () => {
        if (!destroyed && video === target && shouldPlay()) {
          setVideoActive(true)
        }
      })
      target.addEventListener('canplay', scheduleReconcile)
      target.addEventListener('error', () => {
        if (!destroyed && video === target) {
          setVideoActive(false)
        }
      })
      document.body.append(target)
      seedVideo(target)
      return target
    }

    function reconcile() {
      scheduledFrame = 0
      if (destroyed) {
        return
      }
      render(clockNow())
      if (!shouldPlay()) {
        setVideoActive(false)
        video?.pause()
        return
      }
      const target = ensureVideo()
      try {
        const playResult = target.play()
        if (playResult?.catch) {
          playResult.catch(() => {
            if (!destroyed && video === target) {
              setVideoActive(false)
            }
          })
        }
      } catch {
        setVideoActive(false)
      }
      if (!target.paused && target.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setVideoActive(true)
      }
    }

    function scheduleReconcile() {
      if (!scheduledFrame && !destroyed) {
        scheduledFrame = requestAnimationFrame(reconcile)
      }
    }

    function scheduleTick() {
      if (tickTimer || destroyed) {
        return
      }
      const delay = 60_050 - (Date.now() % 60_000)
      tickTimer = setTimeout(() => {
        tickTimer = 0
        if (!currentContext.hidden) {
          render(clockNow())
        }
        scheduleTick()
      }, delay)
    }

    render(clockNow(), true)
    scheduleTick()
    scheduleReconcile()

    return {
      update(nextContext) {
        currentContext = nextContext
        render(clockNow(), nextContext.reducedMotion)
        scheduleReconcile()
      },
      destroy() {
        if (destroyed) {
          return
        }
        destroyed = true
        if (scheduledFrame) {
          cancelAnimationFrame(scheduledFrame)
        }
        if (tickTimer) {
          clearTimeout(tickTimer)
        }
        if (previewTimer) {
          clearTimeout(previewTimer)
        }
        previewPlaying = false
        setVideoActive(false)
        video?.pause()
        video?.remove()
        video = null
        debugHud?.remove()
        debugHud = null
        debugControls = null
        bundles.forEach(bundle => bundleElements(bundle).forEach(element => element.remove()))
        ROOT_PROPERTIES.forEach(property => root.style.removeProperty(property))
        root.classList.remove(ACTIVE_CLASS, NIGHT_CLASS, DEBUG_PLAYING_CLASS)
        if (window[DEBUG_KEY] === debugApi) {
          delete window[DEBUG_KEY]
        }
      },
    }
  }

  Object.defineProperty(canopyFactory, 'sceneAt', {
    value: sceneAt,
  })

  runtime.register(THEME_ID, canopyFactory)
})()

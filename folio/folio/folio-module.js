/* Folio module for Typora Themes Runtime. */

(() => {
  const runtime = window[Symbol.for('typora-themes-runtime@1')]
  if (!runtime?.register) {
    return
  }

  runtime.register('folio', () => {
  'use strict'

  const GROUP_CLASS = 'folio-code-tab-group'
  const BAR_CLASS = 'folio-code-tabs'
  const PANEL_CLASS = 'folio-code-tab-panel'
  const ACTIVE_CLASS = 'is-active'
  const LANGUAGE_EDIT_CLASS = 'is-editing-language'
  const SINGLE_COPY_CLASS = 'folio-code-copy'
  const RECONCILE_NODE_SELECTOR = [
    'blockquote',
    '.md-fences',
    'link[rel~="stylesheet"]',
    `.${BAR_CLASS}`,
    `.${SINGLE_COPY_CLASS}`,
  ].join(', ')
  const COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"></rect><path d="M16 8V6.5A1.5 1.5 0 0 0 14.5 5h-9A1.5 1.5 0 0 0 4 6.5v9A1.5 1.5 0 0 0 5.5 17H8"></path></svg>'
  const LANGUAGE_LABELS = {
    bash: 'Bash',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    css: 'CSS',
    curl: 'cURL',
    go: 'Go',
    html: 'HTML',
    java: 'Java',
    javascript: 'JavaScript',
    js: 'JavaScript',
    json: 'JSON',
    jsx: 'JSX',
    php: 'PHP',
    plaintext: 'Text',
    python: 'Python',
    ruby: 'Ruby',
    rust: 'Rust',
    shell: 'Shell',
    sql: 'SQL',
    swift: 'Swift',
    text: 'Text',
    ts: 'TypeScript',
    tsx: 'TSX',
    typescript: 'TypeScript',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
  }

  let nextGroupId = 0
  let scheduledFrame = 0
  let destroyed = false

  function directFences(group) {
    return Array.from(group.children).filter(child =>
      child instanceof HTMLElement
      && child.classList.contains('md-fences'),
    )
  }

  function languageLabel(language, index) {
    const normalized = language.trim().toLowerCase()
    if (!normalized) {
      return `Code ${index + 1}`
    }
    return LANGUAGE_LABELS[normalized]
      ?? normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  function createCopyButton(className, label) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.title = label
    button.dataset.folioCopyLabel = label
    button.setAttribute('aria-label', label)
    button.setAttribute('contenteditable', 'false')
    button.innerHTML = COPY_ICON
    return button
  }

  function cleanupGroup(group) {
    Array.from(group.children)
      .find(child => child.classList?.contains(BAR_CLASS))
      ?.remove()

    group.classList.remove(GROUP_CLASS)
    delete group.dataset.folioTabsSignature
    delete group.dataset.folioActiveCid

    directFences(group).forEach(panel => {
      panel.classList.remove(PANEL_CLASS, ACTIVE_CLASS, LANGUAGE_EDIT_CLASS)
      if (panel.dataset.folioOriginalId !== undefined) {
        panel.id = panel.dataset.folioOriginalId
      } else if (panel.id.startsWith('folio-code-tabs-')) {
        panel.removeAttribute('id')
      }
      delete panel.dataset.folioOriginalId
      panel.removeAttribute('role')
      panel.removeAttribute('aria-labelledby')
      panel.removeAttribute('aria-hidden')
    })
  }

  function activate(group, activeIndex) {
    const bar = Array.from(group.children)
      .find(child => child.classList?.contains(BAR_CLASS))
    const tabs = bar
      ? Array.from(bar.querySelectorAll('.folio-code-tab'))
      : []
    const panels = directFences(group)
      .filter(panel => panel.classList.contains(PANEL_CLASS))

    if (!tabs.length || activeIndex < 0 || activeIndex >= panels.length) {
      return
    }

    tabs.forEach((tab, index) => {
      const active = index === activeIndex
      tab.classList.toggle(ACTIVE_CLASS, active)
      tab.setAttribute('aria-selected', String(active))
      tab.tabIndex = active ? 0 : -1
    })
    panels.forEach((panel, index) => {
      const active = index === activeIndex
      panel.classList.toggle(ACTIVE_CLASS, active)
      panel.setAttribute('aria-hidden', String(!active))
    })

    const activePanel = panels[activeIndex]
    group.dataset.folioActiveCid = activePanel.getAttribute('cid') ?? ''
    requestAnimationFrame(() => {
      const cid = activePanel.getAttribute('cid')
      if (cid) {
        window.editor?.fences?.getCm?.(cid)?.refresh?.()
      }
    })
  }

  function enhanceGroup(group) {
    const panels = directFences(group)
    const invalid = panels.length < 2
      || panels.some(panel => panel.classList.contains('md-fences-advanced'))
    if (invalid) {
      if (group.classList.contains(GROUP_CLASS)) {
        cleanupGroup(group)
      }
      return
    }

    const signature = panels
      .map((panel, index) =>
        `${panel.getAttribute('cid') ?? index}:${panel.getAttribute('lang') ?? ''}`,
      )
      .join('|')
    const existingBar = Array.from(group.children)
      .find(child => child.classList?.contains(BAR_CLASS))
    if (
      group.dataset.folioTabsSignature === signature
      && existingBar
      && panels.every(panel => panel.classList.contains(PANEL_CLASS))
    ) {
      return
    }

    const previousActiveCid = group.dataset.folioActiveCid
    cleanupGroup(group)
    group.classList.add(GROUP_CLASS)
    group.dataset.folioTabsSignature = signature

    const groupId = `folio-code-tabs-${++nextGroupId}`
    const bar = document.createElement('div')
    bar.className = BAR_CLASS
    bar.setAttribute('contenteditable', 'false')

    const tabList = document.createElement('div')
    tabList.className = 'folio-code-tab-list'
    tabList.setAttribute('role', 'tablist')
    tabList.setAttribute('aria-label', '代码语言')

    panels.forEach((panel, index) => {
      Array.from(panel.children)
        .find(child => child.classList?.contains(SINGLE_COPY_CLASS))
        ?.remove()

      const tab = document.createElement('button')
      const panelId = `${groupId}-panel-${index + 1}`
      const tabId = `${groupId}-tab-${index + 1}`
      tab.type = 'button'
      tab.className = 'folio-code-tab'
      tab.id = tabId
      tab.dataset.folioTabIndex = String(index)
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-controls', panelId)
      tab.title = '切换代码语言；语言可在代码块底部编辑'
      tab.textContent = languageLabel(panel.getAttribute('lang') ?? '', index)
      tabList.append(tab)

      if (panel.id) {
        panel.dataset.folioOriginalId = panel.id
      }
      panel.classList.add(PANEL_CLASS)
      panel.id = panelId
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('aria-labelledby', tabId)
    })

    const copyButton = createCopyButton('folio-code-tab-copy', '复制当前代码')
    bar.append(tabList, copyButton)
    group.insertBefore(bar, panels[0])

    const previousIndex = panels.findIndex(panel =>
      panel.getAttribute('cid') === previousActiveCid,
    )
    activate(group, previousIndex >= 0 ? previousIndex : 0)
  }

  function enhanceSingleCopy(fence) {
    const existingButton = Array.from(fence.children)
      .find(child => child.classList?.contains(SINGLE_COPY_CLASS))
    if (fence.classList.contains(PANEL_CLASS)) {
      existingButton?.remove()
      return
    }
    if (!existingButton) {
      fence.append(createCopyButton(SINGLE_COPY_CLASS, '复制代码'))
    }
  }

  function reconcile() {
    scheduledFrame = 0
    if (destroyed) {
      return
    }
    document.querySelectorAll('#write blockquote').forEach(group => {
      if (!group.querySelector(`.${PANEL_CLASS}.${LANGUAGE_EDIT_CLASS}`)) {
        enhanceGroup(group)
      }
    })
    document.querySelectorAll(`blockquote.${GROUP_CLASS}`).forEach(group => {
      if (!group.closest('#write')) {
        cleanupGroup(group)
      }
    })
    document.querySelectorAll('#write .md-fences:not(.md-fences-advanced)')
      .forEach(enhanceSingleCopy)
    document.querySelectorAll(`.${SINGLE_COPY_CLASS}`).forEach(button => {
      if (!button.closest('#write .md-fences:not(.md-fences-advanced)')) {
        button.remove()
      }
    })
  }

  function scheduleReconcile() {
    if (!scheduledFrame && !destroyed) {
      scheduledFrame = requestAnimationFrame(reconcile)
    }
  }

  function elementNeedsReconcile(node) {
    return node instanceof Element
      && (node.matches(RECONCILE_NODE_SELECTOR)
        || node.querySelector(RECONCILE_NODE_SELECTOR))
  }

  function mutationNeedsReconcile(mutation) {
    if (mutation.type === 'attributes') {
      return mutation.target instanceof Element
        && (mutation.target === document.documentElement
          || mutation.target.matches('blockquote, .md-fences, link[rel~="stylesheet"]'))
    }

    return Array.from(mutation.addedNodes).some(elementNeedsReconcile)
      || Array.from(mutation.removedNodes).some(elementNeedsReconcile)
  }

  function keyboardTarget(event, current, count) {
    switch (event.key) {
      case 'ArrowLeft':
        return (current - 1 + count) % count
      case 'ArrowRight':
        return (current + 1) % count
      case 'Home':
        return 0
      case 'End':
        return count - 1
      default:
        return null
    }
  }

  function panelCode(panel) {
    const cid = panel.getAttribute('cid')
    const codeMirror = cid ? window.editor?.fences?.getCm?.(cid) : null
    return codeMirror?.getValue?.()
      ?? panel.querySelector('.CodeMirror-code')?.innerText
      ?? ''
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) {
      throw new Error('Copy command failed')
    }
  }

  async function copyFence(fence, button) {
    try {
      const text = panelCode(fence)
      try {
        if (!navigator.clipboard?.writeText) {
          throw new Error('Clipboard API unavailable')
        }
        await navigator.clipboard.writeText(text)
      } catch {
        fallbackCopy(text)
      }
      button.classList.add('is-copied')
      button.title = '已复制'
      button.setAttribute('aria-label', '代码已复制')
      window.setTimeout(() => {
        const label = button.dataset.folioCopyLabel ?? '复制代码'
        button.classList.remove('is-copied')
        button.title = label
        button.setAttribute('aria-label', label)
      }, 1200)
    } catch {
      button.title = '复制失败'
      button.setAttribute('aria-label', '复制失败')
    }
  }

  function copyActive(group, button) {
    const panel = directFences(group)
      .find(item => item.classList.contains(PANEL_CLASS) && item.classList.contains(ACTIVE_CLASS))
    if (panel) {
      void copyFence(panel, button)
    }
  }

  function onClick(event) {
    const tab = event.target.closest?.('.folio-code-tab')
    if (tab) {
      const group = tab.closest(`blockquote.${GROUP_CLASS}`)
      if (group) {
        activate(group, Number(tab.dataset.folioTabIndex))
      }
      return
    }

    const copyButton = event.target.closest?.('.folio-code-tab-copy')
    const group = copyButton?.closest(`blockquote.${GROUP_CLASS}`)
    if (copyButton && group) {
      copyActive(group, copyButton)
      return
    }

    const singleCopyButton = event.target.closest?.(`.${SINGLE_COPY_CLASS}`)
    const fence = singleCopyButton?.closest('.md-fences:not(.md-fences-advanced)')
    if (singleCopyButton && fence) {
      void copyFence(fence, singleCopyButton)
    }
  }

  function onFocusIn(event) {
    const editor = event.target.closest?.(
      `.${PANEL_CLASS} .ty-cm-lang-input`,
    )
    editor?.closest(`.${PANEL_CLASS}`)?.classList.add(LANGUAGE_EDIT_CLASS)
  }

  function onFocusOut(event) {
    const editor = event.target.closest?.(
      `.${PANEL_CLASS}.${LANGUAGE_EDIT_CLASS} .ty-cm-lang-input`,
    )
    const panel = editor?.closest(`.${PANEL_CLASS}`)
    if (!panel) {
      return
    }
    panel.classList.remove(LANGUAGE_EDIT_CLASS)
    scheduleReconcile()
  }

  function onKeydown(event) {
    const languageEditor = event.target.closest?.(
      `.${PANEL_CLASS}.${LANGUAGE_EDIT_CLASS} .ty-cm-lang-input`,
    )
    if (languageEditor && (event.key === 'Enter' || event.key === 'Escape')) {
      event.preventDefault()
      event.stopPropagation()
      languageEditor.blur()
      return
    }

    const tab = event.target.closest?.('.folio-code-tab')
    const group = tab?.closest(`blockquote.${GROUP_CLASS}`)
    if (!tab || !group) {
      return
    }

    const tabs = Array.from(group.querySelectorAll(`:scope > .${BAR_CLASS} .folio-code-tab`))
    const current = tabs.indexOf(tab)
    const target = keyboardTarget(event, current, tabs.length)
    if (target === null) {
      return
    }
    event.preventDefault()
    activate(group, target)
    tabs[target]?.focus()
  }

  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutationNeedsReconcile)) {
      scheduleReconcile()
    }
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'disabled', 'href', 'lang', 'style'],
    childList: true,
    subtree: true,
  })
  document.addEventListener('click', onClick)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('keydown', onKeydown)
  scheduleReconcile()

  return {
    update() {},
    destroy() {
      destroyed = true
      observer.disconnect()
      document.removeEventListener('click', onClick)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', onKeydown)
      if (scheduledFrame) {
        cancelAnimationFrame(scheduledFrame)
      }
      document.querySelectorAll(`blockquote.${GROUP_CLASS}`).forEach(cleanupGroup)
      document.querySelectorAll(`.${SINGLE_COPY_CLASS}`).forEach(button => button.remove())
    },
  }
  })
})()

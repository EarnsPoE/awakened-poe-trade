import { toRaw } from 'vue'
import { AppConfig, saveConfig } from '@/web/Config'

// Vue 3.2 can be left with a corrupted component tree when an error is thrown
// in the middle of patching (the scheduler flush aborts half-way). After that,
// every later update of the affected widget throws again, typically
// "Cannot read properties of null (reading 'emitsOptions')", so the widget never
// re-renders: price checks silently stop opening until the page is reloaded.
//
// The tree can't be repaired in place, so we save settings and reload the page.
// The main process keeps running, so hotkeys and the game attachment are kept.

const RELOAD_STAMP_KEY = 'apt-wedge-reload-at'
// Don't reload again if the previous reload was this recent, to avoid a loop.
const MIN_RELOAD_INTERVAL_MS = 30_000

const VUE_INTERNAL_NULL_READ = /Cannot read properties of null \(reading '(emitsOptions|subTree|nextSibling|parentNode|type|el|component|insertBefore|setScopeId)'\)/
const VUE_PATCH_FRAMES = /\b(shouldUpdateComponent|updateComponent|patchBlockChildren|patchKeyedChildren|patchUnkeyedChildren|processFragment|processComponent|componentUpdateFn|flushJobs|unmountComponent|getNextHostNode|move)\b/

export function isVueTreeCorruption (err: unknown): boolean {
  if (!(err instanceof TypeError)) return false
  if (!VUE_INTERNAL_NULL_READ.test(err.message)) return false
  // In production builds Vue's function names are minified, so the message
  // alone has to be enough there.
  return !import.meta.env.DEV || VUE_PATCH_FRAMES.test(err.stack ?? '')
}

let isReloading = false
// the unpatched `console.error`, so our own messages don't re-enter `recover`
const logError = console.error.bind(console)

function recover (err: TypeError) {
  if (isReloading) return

  const lastReload = Number(sessionStorage.getItem(RELOAD_STAMP_KEY) || 0)
  if (Date.now() - lastReload < MIN_RELOAD_INTERVAL_MS) {
    logError('[wedge-recovery] UI is wedged again shortly after a reload, not reloading again', err)
    return
  }

  isReloading = true
  logError('[wedge-recovery] UI component tree is corrupted, saving settings and reloading', err)

  try {
    // `saveConfig` skips saving while an exclusive widget (price check) is open.
    // Edit the raw object so the broken renderer isn't asked to re-render.
    for (const widget of toRaw(AppConfig()).widgets) {
      if (widget.wmZorder === 'exclusive' && widget.wmWants === 'show') {
        widget.wmWants = 'hide'
      }
    }
    saveConfig()
  } catch (e) {
    logError('[wedge-recovery] failed to save settings before reload', e)
  }

  sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()))
  // let the save-config message leave the socket first
  setTimeout(() => { location.reload() }, 150)
}

export function installWedgeRecovery () {
  // Dev builds of Vue rethrow scheduler errors, so they surface here.
  window.addEventListener('unhandledrejection', (e) => {
    if (isVueTreeCorruption(e.reason)) recover(e.reason)
  })
  window.addEventListener('error', (e) => {
    if (isVueTreeCorruption(e.error)) recover(e.error)
  })

  // Production builds of Vue only pass them to `console.error`.
  console.error = (...args: unknown[]) => {
    logError(...args)
    const err = args.find(isVueTreeCorruption)
    if (err) recover(err as TypeError)
  }
}

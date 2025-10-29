export class IPage {
  protected testcase: any
  constructor(testInstance: any) {
    this.testcase = testInstance
  }
  async delay(ms?: number) {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    await sleep(ms ? ms : this.delayTime)
  }
  get delayTime() {
    return this.testcase.delaytime
  }
  get page() {
    return this.testcase.page
  }
  get logger() {
    return this.testcase.logger
  }

  /**
   * Safely click an element with robust waits and fallbacks.
   * - Re-acquires element each attempt to avoid stale references
   * - Optionally disables idle-resource waiting to prevent UIA2 idle hang
   * - Falls back to coordinate tap if element.click() fails
   */
  async clickSafe(
    selectorOrEl: string | any,
    options?: {
      retries?: number
      waitMs?: number
      disableIdleWait?: boolean
      hideKeyboard?: boolean
    }
  ) {
    const driver: any = this.page
    if (!driver) throw new Error('Driver not initialized')

    const retries = Math.max(0, options?.retries ?? 2)
    const waitMs = Math.max(1000, options?.waitMs ?? 15000)
    const disableIdleWait = options?.disableIdleWait ?? true
    const doHideKeyboard = options?.hideKeyboard ?? true

    // Best-effort: Disable idle wait to avoid long hangs on animated screens
    try {
      if (disableIdleWait && typeof driver.updateSettings === 'function') {
        await driver.updateSettings({ shouldWaitForIdleResources: false, waitForIdleTimeout: 0 })
      }
    } catch {}

    let lastErr: any = null
    for (let i = 0; i <= retries; i++) {
      try {
        // Re-acquire element each attempt
        const el: any = typeof selectorOrEl === 'string' ? await driver.$(selectorOrEl) : selectorOrEl
        // Wait conditions
        await el.waitForExist?.({ timeout: waitMs })
        await el.waitForDisplayed?.({ timeout: waitMs })
        await el.waitForEnabled?.({ timeout: waitMs })
        try { await el.waitForClickable?.({ timeout: waitMs }) } catch {}

        if (doHideKeyboard) {
          try { await driver.hideKeyboard?.() } catch {}
        }
        await el.click()
        return true
      } catch (err) {
        lastErr = err
        // Fallback: coordinate tap if we can read rect
        try {
          const el: any = typeof selectorOrEl === 'string' ? await driver.$(selectorOrEl) : selectorOrEl
          const r = await el.getRect?.()
          if (r && Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.width) && Number.isFinite(r.height)) {
            const x = Math.floor(r.x + r.width / 2)
            const y = Math.floor(r.y + r.height / 2)
            await driver.touchAction?.({ action: 'tap', x, y })
            return true
          }
        } catch {}
        // small backoff before next retry
        await new Promise((r) => setTimeout(r, 500))
      }
    }
    this.logger?.error?.(`clickSafe failed: ${lastErr}`)
    throw lastErr
  }
}

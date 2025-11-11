import fs from 'fs'
import path from 'path'

type AnyRecord = Record<string, any>

// Lightweight facade to Allure that degrades gracefully when allure-js-commons is not installed.
export class AllureAdapter {
  private runtime: any | null = null
  private Status: AnyRecord = { PASSED: 'passed', FAILED: 'failed', SKIPPED: 'skipped', BROKEN: 'broken' }
  private ContentType: AnyRecord = { TEXT: 'text/plain', PNG: 'image/png', JPEG: 'image/jpeg' }

  constructor(private resultsDir: string, private logger?: { debug?: Function; info?: Function; warn?: Function; error?: Function }) {
    try {
      // Attempt to load allure runtime from any available installation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const commons = require('allure-js-commons')
      const AllureRuntime = commons.AllureRuntime || commons.default?.AllureRuntime
      if (!AllureRuntime) {
        this.logger?.warn?.('allure-js-commons found but AllureRuntime not available; Allure disabled')
        return
      }
      this.Status = {
        PASSED: commons.Status?.PASSED || 'passed',
        FAILED: commons.Status?.FAILED || 'failed',
        SKIPPED: commons.Status?.SKIPPED || 'skipped',
        BROKEN: commons.Status?.BROKEN || 'broken',
      }
      this.ContentType = {
        TEXT: commons.ContentType?.TEXT || 'text/plain',
        PNG: commons.ContentType?.PNG || 'image/png',
        JPEG: commons.ContentType?.JPEG || 'image/jpeg',
      }
      fs.mkdirSync(resultsDir, { recursive: true })
      this.runtime = new AllureRuntime({ resultsDir })
      this.logger?.info?.(`Allure enabled. resultsDir: ${resultsDir}`)
    } catch (e) {
      // No allure-js-commons installed or unavailable – act as no-op
      this.runtime = null
      this.logger?.warn?.('Allure not active (allure-js-commons not installed). Skipping allure output.')
    }
  }

  get enabled() {
    return !!this.runtime
  }

  private mapStatus(status?: string): string {
    const s = String(status || '').toLowerCase()
    if (s === 'passed') return this.Status.PASSED
    if (s === 'failed') return this.Status.FAILED
    if (s === 'skipped') return this.Status.SKIPPED
    return this.Status.PASSED
  }

  private detectContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.png') return this.ContentType.PNG
    if (ext === '.jpg' || ext === '.jpeg') return this.ContentType.JPEG
    return this.ContentType.TEXT
  }

  // Write one consolidated run into allure-results using the existing summary data
  // data shape follows apps/api/workspace/shared-libs/core TestCase report
  writeRun(testName: string, data: AnyRecord) {
    if (!this.runtime) return
    try {
      const runtime = this.runtime
      const cases: Array<AnyRecord> = Array.isArray(data?.cases) ? data.cases : []

      // Optional high-level grouping by report/test name
      const group = runtime.startGroup?.(testName) || null

      for (const c of cases) {
        const caseName = c?.name || (Array.isArray(c?.metadata?.suitePath) ? c.metadata.suitePath.join(' › ') : 'Case')
        const test = (group?.startTest?.(caseName) || runtime.startTest?.(caseName) || null)
        if (!test) continue

        // Suite labels from metadata if available
        const suitePath: string[] | undefined = Array.isArray(c?.metadata?.suitePath)
          ? c.metadata.suitePath
          : undefined
        if (suitePath?.length) {
          // Use parentSuite / suite / subSuite labels to preserve hierarchy in Allure UI
          if (suitePath.length >= 1) test.addLabel?.('parentSuite', String(suitePath[0]))
          if (suitePath.length >= 2) test.addLabel?.('suite', String(suitePath[1]))
          if (suitePath.length >= 3) test.addLabel?.('subSuite', suitePath.slice(2).join(' › '))
        } else {
          test.addLabel?.('suite', testName)
        }

        // Attach logs and details as text files
        const logs = Array.isArray(c?.logs) ? c.logs : []
        const details = Array.isArray(c?.details) ? c.details : []
        if (logs.length) {
          try {
            test.addAttachment?.('Logs', logs.join('\n'), this.ContentType.TEXT)
          } catch {}
        }
        if (details.length) {
          try {
            test.addAttachment?.('Details', details.join('\n'), this.ContentType.TEXT)
          } catch {}
        }

        // Attach artifacts (screenshots, etc.)
        const artifacts: Array<AnyRecord> = Array.isArray(c?.artifacts) ? c.artifacts : []
        for (const art of artifacts) {
          const target = art?.path
          if (!target) continue
          // Resolve both absolute and relative paths
          const filePath = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target)
          try {
            const content = fs.readFileSync(filePath)
            const type = this.detectContentType(filePath)
            const label = art?.description ? `${art.description}` : path.basename(filePath)
            test.addAttachment?.(label, content, type)
          } catch (e) {
            this.logger?.warn?.(`Failed to attach artifact to Allure: ${filePath}: ${e}`)
          }
        }

        // Status + timings
        try {
          test.status = this.mapStatus(c?.status)
          test.stage = 'finished'
          test.endTest?.()
        } catch {}
      }

      try {
        group?.endGroup?.()
      } catch {}
    } catch (err) {
      this.logger?.warn?.(`Allure writeRun failed: ${err}`)
    }
  }
}

export function tryGenerateAllure(resultsRoot: string, testName: string, data: AnyRecord, logger?: { debug?: Function; info?: Function; warn?: Function; error?: Function }) {
  try {
    const adapter = new AllureAdapter(resultsRoot, logger)
    if (!adapter.enabled) return false
    adapter.writeRun(testName, data)
    return true
  } catch (e) {
    logger?.warn?.(`tryGenerateAllure error: ${e}`)
    return false
  }
}


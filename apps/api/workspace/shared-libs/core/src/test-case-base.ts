import { EventEmitter } from 'events'
import { Browser, Page } from 'puppeteer'
import { Browser as DriverBrowser } from 'webdriverio'
import * as fs from 'fs'
import * as path from 'path'
import { CustomLogger } from '../../types'

const isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

type CaseStatus = 'pending' | 'passed' | 'failed' | 'skipped'

type CaseArtifact = {
  path: string
  description?: string
  kind?: string
}

type CaseMetadata = Record<string, any>

type CaseResult = {
  name: string
  status: CaseStatus
  startedAt: number
  endedAt?: number
  durationMs?: number
  error?: string
  metadata?: CaseMetadata
  logs: string[]
  details: string[]
  artifacts: CaseArtifact[]
}

export class TestCase {
  public page: Page | DriverBrowser | null = null
  public browser: Browser | null = null
  protected reportData: Record<string, any> = {}
  private sharedState: {
    workspace: string
    clientId: string
    logs: string[]
    details: string[]
    exceptCounter: number
    delaytime: number
    emiter: EventEmitter
    logger: CustomLogger
    caseResults: CaseResult[]
    currentCase: CaseResult | null
    artifacts: CaseArtifact[]
    reportMetadata: Record<string, any>
  }
  constructor(logger: any, clientId: string, workspace: string) {
    const emiter = new EventEmitter()
    this.sharedState = {
      workspace,
      clientId,
      logs: [],
      details: [],
      logger,
      delaytime: 2000,
      exceptCounter: 0,
      emiter: emiter,
      caseResults: [],
      currentCase: null,
      artifacts: [],
      reportMetadata: {},
    }
    emiter.on('event', (msg) => console.log(msg))
  }
  async pagePromise() {
    return new Promise((resolve, reject) => {
      this.browser?.once('targetcreated', async (target) => {
        const newPage = await target.page()
        if (newPage) {
          await newPage.setViewport({
            width: 1920, // 宽度，例如 1920px
            height: 1080, // 高度，例如 1080px
            deviceScaleFactor: 1, // 缩放比例，1 为正常比例
            isMobile: false,
          })
          resolve(newPage)
        } else {
          reject(new Error('Failed to get new page'))
        }
      })
    })
  }

  setDelayTime(dl: number) {
    this.sharedState.delaytime = dl
  }
  setPage(p: Page | DriverBrowser) {
    this.page = p
  }
  setBrowser(br: any) {
    this.browser = br
  }
  get clientId() {
    return this.sharedState.clientId
  }
  get logger() {
    return this.sharedState.logger
  }
  get emiter() {
    return this.sharedState.emiter
  }
  get delaytime() {
    return this.sharedState.delaytime
  }
  get exceptCounter() {
    return this.sharedState.exceptCounter
  }
  get details() {
    return this.sharedState.details
  }
  setName(name: string) {
    this.reportData['caseName'] = name
  }
  setWorkspace(wks: string) {
    this.sharedState.workspace = wks
  }
  get workspace() {
    return this.sharedState.workspace
  }

  async tearUp() {
    this.reportData['startTime'] = Date.now()
  }
  async tearDown() {
    this.reportData['endTime'] = Date.now()
    this.reportData['duration'] = this.reportData.endTime - this.reportData.startTime
    this.reportData['logs'] = this.logs
    this.reportData['details'] = this.details
    this.reportData.exceptCounter = this.exceptCounter
    this.reportData['cases'] = this.sharedState.caseResults.map((item) => ({
      name: item.name,
      status: item.status === 'pending' ? 'unknown' : item.status,
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      durationMs:
        item.durationMs ??
        (item.endedAt && item.startedAt ? item.endedAt - item.startedAt : undefined),
      error: item.error,
      metadata: item.metadata,
      logs: item.logs.slice(),
      details: item.details.slice(),
      artifacts: item.artifacts.slice(),
    }))
    this.reportData['artifacts'] = this.sharedState.artifacts.slice()
    this.reportData['metadata'] = { ...this.sharedState.reportMetadata }
  }

  appendLog(log: string): void {
    this.logs.push(log)
    this.sharedState.currentCase?.logs.push(log)
  }
  get logs() {
    return this.sharedState.logs
  }
  get artifacts() {
    return this.sharedState.artifacts
  }
  getReportData() {
    return this.reportData
  }

  /** @internal */
  __beginCase(name: string, metadata?: CaseMetadata) {
    const metadataRecord = isRecord(metadata) ? metadata : {}
    const combinedMetadata = {
      ...this.sharedState.reportMetadata,
      ...metadataRecord,
    }
    const entry: CaseResult = {
      name,
      status: 'pending',
      startedAt: Date.now(),
      metadata: combinedMetadata,
      logs: [],
      details: [],
      artifacts: [],
    }
    this.sharedState.currentCase = entry
    this.sharedState.caseResults.push(entry)
    if (!this.reportData['caseName']) {
      this.reportData['caseName'] = name
    }
  }

  /** @internal */
  __finishCase(status: Exclude<CaseStatus, 'pending'>, error?: unknown) {
    const entry = this.sharedState.currentCase
    if (entry) {
      entry.status = status
      entry.endedAt = Date.now()
      entry.durationMs = Math.max(0, entry.endedAt - entry.startedAt)
      entry.error = error ? (error instanceof Error ? error.message : String(error)) : undefined
      this.sharedState.currentCase = null
    }
  }

  /** Attach additional metadata to current case */
  protected recordCaseDetail(detail: string) {
    this.sharedState.currentCase?.details.push(detail)
  }

  attachArtifact(path: string, info?: { description?: string; kind?: string }) {
    const artifact: CaseArtifact = {
      path,
      description: info?.description,
      kind: info?.kind,
    }
    this.sharedState.artifacts.push(artifact)
    this.sharedState.currentCase?.artifacts.push(artifact)
  }

  setReportMetadata(meta?: CaseMetadata) {
    if (!isRecord(meta)) return
    this.sharedState.reportMetadata = {
      ...this.sharedState.reportMetadata,
      ...meta,
    }
  }

  getReportMetadata(): CaseMetadata {
    return { ...this.sharedState.reportMetadata }
  }

  assertEqual(except: any, actual: any, description?: string) {
    this.sharedState.exceptCounter += 1
    let message = ''
    if (except === actual) {
      message = `Expected: ${except} Actual: ${actual} Result: Passed`
      this.details.push(message)
      this.recordCaseDetail(message)
      this.logger.info(message)
    } else {
      message = `Expected: ${except} Actual: ${actual} Result: Failed. description: ${description}`
      this.details.push(message)
      this.recordCaseDetail(message)
      this.logger.error(message)
      throw new Error(`Error: Expected ${except}, got ${actual}`)
    }
  }
  assertNotNull(except: any, description?: string) {
    this.sharedState.exceptCounter += 1
    let message = ''

    if (except) {
      message = `Assert: ${description} ${except} not null Result: Passed`
      this.details.push(message)
      this.recordCaseDetail(message)
      this.logger.info(message)
    } else {
      message = `Expected not null Result: Failed. description: ${description}`
      this.details.push(message)
      this.recordCaseDetail(message)
      this.logger.error(message)
      throw new Error(`Error: Expected ${except} is null `)
    }
  }
  clone() {
    const cloned = Object.create(Object.getPrototypeOf(this))
    cloned.sharedState = this.sharedState
    return cloned
  }
  async clickIfPresent(selector: string, timeout = 2000, retries = 3) {
    const driver: any = this.page
    if (!driver || typeof driver.$ !== 'function') {
      this.logger.error('clickIfPresent called without an active driver')
      return false
    }

    const attempts = Math.max(1, retries | 0)
    const rest = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    for (let attempt = 1; attempt <= attempts; attempt++) {
      let elem: any = null
      try {
        elem = await driver.$(selector)
      } catch (err) {
        this.logger.warn(`clickIfPresent attempt ${attempt}: locate ${selector} failed: ${err}`)
      }
      if (!elem || typeof elem.isExisting !== 'function') {
        if (attempt < attempts) await rest(timeout)
        continue
      }

      try {
        if (!(await elem.isExisting())) {
          if (attempt < attempts) await rest(timeout)
          continue
        }
      } catch (err) {
        this.logger.warn(`clickIfPresent attempt ${attempt}: isExisting error ${selector}: ${err}`)
        if (attempt < attempts) await rest(timeout)
        continue
      }

      try {
        await elem.waitForDisplayed?.({ timeout })
      } catch (err) {
        this.logger.warn(`clickIfPresent attempt ${attempt}: waitForDisplayed timeout ${selector}: ${err}`)
      }

      try {
        if (typeof elem.isDisplayed === 'function' && (await elem.isDisplayed())) {
          await elem.click?.()
          return true
        }
      } catch (err) {
        this.logger.warn(`clickIfPresent attempt ${attempt}: click ${selector} error: ${err}`)
      }

      if (attempt < attempts) await rest(timeout)
    }

    this.logger.error(`clickIfPresent: unable to click ${selector} after ${attempts} attempts`)
    const snapshotPath = await this.captureScreenshot(
      `${selector.replace(/[^a-z0-9_-]+/gi, '_') || 'click'}-failed`,
    )
    if (snapshotPath) {
      this.logger.error(`clickIfPresent: screenshot saved at ${snapshotPath}`)
    }
    const message = `Failed to click ${selector} after ${attempts} attempt(s)`
    throw new Error(message)
  }

  protected async captureScreenshot(label: string): Promise<string | null> {
    const safeLabel = (label || 'screenshot').replace(/[^a-z0-9_-]+/gi, '_')
    const baseDir = this.workspace
      ? path.resolve(this.workspace, 'artifacts', 'screenshots')
      : path.resolve(process.cwd(), 'artifacts', 'screenshots')
    try {
      fs.mkdirSync(baseDir, { recursive: true })
    } catch {}
    const filePath = path.join(baseDir, `${Date.now()}-${safeLabel}.png`)
    try {
      const driver: any = this.page
      if (driver && typeof driver.saveScreenshot === 'function') {
        await driver.saveScreenshot(filePath)
      } else if (driver && typeof driver.takeScreenshot === 'function') {
        const base64 = await driver.takeScreenshot()
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
      } else if (driver && typeof (driver as Page).screenshot === 'function') {
        await (driver as Page).screenshot({ path: filePath, type: 'png' } as any)
      } else if (this.browser && typeof (this.browser as any).saveScreenshot === 'function') {
        await (this.browser as any).saveScreenshot(filePath)
      } else {
        return null
      }
      this.attachArtifact(filePath, { description: label, kind: 'screenshot' })
      return filePath
    } catch (err) {
      this.logger.error(`captureScreenshot failed: ${err}`)
      return null
    }
  }
}

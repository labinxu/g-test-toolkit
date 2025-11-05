import { Injectable, NotFoundException } from '@nestjs/common'
import { exec, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { CustomLogger } from 'src/logger/logger.custom'
import { LoggerService } from 'src/logger/logger.service'
import { promisify } from 'util'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const execPromise = promisify(exec)

@Injectable()
export class CommandService {
  private logger: CustomLogger
  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('CommandService')
  }
  async runCommand(command: string, timeoutMs?: number): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execPromise(command, typeof timeoutMs === 'number' && timeoutMs > 0 ? { timeout: Math.max(100, timeoutMs) } : undefined)
      return { stdout, stderr }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Command failed: ${errorMessage}`)
    }
  }

  async home(deviceId: string) {
    await this.runCommand(`adb -s ${deviceId} shell input keyevent 3`)
  }

  async powerOn(deviceId: string) {
    // Use WAKEUP (224) instead of POWER (26) to avoid toggling screen off when it's already on
    await this.runCommand(`adb -s ${deviceId} shell input keyevent 224`)
  }
  async unlock(deviceId: string) {
    await this.runCommand(`adb -s ${deviceId} shell input keyevent 66`)
    await sleep(3000)
  }
  async wakeDevice(deviceId: string) {
    try {
      await this.powerOn(deviceId)
    } catch {}
    // Do not press HOME here to avoid sending the foreground app to background
    await sleep(200)
  }
  async dumpxml(deviceId: string) {
    // Try a couple of variants with light retries to improve reliability
    const cmds = [
      `adb -s ${deviceId} shell uiautomator dump /sdcard/window_dump.xml`,
      `adb -s ${deviceId} shell uiautomator dump --compressed /sdcard/window_dump.xml`,
      `adb -s ${deviceId} shell uiautomator dump`, // fallback to default path
      `adb -s ${deviceId} shell uiautomator dump --compressed`,
    ]
    let lastErr: any = null
    for (let attempt = 0; attempt < cmds.length; attempt++) {
      try {
        const cmd = cmds[attempt]
        const res = await this.runCommand(cmd, 5000)
        return res
      } catch (err) {
        lastErr = err
        await sleep(250)
      }
    }
    throw new NotFoundException(
      `Failed to dump UI hierarchy for device ${deviceId}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
    )
  }
  async pullDumpedXml(deviceId: string, outPath: string) {
    const pullcommand = `adb -s ${deviceId} pull /sdcard/window_dump.xml ${outPath}`
    // In some devices the file may not be immediately flushed; add retries
    let lastErr: any = null
    for (let i = 0; i < 3; i++) {
      try {
        await this.runCommand(pullcommand)
        return
      } catch (e) {
        lastErr = e
        await sleep(300)
      }
    }
    throw new Error(`Failed to pull window_dump.xml: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`)
  }
  async unlockScreen(
    deviceId: string,
    keywords = 'holding display',
    password: string,
    swipeData: string
  ) {
    const displaycommand = `adb -s ${deviceId} shell dumpsys power`
    const contains = (s: string, k: string) => {
      try { return s.toLowerCase().includes((k || '').toLowerCase()) } catch { return false }
    }
    let result = await this.runCommand(displaycommand)
    // If display is already on/holding, do nothing — avoid pressing HOME
    if (contains(result.stdout, keywords)) return
    let counter = 3
    while (!contains(result.stdout, keywords) && counter > 0) {
      counter -= 1
      await this.powerOn(deviceId)
      await sleep(200)
      result = await this.runCommand(displaycommand)
    }
    const swipeOn = `adb -s ${deviceId} shell input swipe ${swipeData}`
    await this.runCommand(swipeOn)
    const inputpassword = `adb -s ${deviceId} shell input text ${password}`
    await this.runCommand(inputpassword)
    await this.unlock(deviceId)
    // Do not press HOME after unlocking — keep/restore previous foreground app if any
  }
  async dumpNotif(deviceId: string) {
    const cmd = `adb -s ${deviceId} shell dumpsys notification`
    return await this.runCommand(cmd)
  }
  async dumpNotifWithText(deviceId: string, searchString: string) {
    const cmd = `adb -s ${deviceId} shell dumpsys notification --noredact`
    const { stdout, stderr } = await this.runCommand(cmd)
    if (stderr) {
      throw new NotFoundException(`Failed to execute ${cmd}`)
    }
    return stdout.includes(searchString)
  }
  async expandNotifBar(deviceId: string) {
    const cmd = `adb -s ${deviceId} shell cmd statusbar expand-notifications`
    await this.runCommand(cmd)
  }
  async snapshot(deviceId: string) {
    const command = `adb -s ${deviceId} shell screencap -p /sdcard/screenshot.png`
    await this.runCommand(command)
  }
  async pullSnapshot(deviceId: string, outfile: string) {
    // Fix pull path: missing slash between sdcard and filename
    const command = `adb -s ${deviceId} pull /sdcard/screenshot.png ${outfile}`
    await this.runCommand(command)
  }

  async captureScreenToFile(deviceId: string, outfile: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      try {
        const dir = path.dirname(outfile)
        try { fs.mkdirSync(dir, { recursive: true }) } catch {}
        const out = fs.createWriteStream(outfile)
        const proc = spawn('adb', ['-s', deviceId, 'exec-out', 'screencap', '-p'])
        proc.stdout.pipe(out)
        proc.on('error', (err) => reject(err))
        proc.on('close', (code) => {
          out.close()
          if (code === 0) resolve()
          else reject(new Error(`exec-out screencap exited with code ${code}`))
        })
      } catch (e) {
        reject(e as any)
      }
    })
  }

  async addFastUser(body: { url: string; userId: string }) {
    const command = `curl -X 'POST' ${body.url} -H 'accept: application/json' -H 'Content-Type: application/json' -d '{"user_id": "${body.userId}","options": {"post": true,
        "build_cache": true}}'`
    const res = await this.runCommand(command)
    return res.stdout
  }
  async redisCommand() {
    //redis-cli -h abc-qa-core-be-redis-qa1.cu5ewp.clustercfg.use1.cache.amazonaws.com -p 6379 --raw get sea:target:phone:de8915c1b7c51bee538adcda17b24888
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg'
import * as fs from 'fs'
import * as path from 'path'
import { LoggerService } from 'src/logger/logger.service'
import { CustomLogger } from 'src/logger/logger.custom'
import { StartLiveDto } from './dto/start-live.dto'

export type LiveStatus = {
  running: boolean
  inputPath?: string
  rtmpUrl?: string
  startedAt?: string
  pid?: number | null
  lastError?: string | null
  // 当前已经成功推送到文件中的时间点（秒）
  progressSec?: number
  // 输入文件总时长（秒）
  durationSec?: number
}

@Injectable()
export class LiveService {
  private logger: CustomLogger
  private currentCommand: FfmpegCommand | null = null
  private status: LiveStatus = { running: false }
  // 断点续推相关状态
  private lastOffsetSec = 0
  private inputDurationSec = 0
  private stopping = false
  private loopPromise: Promise<void> | null = null

  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('LiveService')
    const ffmpegPath = process.env.FFMPEG_PATH
    const ffprobePath = process.env.FFPROBE_PATH
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath)
    }
    if (ffprobePath) {
      ffmpeg.setFfprobePath(ffprobePath)
    }
  }

  getStatus(): LiveStatus {
    return { ...this.status }
  }

  async start(dto: StartLiveDto): Promise<LiveStatus> {
    if (this.currentCommand || this.loopPromise) {
      throw new BadRequestException('A live stream is already running')
    }

    const inputPath = path.isAbsolute(dto.inputPath)
      ? dto.inputPath
      : path.resolve(process.cwd(), dto.inputPath)
    if (!fs.existsSync(inputPath)) {
      throw new NotFoundException(`Input file not found: ${inputPath}`)
    }

    const rtmpUrl = this.resolveRtmpUrl(dto)
    if (!rtmpUrl) {
      throw new BadRequestException('rtmpUrl or (rtmpServer + streamKey) is required')
    }

    // 只在文件输入上实现断点续推
    const duration = await this.probeDuration(inputPath)
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new BadRequestException('Input file has invalid or unknown duration')
    }

    const videoKbps = Number.isFinite(dto.videoBitrateKbps)
      ? Math.max(100, Math.min(5000, dto.videoBitrateKbps!))
      : 800
    const audioKbps = Number.isFinite(dto.audioBitrateKbps)
      ? Math.max(32, Math.min(512, dto.audioBitrateKbps!))
      : 96
    const resolution = dto.resolution && dto.resolution.trim().length > 0 ? dto.resolution : '1280x720'

    this.logger.info(
      `Starting live push: input=${inputPath}, rtmp=${rtmpUrl}, video=${videoKbps}k, audio=${audioKbps}k, res=${resolution}`
    )

    const startedAt = new Date()
    this.lastOffsetSec = 0
    this.inputDurationSec = duration
    this.stopping = false

    this.status = {
      running: true,
      inputPath,
      rtmpUrl,
      startedAt: startedAt.toISOString(),
      pid: null,
      lastError: null,
      progressSec: 0,
      durationSec: duration,
    }

    // 后台循环：异常断开时自动从上次时间点继续推流，直到文件结束或手动 stop
    this.loopPromise = this.runLoop({
      inputPath,
      rtmpUrl,
      videoKbps,
      audioKbps,
      resolution,
    })

    // 不等待整个推流完成，立即返回当前状态
    return this.getStatus()
  }

  async stop(): Promise<{ stopped: boolean; status: LiveStatus }> {
    if (!this.currentCommand && !this.loopPromise && !this.status.running) {
      return { stopped: false, status: this.getStatus() }
    }
    this.logger.info('Stopping live stream')
    this.stopping = true
    try {
      if (this.currentCommand) {
        this.currentCommand.kill('SIGINT')
      }
    } catch (e) {
      this.logger.error(
        `Failed to send SIGINT to ffmpeg: ${e instanceof Error ? e.message : String(e)}`
      )
    }
    try {
      if (this.loopPromise) {
        await this.loopPromise
      }
    } catch {
      // ignore loop errors on manual stop
    }
    this.currentCommand = null
    this.loopPromise = null
    this.status = {
      ...this.status,
      running: false,
    }
    this.stopping = false
    return { stopped: true, status: this.getStatus() }
  }

  private resolveRtmpUrl(dto: StartLiveDto): string | null {
    if (dto.rtmpUrl && dto.rtmpUrl.trim().length > 0) {
      return dto.rtmpUrl.trim()
    }
    const server = dto.rtmpServer?.trim()
    const key = dto.streamKey?.trim()
    if (!server || !key) {
      return null
    }
    const base = server.replace(/\/+$/, '')
    return `${base}/${key}`
  }

  private async runLoop(params: {
    inputPath: string
    rtmpUrl: string
    videoKbps: number
    audioKbps: number
    resolution: string
  }): Promise<void> {
    const { inputPath, rtmpUrl, videoKbps, audioKbps, resolution } = params
    const maxRetriesEnv = Number(process.env.LIVE_MAX_RETRIES || '0') || 0
    const retryDelayMs = Number(process.env.LIVE_RETRY_DELAY_MS || '5000') || 5000
    const maxRetries = maxRetriesEnv < 0 ? 0 : maxRetriesEnv // 0 表示无限重试

    let retries = 0
    let offset = this.lastOffsetSec || 0

    while (!this.stopping) {
      if (this.inputDurationSec > 0 && offset >= this.inputDurationSec - 0.5) {
        this.logger.info(
          `Reached end of input at ${offset.toFixed(2)}s / ${this.inputDurationSec.toFixed(2)}s, stopping live loop`
        )
        break
      }

      const result = await this.runSinglePass({
        inputPath,
        rtmpUrl,
        videoKbps,
        audioKbps,
        resolution,
        startOffsetSec: offset,
      })

      if (this.stopping) {
        this.logger.info('Live loop stopped by user')
        break
      }

      if (result === 'completed') {
        this.logger.info('Live stream completed entire file, exiting loop')
        break
      }

      offset = this.lastOffsetSec
      if (this.inputDurationSec > 0 && offset >= this.inputDurationSec - 0.5) {
        this.logger.info(
          `Reached end of input after resume at ${offset.toFixed(2)}s, exiting loop`
        )
        break
      }

      retries += 1
      if (maxRetries > 0 && retries >= maxRetries) {
        this.logger.warn(
          `Reached LIVE_MAX_RETRIES=${maxRetries}, giving up automatic resume`
        )
        break
      }

      this.logger.warn(
        `ffmpeg stopped unexpectedly, will retry from offset=${offset.toFixed(
          2
        )}s after ${retryDelayMs}ms (retry #${retries})`
      )
      await this.sleep(retryDelayMs)
    }

    this.currentCommand = null
    this.loopPromise = null
    this.status = {
      ...this.status,
      running: false,
    }
  }

  private async runSinglePass(params: {
    inputPath: string
    rtmpUrl: string
    videoKbps: number
    audioKbps: number
    resolution: string
    startOffsetSec: number
  }): Promise<'completed' | 'interrupted'> {
    const { inputPath, rtmpUrl, videoKbps, audioKbps, resolution, startOffsetSec } = params

    return await new Promise<'completed' | 'interrupted'>((resolve) => {
      const cmd = ffmpeg(inputPath)
      this.currentCommand = cmd

      let localLastTime = startOffsetSec

      cmd.inputOptions(['-re'])
        .seekInput(startOffsetSec)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(resolution)
        .outputOptions([
          `-b:v ${videoKbps}k`,
          `-maxrate ${videoKbps}k`,
          `-bufsize ${videoKbps * 2}k`,
          `-b:a ${audioKbps}k`,
          '-preset veryfast',
          '-r 25',
          '-f flv',
          // 网络/RTMP 自动重连参数，对齐原 push-live.sh
          '-reconnect 1',
          '-reconnect_streamed 1',
          '-reconnect_at_eof 1',
          '-reconnect_delay_max 120',
          '-rtmp_buffer 3000',
        ])
        .output(rtmpUrl)
        .on('start', (commandLine: string) => {
          this.logger.info(
            `ffmpeg started at offset=${startOffsetSec.toFixed(2)}s: ${commandLine}`
          )
          const pid = (cmd as any)?.ffmpegProc?.pid ?? null
          this.status = {
            ...this.status,
            running: true,
            pid,
            lastError: null,
            progressSec: this.lastOffsetSec,
            durationSec: this.inputDurationSec,
          }
        })
        .on('progress', (progress: any) => {
          if (progress?.timemark) {
            const sec = this.parseTimemark(progress.timemark)
            if (Number.isFinite(sec)) {
              localLastTime = startOffsetSec + sec
              this.lastOffsetSec = localLastTime
              this.status = {
                ...this.status,
                progressSec: this.lastOffsetSec,
                durationSec: this.inputDurationSec,
              }
            }
          }
        })
        .on('end', () => {
          this.logger.info('ffmpeg stream ended normally')
          this.currentCommand = null
          this.status = {
            ...this.status,
            pid: null,
            lastError: null,
            progressSec: this.lastOffsetSec,
            durationSec: this.inputDurationSec,
          }
          // 如果正常结束且时间接近总时长，视为完成
          if (
            this.inputDurationSec > 0 &&
            this.lastOffsetSec >= this.inputDurationSec - 0.5
          ) {
            resolve('completed')
          } else {
            resolve('interrupted')
          }
        })
        .on('error', (err: Error, _stdout: string, stderr: string) => {
          if (this.stopping) {
            this.logger.info(`ffmpeg stopped by user: ${err?.message ?? ''}`)
          } else {
            this.logger.error(`ffmpeg error: ${err.message}`)
            if (stderr) {
              this.logger.error(stderr)
            }
          }
          this.currentCommand = null
          const msg = this.extractFfmpegErrorMessage(err, stderr)
          this.status = {
            ...this.status,
            pid: null,
            lastError: msg,
            progressSec: this.lastOffsetSec,
            durationSec: this.inputDurationSec,
          }
          resolve('interrupted')
        })

      cmd.run()
    })
  }

  private async probeDuration(inputPath: string): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          return reject(err)
        }
        const d = metadata?.format?.duration
        if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
          return resolve(d)
        }
        return reject(new Error('Unable to read duration from input'))
      })
    })
  }

  private parseTimemark(mark: string): number {
    // timemark 格式通常为 HH:MM:SS.xx
    const parts = String(mark).trim().split(':')
    if (parts.length !== 3) return 0
    const [hStr, mStr, sStr] = parts
    const h = Number(hStr) || 0
    const m = Number(mStr) || 0
    const s = Number(sStr) || 0
    return h * 3600 + m * 60 + s
  }

  private extractFfmpegErrorMessage(err: Error, stderr: string): string {
    const base = err?.message || 'ffmpeg error'
    if (!stderr) return base
    const lines = String(stderr)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length) return base
    // 优先返回包含 "error" 的最后一行，便于在前端直接看到关键原因
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      if (/error/i.test(line)) {
        return `${base}: ${line}`
      }
    }
    // 否则使用最后一行
    return `${base}: ${lines[lines.length - 1]}`
  }

  private async sleep(ms: number) {
    return await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.max(0, ms || 0))
    )
  }
}

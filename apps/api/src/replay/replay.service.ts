import { Injectable, Inject } from '@nestjs/common'
import * as fs from 'fs'
import { RecordedEvent } from './types'
import { CustomLogger } from '../logger/logger.custom'
import { ReplayGateway } from './replay.gateway'
import { forwardRef } from '@nestjs/common'
import { LoggerService } from 'src/logger/logger.service'

@Injectable()
export class ReplayService {
  private events: RecordedEvent[] = []
  private isRecording = false
  private logger: CustomLogger

  constructor(
    private readonly loggerService: LoggerService,
    @Inject(forwardRef(() => ReplayGateway))
    private readonly replayGateway: ReplayGateway
  ) {
    this.logger = this.loggerService.createLogger(ReplayGateway.name)
    console.log('ReplayService initialized', this.replayGateway)
  }

  async startRecording(url: string, clientId: string) {
    this.logger.info(`startRecording: ${url}, clientId: ${clientId}`)
    this.isRecording = true
    this.events = []
    this.replayGateway.server
      .to(clientId)
      .emit('recordingStarted', { status: 'Recording started', url })
    return { status: 'Recording started' }
  }

  async stopRecording(clientId: string) {
    this.isRecording = false
    try {
      fs.writeFileSync('recorded_events.json', JSON.stringify(this.events, null, 2))
      this.replayGateway.server.to(clientId).emit('recordingStopped', {
        status: 'Recording stopped',
        events: this.events,
      })
      return { status: 'Recording stopped', events: this.events }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.replayGateway.server.emit('recordingError', { error: errorMessage })
      throw error
    }
  }

  async getEvents() {
    try {
      const events = JSON.parse(fs.readFileSync('recorded_events.json', 'utf-8'))
      return { events }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(errorMessage)
      throw error
    }
  }

  async performInteraction(event: RecordedEvent) {
    if (!this.isRecording) {
      throw new Error('No active recording session')
    }
    try {
      this.events.push(event)
      this.logger.debug(`Processed event: ${JSON.stringify(event)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw error
    }
  }

  getEventsSync() {
    return this.events
  }

  onEvent(callback: (event: RecordedEvent) => void) {
    console.log('onEvent callback registered')
  }
}

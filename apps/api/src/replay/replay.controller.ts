import { Controller, Post, Body, Get, Param } from '@nestjs/common'
import { ReplayService } from './replay.service'

@Controller('replay')
export class ReplayController {
  constructor(private readonly replayService: ReplayService) { }

  @Post('start')
  async startRecording(@Body() body: { url: string; clientId: string }) {
    const { url, clientId } = body
    return this.replayService.startRecording(url, clientId)
  }

  @Get('stop')
  async stopRecording(@Param('clientId') clientId: string) {
    return this.replayService.stopRecording(clientId)
  }

  @Get('events')
  async getEvents() {
    return this.replayService.getEvents()
  }
}

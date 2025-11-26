import { Body, Controller, Get, Post } from '@nestjs/common'
import { StartLiveDto } from './dto/start-live.dto'
import { LiveService } from './live.service'

@Controller('live')
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  @Get('status')
  status() {
    return this.liveService.getStatus()
  }

  @Post('start')
  async start(@Body() dto: StartLiveDto) {
    return await this.liveService.start(dto)
  }

  @Post('stop')
  async stop() {
    return await this.liveService.stop()
  }
}


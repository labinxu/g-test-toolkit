import { Module } from '@nestjs/common'
import { ReplayController } from './replay.controller'
import { ReplayService } from './replay.service'
import { ReplayGateway } from './replay.gateway'
import { LoggerModule } from 'src/logger/logger.module'

@Module({
  imports: [LoggerModule],
  controllers: [ReplayController],
  providers: [ReplayService, ReplayGateway],
  exports: [ReplayGateway],
})
export class ReplayModule { }

import { Module } from '@nestjs/common'
import { LiveService } from './live.service'
import { LiveController } from './live.controller'
import { LoggerModule } from 'src/logger/logger.module'

@Module({
  imports: [LoggerModule],
  controllers: [LiveController],
  providers: [LiveService],
  exports: [LiveService],
})
export class LiveModule {}


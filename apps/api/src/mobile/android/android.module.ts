import { Module } from '@nestjs/common';
import {AndroidService} from './android.service';
import { AndroidController} from './android.controller';
import { CommandService } from 'src/command/command.service';
import { LoggerService } from 'src/logger/logger.service';
import { LoggerModule } from 'src/logger/logger.module';
@Module({
  imports: [LoggerModule],
  controllers: [AndroidController],
  providers: [CommandService,LoggerService, AndroidService],
})
export class AndroidModule {}

import { Module } from '@nestjs/common';
import {AndroidService} from './android.service';
import { AndroidController} from './android.controller';
import { LoggerModule } from 'src/logger/logger.module';
import { CommandModule } from 'src/command/command.module';
@Module({
  imports: [LoggerModule,CommandModule],
  controllers: [AndroidController],
  providers: [ AndroidService],
})
export class AndroidModule {}

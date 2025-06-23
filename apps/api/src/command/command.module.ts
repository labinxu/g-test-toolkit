import { Module } from '@nestjs/common';
import { CommandService } from './command.service';
import { CommandController } from './command.controller';
import { LoggerModule } from 'src/logger/logger.module';
@Module({
  imports: [LoggerModule],

  providers: [CommandService],
  controllers: [CommandController],
  exports: [CommandService]
})
export class CommandModule {}

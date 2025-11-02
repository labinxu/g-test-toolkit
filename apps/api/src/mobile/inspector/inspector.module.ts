import { Module } from '@nestjs/common';
import { InspectorService } from './inspector.service';
import { InspectorController } from './inspector.controller';
import { LoggerModule } from 'src/logger/logger.module';
import { CommandModule } from 'src/command/command.module';
import { AndroidModule } from '../android/android.module';

@Module({
  imports: [LoggerModule, CommandModule, AndroidModule],
  controllers: [InspectorController],
  providers: [InspectorService],
  exports: [InspectorService],
})
export class InspectorModule {}

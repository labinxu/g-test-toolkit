import { Module } from '@nestjs/common';
import { FlutterController } from './flutter.controller';
import { FlutterService } from './flutter.service';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [LoggerModule],
  controllers: [FlutterController],
  providers: [FlutterService],
  exports: [FlutterService],
})
export class FlutterModule {}


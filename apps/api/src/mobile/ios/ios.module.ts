import { Module } from '@nestjs/common';
import { IosController } from './ios.controller';
import { IosService } from './ios.service';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [LoggerModule],
  controllers: [IosController],
  providers: [IosService],
  exports: [IosService],
})
export class IosModule {}

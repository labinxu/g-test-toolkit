import { Module } from '@nestjs/common';

import {AndroidModule} from './mobile/android/android.module';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { CommandModule } from './command/command.module';
import { LoggerService } from './logger/logger.service';
import { TestCaseModule } from './test-cases/testcases.module';
import { LoggerGateway } from './logger/logger.gateway';
import { FilesModule } from './files/files.module';
@Module({
  imports: [AndroidModule,CommandModule, TestCaseModule,FilesModule],
  controllers: [AppController],
  providers: [AppService,LoggerService,LoggerGateway],
})
export class AppModule {}

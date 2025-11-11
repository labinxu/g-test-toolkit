import { Module } from '@nestjs/common';
import { AndroidModule } from './mobile/android/android.module';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { CommandModule } from './command/command.module';
import { LoggerService } from './logger/logger.service';
import { TestCaseModule } from './test-cases/testcases.module';
import { LoggerGateway } from './logger/logger.gateway';
import { FilesModule } from './files/files.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/entities/user.entity';
import { TestCase } from './report/entities/testcase.entity';
import { Setting } from './settings/setting.entity';
import { ReportModule } from './report/report.module';
import { LoggerModule } from './logger/logger.module';
import { InspectorModule } from './mobile/inspector/inspector.module';
import { SettingsModule } from './settings/settings.module';
import { AiModule } from './ai/ai.module';
import { TraceabilityModule } from './traceability/traceability.module';
import { Requirement } from './traceability/entities/requirement.entity';
import { ReqTestMap } from './traceability/entities/req-test-map.entity';
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: '../../database/auth_db.sqlite',
      entities: [User, TestCase, Setting, Requirement, ReqTestMap],
      synchronize: true,
    }),
    AndroidModule,
    CommandModule,
    TestCaseModule,
    FilesModule,
    AuthModule,
    ReportModule,
    LoggerModule,
    InspectorModule,
    AiModule,
    SettingsModule,
    TraceabilityModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService, LoggerGateway],
})
export class AppModule {}

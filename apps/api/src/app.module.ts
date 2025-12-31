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
import { ApiTestBaseUrl } from './api-tests/api-test-base-url.entity';
import { UserScenario } from './user-scenarios/entities/user-scenario.entity';
import { UserScenarioStep } from './user-scenarios/entities/user-scenario-step.entity';
import { ActionPage } from './user-scenarios/entities/action-page.entity';
import { ActionPageElement } from './user-scenarios/entities/action-page-element.entity';
import { ActionPageAction } from './user-scenarios/entities/action-page-action.entity';
import { ActionParam } from './user-scenarios/entities/action-param.entity';
import { ActionPlatform } from './user-scenarios/entities/action-platform.entity';
import { UserScenarioOption } from './user-scenarios/entities/user-scenario-option.entity';
import { EnvTemplate } from './user-scenarios/entities/env-template.entity';
import { UserScenariosModule } from './user-scenarios/user-scenarios.module';
import { ApiTestsModule } from './api-tests/api-tests.module';
import { CurlModule } from './curl/curl.module';
import { FlutterModule } from './mobile/flutter/flutter.module';
import { LiveModule } from './live/live.module';
import { UserScenarioSuite } from './user-scenarios/entities/user-scenario-suite.entity';
import { AuthAssetsModule } from './auth-assets/auth-assets.module';
import { UserScenarioSuiteCase } from './user-scenarios/entities/user-scenario-suite-case.entity';
import { ActorsModule } from './actors/actors.module';
import { Actor } from './actors/entities/actor.entity';
import { ActorEnv } from './actors/entities/actor-env.entity';
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: '../../database/auth_db.sqlite',
      entities: [
        User,
        TestCase,
        Setting,
        Requirement,
        ReqTestMap,
        ApiTestBaseUrl,
        UserScenario,
        UserScenarioStep,
        ActionPage,
        ActionPageElement,
        ActionPageAction,
        ActionParam,
        ActionPlatform,
        UserScenarioOption,
        EnvTemplate,
        UserScenarioSuite,
        UserScenarioSuiteCase,
        Actor,
        ActorEnv,
      ],
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
    ApiTestsModule,
    CurlModule,
    FlutterModule,
    UserScenariosModule,
    LiveModule,
    AuthAssetsModule,
    ActorsModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService, LoggerGateway],
})
export class AppModule {}

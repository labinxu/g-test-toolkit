import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserScenario } from './entities/user-scenario.entity';
import { UserScenarioStep } from './entities/user-scenario-step.entity';
import { ActionPage } from './entities/action-page.entity';
import { ActionPageAction } from './entities/action-page-action.entity';
import { ActionParam } from './entities/action-param.entity';
import { ActionPlatform } from './entities/action-platform.entity';
import { ActionPageElement } from './entities/action-page-element.entity';
import { UserScenarioOption } from './entities/user-scenario-option.entity';
import { UserScenariosService } from './user-scenarios.service';
import { UserScenariosController } from './user-scenarios.controller';
import { AiModule } from '../ai/ai.module';
import { ActionCatalogService } from './action-catalog.service';
import { ActionCatalogAdminController } from './action-catalog-admin.controller';
import { User } from '../auth/entities/user.entity';
import { EnvTemplate } from './entities/env-template.entity';
import { EnvTemplatesController } from './env-templates.controller';
import { UserScenarioSuite } from './entities/user-scenario-suite.entity';
import { UserScenarioSuiteCase } from './entities/user-scenario-suite-case.entity';
import { Actor } from '../actors/entities/actor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserScenario,
      UserScenarioStep,
      ActionPage,
      ActionPageAction,
      ActionPageElement,
      ActionParam,
      ActionPlatform,
      UserScenarioOption,
      User,
      EnvTemplate,
      UserScenarioSuite,
      UserScenarioSuiteCase,
      Actor,
    ]),
    AiModule,
  ],
  providers: [UserScenariosService, ActionCatalogService],
  controllers: [UserScenariosController, ActionCatalogAdminController, EnvTemplatesController],
  exports: [UserScenariosService, ActionCatalogService],
})
export class UserScenariosModule {}

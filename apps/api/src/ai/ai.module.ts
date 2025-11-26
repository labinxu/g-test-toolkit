import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { InspectorModule } from '../mobile/inspector/inspector.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [InspectorModule, SettingsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

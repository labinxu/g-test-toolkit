import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { User } from '../auth/entities/user.entity';
import { ApiTestBaseUrl } from '../api-tests/api-test-base-url.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Setting, User, ApiTestBaseUrl])],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}

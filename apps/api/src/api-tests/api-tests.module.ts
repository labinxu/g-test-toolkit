import { Module } from '@nestjs/common';
import { FastifyMulterModule } from '@nest-lab/fastify-multer';

import { LoggerModule } from 'src/logger/logger.module';
import { SettingsModule } from 'src/settings/settings.module';
import { ApiTestsController } from './api-tests.controller';
import { ApiTestsService } from './api-tests.service';

@Module({
  imports: [
    LoggerModule,
    SettingsModule,
    FastifyMulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  controllers: [ApiTestsController],
  providers: [ApiTestsService],
})
export class ApiTestsModule {}

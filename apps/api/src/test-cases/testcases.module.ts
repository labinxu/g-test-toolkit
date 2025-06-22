import { Module } from '@nestjs/common';

import { CommandModule } from 'src/command/command.module';
import { TestCasesService } from './testcases.service';
import { TestCasesController } from './testcases.controller';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { LoggerModule } from 'src/logger/logger.module';
@Module({
  imports: [CommandModule,
    LoggerModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './cases',
        filename: (req, file, cb) => {
          const filename = file.originalname;
          cb(null, filename);
        },
      }),
      limits:{ fileSize: 5 * 1024 * 1024 },
    }),],
  controllers: [TestCasesController],
  providers: [TestCasesService,],
})
export class TestCaseModule {}

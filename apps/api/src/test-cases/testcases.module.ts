import { Module } from '@nestjs/common';

import { CommandModule } from 'src/command/command.module';
import { LoggerService } from 'src/logger/logger.service';
import { TestCasesService } from './testcases.service';
import { TestCasesController } from './testcases.controller';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
@Module({
  imports: [CommandModule,
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
  providers: [TestCasesService,LoggerService],
})
export class TestCaseModule {}

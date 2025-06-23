import { Module } from '@nestjs/common';

import { CommandModule } from 'src/command/command.module';
import { TestCasesService } from './testcases.service';
import { TestCasesController } from './testcases.controller';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { LoggerModule } from 'src/logger/logger.module';
import { AndroidService } from 'src/mobile/android/android.service';
import { AndroidModule } from 'src/mobile/android/android.module';
import { CommandService } from 'src/command/command.service';
@Module({
  imports: [
    CommandModule,
    LoggerModule,
    AndroidModule,
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
  providers: [CommandService, TestCasesService,AndroidService],
})
export class TestCaseModule {}

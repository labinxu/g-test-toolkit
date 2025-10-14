import { Module } from '@nestjs/common';

import { CommandModule } from 'src/command/command.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestCase } from 'src/report/entities/testcase.entity';
import { TestCasesService } from './testcases.service';
import { TestCasesController } from './testcases.controller';
import { FastifyMulterModule } from '@nest-lab/fastify-multer';
import { LoggerModule } from 'src/logger/logger.module';
import { AndroidModule } from 'src/mobile/android/android.module';
import { ReportModule } from 'src/report/report.module';
import { FilesModule } from 'src/files/files.module';
import { IosModule } from 'src/mobile/ios/ios.module';
@Module({
  imports: [
    FastifyMulterModule.register({
      dest: './uploads', // Store files on disk
      // storage: diskStorage({ destination: './uploads', filename: editFileName }), // Optional: custom storage
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    }),
    TypeOrmModule.forFeature([TestCase]),
    CommandModule,
    LoggerModule,
    AndroidModule,
    IosModule,
    ReportModule,
    FilesModule,
  ],
  controllers: [TestCasesController],
  providers: [
    TestCasesService,
  ],
})
export class TestCaseModule {}

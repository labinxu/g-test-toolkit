import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/logger/logger.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
@Module({
  imports: [LoggerModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}

import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/logger/logger.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestCase } from './entities/testcase.entity';
@Module({
  imports: [TypeOrmModule.forFeature([TestCase]), LoggerModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}

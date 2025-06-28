import { Controller, Body, Post } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportDto } from './dto/report.dto';
import { LoggerService } from 'src/logger/logger.service';
import { CustomLogger } from 'src/logger/logger.custom';

@Controller()
export class ReportController {
  private logger: CustomLogger;
  constructor(
    private readonly reportService: ReportService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger('ReportController');
  }

  @Post('/generate')
  generate(@Body() reportDto: ReportDto) {
    this.logger.debug(
      `generate report ${reportDto.caseName} ${reportDto.reportPath}`,
    );

    // return this.reportService.generate();
  }
}

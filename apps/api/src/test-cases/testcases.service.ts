import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { CustomLogger } from 'src/logger/logger.custom';
@Injectable()
export class TestCasesService {
   private logger: CustomLogger;

  constructor(
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger('TeseCases');
  }


 async start(){
  this.logger.debug('start test case.')
  }
}

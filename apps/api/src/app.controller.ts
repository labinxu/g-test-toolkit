import { Controller,Body, Get,Post,UseInterceptors,UploadedFile, BadRequestException,} from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('/start')
  start(){
    return this.appService.start();
  }

}

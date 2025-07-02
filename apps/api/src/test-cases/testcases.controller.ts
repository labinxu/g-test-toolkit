import {
  Controller,
  Body,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
  Res,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { statSync } from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { TestCasesService } from './testcases.service';
import { StartTestCaseDto, TestCaseDto } from './dto/start-testcase-dto';
import { readFileSync } from 'fs';
import { FilesService } from 'src/files/files.service';

@Controller('testcase')
export class TestCasesController {
  constructor(
    private readonly testCasesService: TestCasesService,
    private readonly filesService: FilesService,
  ) {}

  @Post('/')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caseName: {
          type: 'string',
          description: 'The name of the test case',
          example: 'TestCase1',
        },
      },
      required: ['file', 'caseName'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async startTestCase(
    @UploadedFile() file: Express.Multer.File,
    @Body() startTestCaseDto: StartTestCaseDto,
  ) {
    if (!file || startTestCaseDto.caseName === '') {
      throw new BadRequestException('No file uploaded!');
    }
    // Validation for caseName is handled by class-validator in StartTestCaseDto
    readFileSync(`./cases/${file.originalname}`);
  }
  @Post('run')
  async run(@Body('code') jscode: string) {
    return await this.testCasesService.run(jscode);
  }

  @Post('run/script')
  async runScript(@Body() caseDto: TestCaseDto) {
    try {
      this.testCasesService.runcase(caseDto.code, caseDto.clientId);
      return { message: 'ok' };
    } catch (err) {
      throw new NotFoundException(err);
    }
  }
  @Get('execute')
  async execute(
    @Query('scriptpath') scriptpath: string,
    @Query('clientId') clientId: string,
  ) {
    try {
      const absPath = path.resolve(process.cwd(), 'user-cases', scriptpath);
      const stat = statSync(absPath);
      let message = '';
      if (stat.isFile()) {
        this.testCasesService.executeFile(absPath, clientId);
        message = `execute file ${absPath}`;
      } else if (stat.isDirectory()) {
        message = `execute dir ${absPath}`;
        this.testCasesService.executeDir(absPath, clientId);
      }
      //this.testCasesService.runDir(scriptpath);
      return { message, clientId };
    } catch (err) {
      throw new NotFoundException(err);
    }
  }

  @Get('init')
  async init(@Res() res: Response) {
    try {
      console.log('init call');
      const functions = this.filesService.makeTypesFile();
      const content = functions.join('');
      res.type('text/plain').send({ content });
    } catch (err) {
      throw new NotFoundException('make types file failed');
    }
  }
}

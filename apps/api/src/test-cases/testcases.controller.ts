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
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { TestCasesService } from './testcases.service';
import { StartTestCaseDto, TestCaseDto } from './dto/start-testcase-dto';
import { readFileSync } from 'fs';

@Controller('testcase')
export class TestCasesController {
  constructor(private readonly testCasesService: TestCasesService) {}

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
      return await this.testCasesService.runcase(
        caseDto.code,
        caseDto.useBrowser,
        caseDto.clientId,
      );
    } catch (err) {}
  }

  @Get('init')
  async init(@Res() res: Response) {
    try {
      const content = readFileSync('./cases/types/test-case.d.ts', 'utf8');
      res.type('text/plain').send({ content });
    } catch (err) {
      throw new NotFoundException('test-case.d.ts not found');
    }
  }
}

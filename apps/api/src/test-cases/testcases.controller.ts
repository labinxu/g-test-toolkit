import {
  Controller,
  Body,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { TestCasesService } from './testcases.service';
import { StartTestCaseDto } from './dto/start-testcase-dto';
@Controller()
export class TestCasesController {
  constructor(private readonly testCasesService: TestCasesService) {}

  @Post('/testcase')
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
    console.log(file.originalname);
  }
}

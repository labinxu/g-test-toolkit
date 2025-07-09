import {
  Controller,
  Body,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
  Res,
  Req,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { statSync, mkdirSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import * as path from 'path';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { TestCasesService } from './testcases.service';
import { StartTestCaseDto } from './dto/start-testcase-dto';
import { readFileSync, existsSync } from 'fs';
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
  @Get('execute')
  @UseGuards(AuthGuard('jwt'))
  async execute(
    @Query('scriptpath') scriptpath: string,
    @Query('clientId') clientId: string,
  ) {
    const reportDir = path.dirname(scriptpath).replace('cases', 'reports');
    try {
      const absPath = path.resolve(process.cwd(), scriptpath);
      const stat = statSync(absPath);
      let message = '';
      if (stat.isFile()) {
        this.testCasesService.executeFile(absPath, clientId, reportDir);
      } else if (stat.isDirectory()) {
        message = `execute dir ${absPath}`;
      }
      //this.testCasesService.runDir(scriptpath);
      return { message, clientId };
    } catch (err) {
      throw new NotFoundException(err);
    }
  }
  @Get('bundle')
  @UseGuards(AuthGuard('jwt'))
  async executeBundle(
    @Query('scriptpath') scriptpath: string,
    @Query('clientId') clientId: string,
  ) {
    try {
      const absPath = path.resolve(process.cwd(), scriptpath);
      const stat = statSync(absPath);
      let message = '';
      if (stat.isFile()) {
        const reportDir = path.dirname(absPath).replace('cases', 'reports');
        if (!existsSync(reportDir)) {
          mkdirSync(reportDir, { recursive: true });
        }
        this.testCasesService.executeFile(absPath, clientId, reportDir);
        message = `execute file ${absPath}`;
      } else if (stat.isDirectory()) {
        message = `execute dir ${absPath}`;
        const reportDir = absPath.replace('cases', 'reports');
        if (!existsSync(reportDir)) {
          mkdirSync(reportDir, { recursive: true });
        }
        const filesContent: { [filename: string]: string } = {};
        const files = await readdir(absPath);
        await Promise.all(
          files.map(async (file) => {
            const fullPath = path.join(absPath, file);
            console.log(fullPath);
            filesContent[fullPath] = await readFile(fullPath, 'utf-8');
          }),
        );

        this.testCasesService.executeTestFiles(
          filesContent,
          clientId,
          reportDir,
        );
      }
      return { message, clientId };
    } catch (err) {
      throw new NotFoundException(err);
    }
  }

  @Get('init')
  @UseGuards(AuthGuard('jwt'))
  async init(@Res() res: Response) {
    try {
      const content = this.filesService.makeTypesFile();

      res.type('text/plain').send({ content });
    } catch (err) {
      throw new NotFoundException('make types file failed');
    }
  }
}

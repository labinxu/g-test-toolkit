import {
  Controller,
  Post,
  Get,
  Res,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { statSync, mkdirSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import * as path from 'path';
import { FastifyReply as Response } from 'fastify';
//import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { TestCasesService } from './testcases.service';
import { FilesService } from 'src/files/files.service';
import { existsSync } from 'fs';
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
      res.type('text/plian');
      res.send({ content });
    } catch (err) {
      throw new NotFoundException('make types file failed');
    }
  }
}

import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  Req,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as path from 'path';
import { FastifyReply as Response } from 'fastify';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { TestCasesService } from './testcases.service';
import { FilesService } from 'src/files/files.service';
import * as fs from 'fs';
import { FastifyRequest as Request } from 'fastify';
import { checkPath, getErrorMessage } from 'src/common/utils';
import { RunTestCaseDto, RunTestCaseFileDto } from './dto/run-testcase-dto';
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
      const stat = fs.statSync(absPath);
      let message = '';
      if (stat.isFile()) {
      } else if (stat.isDirectory()) {
        message = `execute dir ${absPath}`;
      }
      //this.testCasesService.runDir(scriptpath);
      return { message, clientId };
    } catch (err) {
      throw new NotFoundException(err);
    }
  }
  @Get('listcases')
  @UseGuards(AuthGuard('jwt'))
  async listCases(@Req() req: Request, @Query('depth') depth: number = 3) {
    const user = req.user;
    const userDir = checkPath(user['username']);
    const absPath = path.normalize(
      path.join(process.cwd(), 'workspace/users', userDir, 'cases'),
    );
    const baseDir = path.resolve(process.cwd());
    if (!absPath.startsWith(baseDir)) {
      throw new Error(
        'Access to paths outside the working directory is forbidden',
      );
    }
    return await this.filesService.getTree(absPath, depth);
  }
  @Get('bundle')
  @UseGuards(AuthGuard('jwt'))
  async executeBundle(
    @Query('scriptpath') scriptpath: string,
    @Query('clientId') clientId: string,
  ) {
    console.log('clientid', clientId);
    try {
      const absPath = path.resolve(process.cwd(), scriptpath);
      const stat = fs.statSync(absPath);
      let message = '';
      if (stat.isFile()) {
        const reportDir = path.dirname(absPath).replace('cases', 'reports');
        if (!fs.existsSync(reportDir)) {
          fs.mkdirSync(reportDir, { recursive: true });
        }
        message = `execute file ${absPath}`;
      } else if (stat.isDirectory()) {
        message = `execute dir ${absPath}`;
        const reportDir = absPath.replace('cases', 'reports');
        if (!fs.existsSync(reportDir)) {
          fs.mkdirSync(reportDir, { recursive: true });
        }
        const filesContent: { [filename: string]: string } = {};
        const files = fs.readdirSync(absPath);
        if (files.length === 0) {
          return { message: 'no files', clientId };
        }
        await Promise.all(
          files.map(async (file) => {
            const fullPath = path.join(absPath, file);
            console.log(fullPath);
            filesContent[fullPath] = fs.readFileSync(fullPath, 'utf-8');
          }),
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

  @Get('interfaces')
  @UseGuards(AuthGuard('jwt'))
  async interfaces(@Res() res: Response) {
    try {
      const interfs = await this.testCasesService.getInterfaces();
      res.type('application/json');
      res.send(interfs);
    } catch (err) {
      throw new NotFoundException('make types file failed');
    }
  }

  @Get('corelib')
  async corelib(@Query('clientId') clientId: string) {
    try {
      this.testCasesService.buildCoreLib(clientId);
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }

    return { result: 'ok', message: 'building...' };
  }

  @Get('gettrlib')
  async gettrlib(@Query('clientId') clientId: string) {
    try {
      this.testCasesService.buildGettrLib(clientId);
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }
    return { result: 'ok', message: 'building...' };
  }

  @Post('runpath')
  async runTestCaseFile(@Body() runTestCaseFileDto: RunTestCaseFileDto) {
    const baseDir = path.resolve(__dirname, '../..');
    const dir = runTestCaseFileDto.filePath;

    // Sanitize the input path to prevent path traversal
    const sanitizedDir = checkPath(dir);

    // Resolve the path safely
    const absPath = path.join(baseDir, sanitizedDir);

    // Ensure the resolved path stays within baseDir
    if (!absPath.startsWith(baseDir)) {
      throw new Error('Path traversal attempt detected');
    }

    console.log(absPath);
    const code = fs.readFileSync(absPath);
    try {
      this.testCasesService.runInSandbox(
        code.toString('utf-8'),
        runTestCaseFileDto.clientId,
      );
    } catch (err) {
      throw new NotFoundException(getErrorMessage(err));
    }

    return { result: 'ok', message: 'Running...' };
  }
}

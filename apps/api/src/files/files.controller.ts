import {
  Controller,
  Get,
  Query,
  Put,
  Body,
  Post,
  Res,
  UseGuards,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // 获取目录树
  @Get('tree')
  @UseGuards(AuthGuard('jwt'))
  async getDirTree(
    @Query('dir') dir: string = '.',
    @Query('depth') depth: number = 2,
  ) {
    const baseDir = path.resolve(process.cwd(), dir);
    async function getTree(currentPath: string, depthLeft: number) {
      if (depthLeft < 0) return [];
      const files = await fs.readdir(currentPath, { withFileTypes: true });
      const result = [];
      for (const file of files) {
        const fullPath = path.join(currentPath, file.name);
        if (file.isDirectory()) {
          result.push({
            name: file.name,
            path: path.relative(process.cwd(), fullPath),
            isDirectory: true,
            children: await getTree(fullPath, depthLeft - 1),
          });
        } else {
          result.push({
            name: file.name,
            path: path.relative(process.cwd(), fullPath),
            isDirectory: false,
          });
        }
      }
      return result;
    }
    return await getTree(baseDir, depth);
  }
  @Get('testmodule')
  @UseGuards(AuthGuard('jwt'))
  async init(@Res() res: Response) {
    try {
      const content = this.filesService.makeTypesFile();
      res.type('text/plain').send({ content });
    } catch (err) {
      throw new NotFoundException('make types file failed');
    }
  }
  // 获取文件内容
  @Get('script')
  @UseGuards(AuthGuard('jwt'))
  async getFile(@Query('path') filePath: string, @Res() res: Response) {
    const absPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absPath, 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(content);
  }
  @Get('read')
  @UseGuards(AuthGuard('jwt'))
  async readFile(@Query('path') filePath: string, @Res() res: Response) {
    const absPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(content);
  }
  @Get('types')
  @UseGuards(AuthGuard('jwt'))
  async types(@Res() res: Response) {
    const content = this.filesService.makeTypesFile();
    res.type('text/plain').send({ content });
  }
  // 保存文件内容
  @Put()
  @UseGuards(AuthGuard('jwt'))
  async saveFile(@Body() body: { path: string; content: string }) {
    const absPath = path.resolve(process.cwd(), body.path);
    await fs.writeFile(absPath, body.content, 'utf-8');
    return { success: true };
  }
  @Post('mkdir')
  @UseGuards(AuthGuard('jwt'))
  async createDirectory(@Body() body: { dir: string }) {
    const absPath = path.resolve(process.cwd(), body.dir);
    await fs.mkdir(absPath, { recursive: true });
    return { success: true };
  }

  // 新建文件
  @Post('create')
  @UseGuards(AuthGuard('jwt'))
  async createFile(@Body() body: { path: string; content?: string }) {
    const absPath = path.resolve(process.cwd(), body.path);
    await fs.writeFile(absPath, body.content || '', 'utf-8');
    return { success: true };
  }
  @Delete('delete')
  @UseGuards(AuthGuard('jwt'))
  async deleteFileOrFolder(@Body() body: { path: string }) {
    const absPath = path.resolve(process.cwd(), body.path);
    try {
      const stat = await fs.lstat(absPath);
      if (stat.isDirectory()) {
        await fs.rm(absPath, { recursive: true, force: true });
      } else {
        await fs.unlink(absPath);
      }
      return { success: true };
    } catch (error) {
      let errorMsg = '';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else {
        errorMsg = String(error);
      }
      return { success: false, error: errorMsg };
    }
  }
}

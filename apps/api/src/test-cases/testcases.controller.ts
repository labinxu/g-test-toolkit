import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Res,
  Req,
  NotFoundException,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import * as path from 'path'
import { FastifyReply as Response } from 'fastify'
import { ApiBody, ApiConsumes } from '@nestjs/swagger'
import { TestCasesService } from './testcases.service'
import { LoggerGateway } from 'src/logger/logger.gateway'
import { FilesService } from 'src/files/files.service'
import * as fs from 'fs'
import { FastifyRequest as Request } from 'fastify'
import { checkPath, getErrorMessage, sanitizeUsername } from 'src/common/utils'
import { RunTestCaseFileDto } from './dto/run-testcase-dto'
import { InstallAppDto } from './dto/install-app.dto'
import { remote } from 'webdriverio'
import { AndroidService } from 'src/mobile/android/android.service'
import * as dotcfg from 'dotenv'
dotcfg.config()

@Controller('testcase')
export class TestCasesController {
  constructor(
    private readonly testCasesService: TestCasesService,
    private readonly filesService: FilesService,
    private readonly androidService: AndroidService,
    private readonly loggerGateway: LoggerGateway
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
  async execute(@Query('scriptpath') scriptpath: string, @Query('clientId') clientId: string) {
    const reportDir = path.dirname(scriptpath).replace('cases', 'reports')
    console.log(reportDir)
    try {
      const absPath = path.resolve(process.cwd(), scriptpath)
      const stat = fs.statSync(absPath)
      let message = ''
      if (stat.isFile()) {
      } else if (stat.isDirectory()) {
        message = `execute dir ${absPath}`
      }
      //this.testCasesService.runDir(scriptpath);
      return { message, clientId }
    } catch (err) {
      throw new NotFoundException(err)
    }
  }
  @Get('listcore')
  @UseGuards(AuthGuard('jwt'))
  async listcore(@Query('depth') depth: 3) {
    const absPath = path.normalize(path.join(process.cwd(), 'workspace', 'shared-libs'))
    const baseDir = path.resolve(process.cwd())
    if (!absPath.startsWith(baseDir)) {
      throw new Error(`Access to paths outside the working directory is forbidden ${absPath}`)
    }
    return await this.filesService.getTree(absPath, depth)
  }
  @Get('listcases')
  @UseGuards(AuthGuard('jwt'))
  async listCases(@Req() req: Request, @Query('depth') depth: number = 3) {
    const user = req.user
    const userDir = checkPath(user['username'])
    const absPath = path.normalize(path.join(process.cwd(), 'workspace/users', userDir, 'cases'))
    const baseDir = path.resolve(process.cwd())
    if (!absPath.startsWith(baseDir)) {
      throw new Error(`Access to paths outside the working directory is forbidden ${absPath}`)
    }
    return await this.filesService.getTree(absPath, depth)
  }
  @Get('listapps')
  async listApps(@Req() req: Request, @Query('depth') depth: number = 3) {
    const absPath = path.normalize(path.join(process.cwd(), 'workspace/app'))
    const baseDir = path.resolve(process.cwd())
    if (!absPath.startsWith(baseDir)) {
      throw new Error(`Access to paths outside the working directory is forbidden ${absPath}`)
    }
    return await this.filesService.getTree(absPath, depth)
  }

  @Post('apps/install')
  @UseGuards(AuthGuard('jwt'))
  async installApp(@Body() installAppDto: InstallAppDto): Promise<{
    result: string
    installed: number
    serials: string[]
    message: string
  }> {
    const serials = Array.from(
      new Set(
        (installAppDto.serials ?? [])
          .map((serial) => serial?.trim())
          .filter((serial): serial is string => !!serial)
      )
    )
    if (serials.length === 0) {
      throw new BadRequestException('At least one device serial is required')
    }
    try {
      const absolutePath = await this.filesService.getAppFileAbsolutePath(installAppDto.filePath)
      const result = await this.androidService.installAppOnEmulators(serials, absolutePath, {
        force: !!installAppDto.force,
      })
      return {
        result: 'ok',
        installed: result.installed,
        serials: result.serials,
        message: result.message,
      }
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error))
    }
  }
  @Get('bundle')
  @UseGuards(AuthGuard('jwt'))
  async executeBundle(
    @Query('scriptpath') scriptpath: string,
    @Query('clientId') clientId: string
  ) {
    try {
      const absPath = path.resolve(process.cwd(), scriptpath)
      const stat = fs.statSync(absPath)
      let message = ''
      if (stat.isFile()) {
        const reportDir = path.dirname(absPath).replace('cases', 'reports')
        if (!fs.existsSync(reportDir)) {
          fs.mkdirSync(reportDir, { recursive: true })
        }
        message = `execute file ${absPath}`
      } else if (stat.isDirectory()) {
        message = `execute dir ${absPath}`
        const reportDir = absPath.replace('cases', 'reports')
        if (!fs.existsSync(reportDir)) {
          fs.mkdirSync(reportDir, { recursive: true })
        }
        const filesContent: { [filename: string]: string } = {}
        const files = fs.readdirSync(absPath)
        if (files.length === 0) {
          return { message: 'no files', clientId }
        }
        await Promise.all(
          files.map(async (file) => {
            const fullPath = path.join(absPath, file)
            console.log(fullPath)
            filesContent[fullPath] = fs.readFileSync(fullPath, 'utf-8')
          })
        )
      }
      return { message, clientId }
    } catch (err) {
      throw new NotFoundException(err)
    }
  }

  @Get('init')
  @UseGuards(AuthGuard('jwt'))
  async init(@Res() res: Response) {
    try {
      const content = this.filesService.makeTypesFile()
      res.type('text/plian')
      res.send({ content })
    } catch (err) {
      throw new NotFoundException('make types file failed')
    }
  }

  @Get('corelib')
  async corelib(@Query('clientId') clientId: string) {
    try {
      await this.testCasesService.buildCoreLib(clientId)
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error))
    }

    return { result: 'ok', message: 'building...' }
  }

  @Get('gettrlib')
  async gettrlib(@Query('clientId') clientId: string) {
    try {
      await this.testCasesService.buildGettrWebLib(clientId)
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error))
    }
    return { result: 'ok', message: 'building...' }
  }

  @Post('cleanup-android')
  @UseGuards(AuthGuard('jwt'))
  async cleanupAndroid(
    @Body('clientId') clientId?: string,
    @Body('sessionKey') sessionKey?: string
  ) {
    try {
      const result = sessionKey
        ? await this.testCasesService.cleanupSharedSessionByKey(sessionKey)
        : clientId
          ? await this.testCasesService.cleanupKeptAndroidSessionsFor(clientId)
          : await this.testCasesService.cleanupKeptAndroidSessions()
      return { result: 'ok', ...result }
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error))
    }
  }

  @Get('buildlibs')
  async buildLibs(@Query('clientId') clientId: string) {
    try {
      await this.testCasesService.buildCoreLib(clientId)
      await this.testCasesService.buildGettrWebLib(clientId)
      await this.testCasesService.buildGettrAndroidLib(clientId)
      await this.testCasesService.buildLibsComplete(clientId)
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error))
    }
    return { result: 'ok', message: 'building...' }
  }

  @Get('report-tree')
  @UseGuards(AuthGuard('jwt'))
  async getReportTree(
    @Req() req: Request,
    @Query('platform') platform?: string,
    @Query('module') moduleName?: string,
    @Query('root') root?: 'user' | 'shared',
    @Query('depth') depth?: number
  ) {
    const username =
      typeof req?.user === 'object' && (req.user as any)?.username
        ? sanitizeUsername((req.user as any)?.username)
        : 'default'
    const rootType = root === 'shared' ? 'shared' : 'user'
    const base =
      rootType === 'shared'
        ? path.join(process.env.WORKSPACE, 'reports')
        : path.join(process.env.WORKSPACE, 'users', username, 'reports')
    const safePlatform = (platform || '')
      .toString()
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '')
    const safeModule = (moduleName || '')
      .toString()
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '')
    const targetDir = path.join(base, safePlatform || '', safeModule || '')
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true })
    }
    const depthVal = depth && Number.isFinite(depth) ? Number(depth) : 4
    return await this.filesService.getTree(targetDir, depthVal)
  }

  @Delete('report')
  @UseGuards(AuthGuard('jwt'))
  async deleteReport(@Body() body: { path: string }) {
    const relPath = (body?.path || '').toString().trim()
    if (!relPath) {
      throw new BadRequestException('path is required')
    }
    const absPath = path.resolve(process.cwd(), relPath)
    if (!absPath.startsWith(path.resolve(process.cwd(), 'workspace'))) {
      throw new BadRequestException('invalid path')
    }
    if (!fs.existsSync(absPath)) {
      throw new NotFoundException(`file not found: ${relPath}`)
    }
    const stat = fs.statSync(absPath)
    if (stat.isDirectory()) {
      await fs.promises.rm(absPath, { recursive: true, force: true })
      return { success: true, deleted: relPath }
    }

    const dir = path.dirname(absPath)
    const base = path.basename(absPath, path.extname(absPath))
    const entries = await fs.promises.readdir(dir)
    for (const name of entries) {
      if (name.startsWith(base)) {
        const target = path.join(dir, name)
        try {
          await fs.promises.rm(target, { recursive: true, force: true })
        } catch {
          // ignore single-file errors
        }
      }
    }
    try {
      const remaining = await fs.promises.readdir(dir)
      if (remaining.length === 0) {
        await fs.promises.rmdir(dir)
      }
    } catch {
      // ignore
    }
    return { success: true, deleted: relPath }
  }

  @Post('screenshot')
  async uploadScreenshot(
    @Req() req: Request,
    @Body()
    body: {
      data: string
      platform?: string
      module?: string
      caseName?: string
      filename?: string
      root?: 'user' | 'shared'
    }
  ) {
    const raw = (body?.data || '').trim()
    if (!raw) {
      throw new BadRequestException('data (base64) is required')
    }
    const username =
      typeof req?.user === 'object' && (req.user as any)?.username
        ? sanitizeUsername((req.user as any)?.username)
        : 'default'
    const rootType = body?.root === 'shared' ? 'shared' : 'user'
    const safePlatform = (body?.platform || '').toString().replace(/[<>:"/\\|?*]+/g, '')
    const safeModule = (body?.module || '').toString().replace(/[<>:"/\\|?*]+/g, '')
    const safeCase = (body?.caseName || 'case').toString().replace(/[<>:"/\\|?*]+/g, '')
    const ts = Date.now()
    const safeFile =
      (body?.filename || `${safePlatform || 'web'}-${safeModule || 'module'}-${safeCase}-${ts}.png`).replace(
        /[<>:"/\\|?*]+/g,
        '_'
      )

    const baseDir =
      rootType === 'shared'
        ? path.join(process.env.WORKSPACE, 'reports')
        : path.join(process.env.WORKSPACE, 'users', username, 'reports')
    const targetDir = path.join(baseDir, safePlatform || '', safeModule || '', safeCase || '', 'screenshots')
    await fs.promises.mkdir(targetDir, { recursive: true })

    const base64 = raw.startsWith('data:image') ? raw.split(',').pop() || '' : raw
    if (!base64) {
      throw new BadRequestException('invalid base64 payload')
    }
    const buf = Buffer.from(base64, 'base64')
    const absPath = path.join(targetDir, safeFile)
    await fs.promises.writeFile(absPath, buf)
    const relPath = path.relative(process.cwd(), absPath)
    return { path: relPath }
  }

  // Provide a bundle of .d.ts files for editor intellisense
  @Get('typings')
  async typings() {
    try {
      const bundle = await this.testCasesService.getTypingsBundle()
      return { result: 'ok', ...bundle }
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error))
    }
  }
  @Post('runpath')
  @UseGuards(AuthGuard('jwt'))
  async runTestCaseFile(@Req() req: Request, @Body() runTestCaseFileDto: RunTestCaseFileDto) {
    const baseDir = path.resolve(__dirname, '../..')
    const dir = runTestCaseFileDto.filePath

    // Sanitize the input path to prevent path traversal
    const sanitizedDir = checkPath(dir)

    // Resolve the path safely
    const absPath = path.join(baseDir, sanitizedDir)

    // Ensure the resolved path stays within baseDir
    if (!absPath.startsWith(baseDir)) {
      throw new Error('Path traversal attempt detected')
    }
    const code = fs.readFileSync(absPath)
    const username = typeof req?.user === 'object' ? (req.user as any)?.username : undefined

    const reportUserDir = path.normalize(path.join(process.env.USERS_DIR, username))

    const keepAppOpenOption =
      runTestCaseFileDto.keepAppOpen === undefined ? undefined : !!runTestCaseFileDto.keepAppOpen
    const shareSessionOption =
      runTestCaseFileDto.shareSession === undefined ? undefined : !!runTestCaseFileDto.shareSession
    const parseMetaFromPath = (p: string) => {
      const safe = path.normalize(p || '').split(path.sep).filter(Boolean)
      const idxCases = safe.lastIndexOf('cases')
      const idxSuites = safe.lastIndexOf('suites')
      const idx = idxCases >= 0 ? idxCases : idxSuites
      const platform = idx >= 0 && safe[idx + 1] ? safe[idx + 1] : undefined
      const moduleName = idx >= 0 && safe[idx + 2] ? safe[idx + 2] : undefined
      const fileName = safe[safe.length - 1] || ''
      const caseName = fileName.replace(/\.[^.]+$/, '')
      return { platform, module: moduleName, caseName }
    }
    const reportMeta = parseMetaFromPath(runTestCaseFileDto.filePath || '')
    try {
      void this.testCasesService.runInChildProcess(
        code.toString('utf-8'),
        runTestCaseFileDto.clientId,
        {
          keepAppOpen: keepAppOpenOption,
          shareSession: shareSessionOption,
          sessionKey: runTestCaseFileDto.sessionKey,
          userDir: reportUserDir,
          envConfig: (runTestCaseFileDto as any).envConfig,
          reportMeta,
        }
      )
    } catch (err) {
      throw new NotFoundException(getErrorMessage(err))
    }

    return { result: 'ok', message: 'Running...' }
  }
  @Get('livestream')
  async livestream(@Query('clientId') clientId: string) {
    try {
      console.log(`Livestream ${clientId}`)
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error))
    }

    return { result: 'ok', message: 'pushing livestream' }
  }

  @Post('stop')
  @UseGuards(AuthGuard('jwt'))
  async stop(@Body('clientId') clientId?: string, @Body('sessionKey') sessionKey?: string) {
    try {
      if (!clientId && !sessionKey) {
        throw new BadRequestException('clientId or sessionKey is required')
      }
      if (clientId) {
        try {
          this.loggerGateway.sendExitTo(clientId)
        } catch {}
      }
      // cooperative stop flag for currently running sandbox
      if (clientId) {
        try {
          const g = globalThis as any
          const flags: Map<string, { requested: boolean }> | undefined = g.__gttStopFlags
          const ref = flags?.get(clientId)
          if (ref) {
            ref.requested = true
          }
        } catch {}
      }
      if (clientId) {
        try {
          await this.testCasesService.killRunnerForClient(clientId)
        } catch {}
      }
      // Best-effort cleanup of sessions
      try {
        if (sessionKey) {
          await this.testCasesService.cleanupSharedSessionByKey(sessionKey)
        } else if (clientId) {
          await this.testCasesService.cleanupKeptAndroidSessionsFor(clientId)
        }
      } catch {}
      return { result: 'ok', message: 'Stop requested' }
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error))
    }
  }
  @Get('test-ios')
  async testios() {
    const caps = {
      platformName: 'iOS',
      'appium:platformVersion': '18.6',
      'appium:deviceName': 'iPhone 16',
      'appium:udid': '7BC31BC4-D09A-4FDD-8010-725D1295061B',
      'appium:automationName': 'XCUITest',
      'appium:app': '/Users/laibin/Downloads/getter.ipa',
      'appium:xcodeSigningId': 'iPhone Developer',
      'appium:updatedWDABundleId': 'com.gettr.WebDriverAgentRunner',
      'appium:useNewWDA': true,
      'appium:showXcodeLog': true,
      'appium:wdaStartupRetries': 3,
      'appium:autoGrantPermissions': true,
      'appium:autoAcceptAlerts': true,
      'appium:fullReset': true,
      'appium:noReset': false,
    }

    const opts = {
      path: '/',
      port: 4723,
      capabilities: {
        ...caps,
      },
    }
    const driver = await remote(opts)
    // 你的测试代码
    await driver.deleteSession()
    return { result: 'ok', message: 'pushing livestream' }
  }
}

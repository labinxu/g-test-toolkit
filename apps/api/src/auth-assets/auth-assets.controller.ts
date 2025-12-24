import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { FastifyRequest as Request } from 'fastify'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { getErrorMessage, sanitizeUsername } from 'src/common/utils'
import { TestCasesService } from 'src/test-cases/testcases.service'

type AuthAccount = {
  id: string
  label?: string | null
  username: string
  password: string
  notes?: string | null
}

function safeId(value: string) {
  const raw = (value || '').toString().trim()
  if (!raw) return ''
  return raw.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
}

@Controller('auth-assets')
@UseGuards(AuthGuard('jwt'))
export class AuthAssetsController {
  constructor(private readonly testCasesService: TestCasesService) {}

  private resolveUsersRoot(): string {
    const usersDir = process.env.USERS_DIR?.trim()
    if (usersDir) return path.resolve(process.cwd(), usersDir)
    return path.resolve(process.cwd(), 'workspace', 'users')
  }

  private resolveUserAuthDir(username: string): string {
    const root = this.resolveUsersRoot()
    return path.resolve(root, username, 'auth')
  }

  private async ensureDir(dir: string) {
    try {
      await fsp.mkdir(dir, { recursive: true })
    } catch (e) {
      throw new BadRequestException(`Failed to create dir: ${dir}. ${getErrorMessage(e)}`)
    }
  }

  private getUsername(req: Request): string {
    const raw =
      typeof req?.user === 'object' && (req.user as any)?.username ? (req.user as any).username : ''
    const username = sanitizeUsername((raw || 'default').toString())
    if (!username) {
      throw new BadRequestException('Invalid username')
    }
    return username
  }

  private accountsFilePath(username: string) {
    const authDir = this.resolveUserAuthDir(username)
    return path.join(authDir, 'accounts.json')
  }

  @Get('accounts')
  async listAccounts(@Req() req: Request) {
    const username = this.getUsername(req)
    const authDir = this.resolveUserAuthDir(username)
    await this.ensureDir(authDir)
    const file = this.accountsFilePath(username)
    if (!fs.existsSync(file)) {
      return { items: [] as AuthAccount[], path: path.relative(process.cwd(), file) }
    }
    const raw = await fsp.readFile(file, 'utf-8')
    let parsed: any = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
    const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : []
    const normalized: AuthAccount[] = items
      .map((it: any) => ({
        id: safeId(String(it?.id || '')),
        label: it?.label != null ? String(it.label) : null,
        username: String(it?.username || ''),
        password: String(it?.password || ''),
        notes: it?.notes != null ? String(it.notes) : null,
      }))
      .filter((it) => !!it.id && !!it.username)
    return { items: normalized, path: path.relative(process.cwd(), file) }
  }

  @Put('accounts')
  async saveAccounts(@Req() req: Request, @Body() body: { items?: AuthAccount[] }) {
    const username = this.getUsername(req)
    const authDir = this.resolveUserAuthDir(username)
    await this.ensureDir(authDir)
    const file = this.accountsFilePath(username)

    const rawItems = Array.isArray(body?.items) ? body.items : []
    const items: AuthAccount[] = rawItems
      .map((it: any) => ({
        id: safeId(String(it?.id || '')),
        label: it?.label != null ? String(it.label) : null,
        username: String(it?.username || ''),
        password: String(it?.password || ''),
        notes: it?.notes != null ? String(it.notes) : null,
      }))
      .filter((it) => !!it.id && !!it.username)

    const payload = {
      items,
      updatedAt: new Date().toISOString(),
    }
    await fsp.writeFile(file, JSON.stringify(payload, null, 2), 'utf-8')
    return { result: 'ok', items, path: path.relative(process.cwd(), file) }
  }

  @Get('cookies')
  async listCookieFiles(@Req() req: Request) {
    const username = this.getUsername(req)
    const authDir = this.resolveUserAuthDir(username)
    await this.ensureDir(authDir)
    const entries = await fsp.readdir(authDir, { withFileTypes: true })
    const files = []
    for (const ent of entries) {
      if (!ent.isFile()) continue
      if (!ent.name.endsWith('.cookies.json')) continue
      const abs = path.join(authDir, ent.name)
      let stat: fs.Stats | null = null
      try {
        stat = await fsp.stat(abs)
      } catch {
        stat = null
      }
      files.push({
        name: ent.name,
        path: path.relative(process.cwd(), abs),
        size: stat?.size ?? null,
        updatedAt: stat?.mtime?.toISOString?.() ?? null,
      })
    }
    files.sort((a, b) => a.name.localeCompare(b.name))
    return { items: files, dir: path.relative(process.cwd(), authDir) }
  }

  @Post('cookies/record')
  async recordCookies(
    @Req() req: Request,
    @Body()
    body: {
      clientId?: string
      accountId?: string
      domain?: string
      headless?: boolean
      timeoutMs?: number
    },
  ) {
    const username = this.getUsername(req)
    const authDir = this.resolveUserAuthDir(username)
    await this.ensureDir(authDir)

    const clientId = (body?.clientId || '').toString().trim()
    if (!clientId) {
      throw new BadRequestException('clientId is required (from websocket)')
    }

    const accountId = safeId(String(body?.accountId || ''))
    if (!accountId) {
      throw new BadRequestException('accountId is required')
    }

    const domain = (body?.domain || '').toString().trim()
    if (!domain) {
      throw new BadRequestException('domain is required')
    }

    const timeoutMs = body?.timeoutMs != null ? Number(body.timeoutMs) : undefined

    // Load account secret from accounts.json
    const accFile = this.accountsFilePath(username)
    if (!fs.existsSync(accFile)) {
      throw new NotFoundException('accounts.json not found; please add an account first')
    }
    let accJson: any = null
    try {
      accJson = JSON.parse(await fsp.readFile(accFile, 'utf-8'))
    } catch (e) {
      throw new BadRequestException(`Failed to parse accounts.json: ${getErrorMessage(e)}`)
    }
    const items = Array.isArray(accJson?.items) ? accJson.items : Array.isArray(accJson) ? accJson : []
    const found = items.find((it: any) => safeId(String(it?.id || '')) === accountId)
    if (!found) {
      throw new NotFoundException(`accountId not found: ${accountId}`)
    }
    const loginUser = String(found?.username || '').trim()
    const loginPass = String(found?.password || '')
    if (!loginUser || !loginPass) {
      throw new BadRequestException('account username/password is missing')
    }

    const outputRel = path.join('auth', `${accountId}.cookies.json`)
    const userDir = path.normalize(path.join(process.env.USERS_DIR?.trim() || 'workspace/users', username))

    const code = `
import { describe, it, useTestCase } from 'core-lib';
import { HomePage } from 'gettr-lib';

describe('[auth] record cookies', () => {
  const cfg = ((globalThis as any)?.params?.envConfig?.cookieRecorder ?? {}) as any;
  const tc = useTestCase({
    module: 'auth',
    browser: {
      headless: !!cfg.headless,
      debug: false,
      timeout: cfg.timeoutMs || 60000,
      domain: cfg.domain,
    },
  });

  it('record cookies', async () => {
    const home = new HomePage(tc as any);
    const loginPage = await home.clickLoginButton();
    await loginPage.loginAccount(String(cfg.username || ''), String(cfg.password || ''));
    const saved = await (tc as any).exportCookies(String(cfg.output || 'auth/cookies.cookies.json'));
    console.log('COOKIES_SAVED:' + saved);
  });
});
`

    const envConfig = {
      cookieRecorder: {
        accountId,
        domain,
        headless: !!body?.headless,
        timeoutMs: timeoutMs && Number.isFinite(timeoutMs) ? timeoutMs : undefined,
        output: outputRel,
        username: loginUser,
        password: loginPass,
      },
    }

    try {
      void this.testCasesService.runInChildProcess(code, clientId, {
        userDir,
        envConfig,
        reportMeta: { platform: 'gettr-web', module: 'auth', caseName: `record-cookies-${accountId}` },
      })
    } catch (e) {
      throw new BadRequestException(getErrorMessage(e))
    }

    return { result: 'ok', output: outputRel, userDir }
  }
}


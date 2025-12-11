import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPage } from './entities/action-page.entity';
import { ActionPageAction } from './entities/action-page-action.entity';
import { ActionParam } from './entities/action-param.entity';
import { ActionPlatform } from './entities/action-platform.entity';
import { ActionPageElement } from './entities/action-page-element.entity';
import { ActionCatalogService } from './action-catalog.service';
import { User } from '../auth/entities/user.entity';
import { ensureAdminOrBootstrap } from '../settings/admin.util';
import * as fs from 'fs';
import * as path from 'path';
import { Project, ScriptTarget, ts } from 'ts-morph';
import { ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nest-lab/fastify-multer';
import { File as FastifyMulterFile } from 'fastify-multer/lib/interfaces';

type AnyRec = Record<string, any>;

@Controller('action-catalog')
export class ActionCatalogAdminController {
  constructor(
    @InjectRepository(ActionPage)
    private readonly pageRepo: Repository<ActionPage>,
    @InjectRepository(ActionPageAction)
    private readonly actionRepo: Repository<ActionPageAction>,
    @InjectRepository(ActionPageElement)
    private readonly elementRepo: Repository<ActionPageElement>,
    @InjectRepository(ActionPlatform)
    private readonly platformRepo: Repository<ActionPlatform>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly catalog: ActionCatalogService,
  ) {}

  private normalizePlatform(input?: string): string {
    const raw = (input || '').trim().toLowerCase();
    return raw || 'gettr-web';
  }

  /**
   * 简单 CSV 解析：支持带引号的字段及跨行（多行）单元格。
   * - 仅按逗号分隔列；
   * - 双引号内的逗号和换行不会被视为分隔符；
   * - 单元格内容会做 trim，外层成对引号会被去掉；
   * - 返回的每一行只要存在至少一个非空单元格就会被保留。
   */
  private parseCsvRows(raw: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;

    const pushCell = () => {
      let v = current;
      v = v.trim();
      v = v.replace(/^"|"$/g, '');
      row.push(v);
      current = '';
    };

    const pushRowIfNotEmpty = () => {
      if (!row.length) return;
      const hasValue = row.some((c) => (c || '').trim().length > 0);
      if (hasValue) {
        rows.push(row.map((c) => c.trim()));
      }
      row = [];
    };

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"') {
        if (inQuotes && raw[i + 1] === '"') {
          // 转义双引号 ""
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        pushCell();
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        // 行结束（处理 CRLF）
        if (ch === '\r' && raw[i + 1] === '\n') {
          i++;
        }
        pushCell();
        pushRowIfNotEmpty();
      } else {
        current += ch;
      }
    }

    // 文件结尾的最后一个单元格 / 行
    if (current.length > 0 || row.length > 0) {
      pushCell();
      pushRowIfNotEmpty();
    }

    return rows;
  }

  private splitElementIds(raw: string): string[] {
    const replaced = (raw || '')
      .replace(/；/g, ';')
      .replace(/，/g, ',')
      .replace(/、/g, ',');
    const tokens = replaced
      .split(/[,;\n\r\t ]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const looksLikeId = /^[A-Za-z0-9_.:-]+$/;
    return tokens.filter((s) => looksLikeId.test(s));
  }

  private derivePageKeyFromLabel(label: string): string {
    const raw = (label || '').trim();
    if (!raw) return 'page';
    const withDashes = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2');
    const cleaned = withDashes
      // 将逗号和其它常见分隔符视为连字符
      .replace(/[,\uFF0C\u3001/\\]+/g, '-')
      // 其余非单词字符统一替换为 -
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return cleaned.toLowerCase() || 'page';
  }

  private buildClassNameFromPageKey(key: string): string {
    const norm = (key || '').trim();
    if (!norm) return 'Page';
    const parts = norm.split(/[-_]+/).filter(Boolean);
    if (!parts.length) return 'Page';
    return (
      parts
        .map((p) => (p[0] ? p[0].toUpperCase() + p.slice(1) : p))
        .join('') + 'Page'
    );
  }

  private async getLibSrcDirForPlatform(
    platform: string,
  ): Promise<string | null> {
    const plat = this.normalizePlatform(platform);
    const rec = await this.platformRepo.findOne({ where: { key: plat } });
    if (!rec) return null;
    const dirName = (rec.libDir || rec.key || '').trim();
    if (!dirName) return null;
    const root = path.join(
      __dirname,
      '../..',
      'workspace',
      'shared-libs',
      dirName,
    );
    return path.join(root, 'src');
  }

  private sanitizeIdentifier(raw: string, fallback: string): string {
    let out = (raw || '').trim();
    if (!out) out = fallback;
    out = out.replace(/[^A-Za-z0-9_]/g, '_');
    if (!out) out = fallback;
    if (/^[0-9]/.test(out)) out = `_${out}`;
    return out;
  }

  private async ensureLibTsFileForPage(page: ActionPage) {
    const platform = this.normalizePlatform(page.platform);
    if (platform === 'gettr-web') {
      await this.ensureWebLibTsFileForPage(page);
      return;
    }
    if (platform === 'gettr-android') {
      await this.ensureAndroidLibTsFileForPage(page);
      return;
    }
    // 其他平台（如 gettr-ios）暂不自动生成具体实现，
    // 后续可按各自 Page API 扩展对应生成逻辑。
  }

  /** Web 平台（gettr-web）Page TS 文件生成与占位方法维护 */
  private async ensureWebLibTsFileForPage(page: ActionPage) {
    const srcDir = await this.getLibSrcDirForPlatform(page.platform);
    if (!srcDir) return;
    const className = page.className || 'Page';
    const baseRaw = className.replace(/Page$/, '') || page.key || 'page';
    const fileBase = baseRaw.toLowerCase();
    const fileName = `${fileBase}-page.ts`;
    const filePath = path.join(srcDir, fileName);
    const headerMarker = '// AUTO-GENERATED: ACTION-CATALOG';

    const actions = page.actions || [];

    // Collect return targets that need imports
    const returnTargets = new Map<string, string>();
    for (const act of actions) {
      const rawTarget = (act.returnTarget || '').trim();
      if (!rawTarget || rawTarget === 'this' || rawTarget === className) {
        continue;
      }
      const targetClass = rawTarget;
      const targetBaseRaw = targetClass.replace(/Page$/, '') || targetClass;
      const targetFileBase = targetBaseRaw.toLowerCase();
      returnTargets.set(targetClass, targetFileBase);
    }

    const buildFullContent = (): string => {
      const lines: string[] = [];
      lines.push(headerMarker);
      lines.push(`import { IPage } from './interface/ipage';`);
      for (const [targetClass, targetFileBase] of returnTargets) {
        lines.push(
          `import { ${targetClass} } from './${targetFileBase}-page';`,
        );
      }
      lines.push('');
      lines.push(`export class ${className} extends IPage {`);
      lines.push(`  constructor(ins: any) {`);
      lines.push(`    super(ins);`);
      lines.push('  }', '');
      if (actions.length === 0) {
        lines.push(
          `  // TODO: 根据实际页面结构补充具体操作与断言方法。`,
        );
      } else {
        lines.push(
          `  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。`,
        );
        const methodNameByKey = new Map<string, string>();
        for (const act of actions) {
          const methodSafe = this.sanitizeIdentifier(
            act.method || act.key || '',
            `action${act.id || ''}`,
          );
          methodNameByKey.set(act.key, methodSafe);
        }
        for (const act of actions) {
          const methodSafe = methodNameByKey.get(act.key)!;
          const isAssert = (act.kind as any) === 'assert';
          const locatorRaw = (act.locator || '').trim();
          const locatorLit = locatorRaw ? JSON.stringify(locatorRaw) : null;
          const paramInfos = (act.params || []).map((p) => {
            const name = this.sanitizeIdentifier(p.name, 'arg');
            const t = (p.type || '').toLowerCase();
            const type =
              t === 'string' || t === 'number' || t === 'boolean'
                ? t
                : 'any';
            return { name, type };
          });
          const params = paramInfos.map((p) => `${p.name}: ${p.type}`);
          const firstParamName = paramInfos[0]?.name;
          const rawTarget = (act.returnTarget || '').trim();
          const actionType: 'click' | 'input' | 'drag' | undefined =
            (act.kind as any) === 'action'
              ? (act as any).actionType === 'input'
                ? 'input'
                : (act as any).actionType === 'drag'
                  ? 'drag'
                  : 'click'
              : undefined;
          const callSteps = (() => {
            const raw = (act as any).callStepsJson as string | null | undefined;
            if (!raw) return [];
            try {
              const parsed = JSON.parse(raw);
              if (!Array.isArray(parsed)) return [];
              const normalized = parsed
                .map((s: any, idx: number) => {
                  const targetActionKey = String(s?.targetActionKey || '').trim();
                  if (!targetActionKey) return null;
                  const args = Array.isArray(s?.args)
                    ? s.args.map((v: any) => String(v))
                    : [];
                  const sortOrder =
                    typeof s?.sortOrder === 'number' && Number.isFinite(s.sortOrder)
                      ? Math.floor(s.sortOrder)
                      : idx;
                  return { targetActionKey, args, sortOrder };
                })
                .filter(Boolean) as { targetActionKey: string; args: string[]; sortOrder: number }[];
              normalized.sort((a, b) => a.sortOrder - b.sortOrder);
              return normalized;
            } catch {
              return [];
            }
          })();
          lines.push('');
          if (act.label) {
            lines.push(`  /** ${act.label} */`);
          }
          const sig =
            params.length > 0
              ? `  async ${methodSafe}(${params.join(', ')}) {`
              : `  async ${methodSafe}() {`;
          lines.push(sig);
          lines.push(
            `    // AUTO-GENERATED: ${className}.${methodSafe}`,
          );
          lines.push(
            `    this.logger.debug('${className}.${methodSafe} called');`,
          );
          if ((act.kind as any) === 'call' && callSteps.length > 0) {
            for (let i = 0; i < callSteps.length; i++) {
              const step = callSteps[i]!;
              if (i > 0) {
                lines.push('    await this.delay();');
              }
              const targetMethodSafe =
                methodNameByKey.get(step.targetActionKey) ||
                this.sanitizeIdentifier(step.targetActionKey, step.targetActionKey);
              const argsCode = (step.args || [])
                .map((v) => String(v || '').trim())
                .filter((v) => v.length > 0)
                .join(', ');
              const callLine =
                argsCode && argsCode.length > 0
                  ? `    await this.${targetMethodSafe}(${argsCode});`
                  : `    await this.${targetMethodSafe}();`;
              lines.push(callLine);
            }
            lines.push('    await this.delay();');
            if (rawTarget === 'this') {
              lines.push('    return this;');
            } else if (rawTarget) {
              lines.push(`    return new ${rawTarget}(this.testcase);`);
            }
          } else {
            if (locatorLit) {
              if (isAssert) {
                lines.push(`    const el = await this.page.$(${locatorLit});`);
                lines.push(
                  `    this.testcase.assertNotNull(el, '${className}.${methodSafe} element');`,
                );
              } else {
                if (actionType === 'input' && firstParamName) {
                  lines.push(`    await this.page.type(${locatorLit}, ${firstParamName});`);
                } else {
                  lines.push(`    const el = await this.page.$(${locatorLit});`);
                  lines.push(`    await el?.click();`);
                }
              }
            }
            lines.push('    await this.delay();');
            if (rawTarget === 'this') {
              lines.push('    return this;');
            } else if (rawTarget) {
              lines.push(`    return new ${rawTarget}(this.testcase);`);
            }
          }
          lines.push('  }');
        }
      }
      lines.push('}', '');
      return lines.join('\n');
    };

    try {
      fs.mkdirSync(srcDir, { recursive: true });
    } catch {
      // ignore
    }

    // 如果文件不存在：创建一个完整骨架（占位模板，可被后续覆盖）
    if (!fs.existsSync(filePath)) {
      const content = buildFullContent();
      try {
        fs.writeFileSync(filePath, content, 'utf8');
      } catch {
        // ignore write errors; 不影响主流程
      }
      return;
    }

    // 文件已存在：如果仍然带有 AUTO-GENERATED 头，则整体重生；否则仅为新增动作补充方法和 import
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }

    if (content.includes(headerMarker)) {
      const next = buildFullContent();
      try {
        fs.writeFileSync(filePath, next, 'utf8');
      } catch {
        // ignore write errors
      }
      return;
    }

    if (!content.includes(`export class ${className}`)) {
      // 非预期结构，避免误改
      return;
    }

    const existing = new Set<string>();
    for (const act of actions) {
      const methodSafe = this.sanitizeIdentifier(
        act.method || act.key || '',
        `action${act.id || ''}`,
      );
      if (content.includes(`async ${methodSafe}(`)) {
        existing.add(methodSafe);
      }
    }

    // Prepare import statements for new return targets
    const importLines: string[] = [];
    for (const [targetClass, targetFileBase] of returnTargets) {
      if (
        content.includes(`import { ${targetClass} `) ||
        content.includes(`from './${targetFileBase}-page'`)
      ) {
        continue;
      }
      importLines.push(
        `import { ${targetClass} } from './${targetFileBase}-page';`,
      );
    }

    if (importLines.length > 0) {
      const marker = `export class ${className}`;
      const idx = content.indexOf(marker);
      if (idx > 0) {
        const before = content.slice(0, idx);
        const after = content.slice(idx);
        const trimmedBefore = before.replace(/\s*$/, '');
        content =
          trimmedBefore +
          '\n' +
          importLines.join('\n') +
          '\n\n' +
          after;
      }
    }

    const newLines: string[] = [];
    for (const act of actions) {
      const methodSafe = this.sanitizeIdentifier(
        act.method || act.key || '',
        `action${act.id || ''}`,
      );
      if (existing.has(methodSafe)) continue;
      const isAssert = (act.kind as any) === 'assert';
      const locatorRaw = (act.locator || '').trim();
      const locatorLit = locatorRaw ? JSON.stringify(locatorRaw) : null;
      const params = (act.params || []).map((p) => {
        const name = this.sanitizeIdentifier(p.name, 'arg');
        const t = (p.type || '').toLowerCase();
        const type =
          t === 'string' || t === 'number' || t === 'boolean'
            ? t
            : 'any';
        return `${name}: ${type}`;
      });
      const rawTarget = (act.returnTarget || '').trim();
      newLines.push('');
      if (act.label) {
        newLines.push(`  /** ${act.label} */`);
      }
      const sig =
        params.length > 0
          ? `  async ${methodSafe}(${params.join(', ')}) {`
          : `  async ${methodSafe}() {`;
      newLines.push(sig);
      newLines.push(
        `    // AUTO-GENERATED: ${className}.${methodSafe}`,
      );
      newLines.push(
        `    this.logger.debug('${className}.${methodSafe} called');`,
      );
      if (locatorLit) {
        if (isAssert) {
          newLines.push(`    const el = await this.page.$(${locatorLit});`);
          newLines.push(
            `    this.testcase.assertNotNull(el, '${className}.${methodSafe} element');`,
          );
        } else {
          newLines.push(`    const el = await this.page.$(${locatorLit});`);
          newLines.push(`    await el?.click();`);
        }
      }
      newLines.push('    await this.delay();');
      if (rawTarget === 'this') {
        newLines.push('    return this;');
      } else if (rawTarget) {
        newLines.push(`    return new ${rawTarget}(this.testcase);`);
      }
      newLines.push('  }');
    }

    if (newLines.length === 0) {
      try {
        fs.writeFileSync(filePath, content, 'utf8');
      } catch {
        // ignore
      }
      return;
    }

    const insertPos = content.lastIndexOf('}');
    if (insertPos < 0) {
      try {
        fs.writeFileSync(filePath, content, 'utf8');
      } catch {
        // ignore
      }
      return;
    }
    const before = content.slice(0, insertPos);
    const after = content.slice(insertPos);
    const next = before + '\n' + newLines.join('\n') + '\n' + after;
    try {
      fs.writeFileSync(filePath, next, 'utf8');
    } catch {
      // ignore write errors; 不影响主流程
    }
  }

  /** Android 平台（gettr-android）Page TS 文件生成与占位方法维护 */
  private async ensureAndroidLibTsFileForPage(page: ActionPage) {
    const srcDir = await this.getLibSrcDirForPlatform(page.platform);
    if (!srcDir) return;
    const className = page.className || 'Page';
    const baseRaw = className.replace(/Page$/, '') || page.key || 'page';
    const fileBase = baseRaw.toLowerCase();
    const fileName = `${fileBase}-page.ts`;
    const filePath = path.join(srcDir, fileName);
    const headerMarker = '// AUTO-GENERATED: ACTION-CATALOG-ANDROID';

    const actions = page.actions || [];

    const returnTargets = new Map<string, string>();
    for (const act of actions) {
      const rawTarget = (act.returnTarget || '').trim();
      if (!rawTarget || rawTarget === 'this' || rawTarget === className) {
        continue;
      }
      const targetClass = rawTarget;
      const targetBaseRaw = targetClass.replace(/Page$/, '') || targetClass;
      const targetFileBase = targetBaseRaw.toLowerCase();
      returnTargets.set(targetClass, targetFileBase);
    }

    const buildSelectorFromLocator = (locatorRaw: string): string | null => {
      const raw = (locatorRaw || '').trim();
      if (!raw) return null;
      const looksLikeXpath = raw.startsWith('//') || raw.startsWith('(');
      const looksLikeStrategy =
        raw.startsWith('android=') ||
        /^id=/.test(raw) ||
        /^xpath=/.test(raw) ||
        /^accessibility id=/.test(raw) ||
        /^css selector=/.test(raw);
      const looksLikeId = /^[A-Za-z0-9_.:-]+$/.test(raw);
      if (!looksLikeId || looksLikeXpath || looksLikeStrategy) {
        // 复杂表达式或已经是完整 selector，按原样透传
        return raw;
      }
      // 默认：将 locator 视为 Android resource-id
      return `android=new UiSelector().resourceId("${raw}")`;
    };

    const buildFullContent = (): string => {
      const lines: string[] = [];
      lines.push(headerMarker);
      lines.push(`import { IPage } from './interface/ipage';`);
      for (const [targetClass, targetFileBase] of returnTargets) {
        lines.push(
          `import { ${targetClass} } from './${targetFileBase}-page';`,
        );
      }
      lines.push('');
      lines.push(`export class ${className} extends IPage {`);
      lines.push(`  constructor(ins: any) {`);
      lines.push(`    super(ins);`);
      lines.push('  }', '');
      if (actions.length === 0) {
        lines.push(
          `  // TODO: 根据实际 Android 页面结构补充具体操作与断言方法。`,
        );
      } else {
        lines.push(
          `  // TODO: 以下方法根据 Action Catalog 自动生成，如需自定义实现，请移除文件顶部的 AUTO-GENERATED 标记。`,
        );
        const methodNameByKey = new Map<string, string>();
        for (const act of actions) {
          const methodSafe = this.sanitizeIdentifier(
            act.method || act.key || '',
            `action${act.id || ''}`,
          );
          methodNameByKey.set(act.key, methodSafe);
        }
        for (const act of actions) {
          const methodSafe = methodNameByKey.get(act.key)!;
          const isAssert = (act.kind as any) === 'assert';
          const locatorRaw = (act.locator || '').trim();
          const selectorStr = buildSelectorFromLocator(locatorRaw);
          const selectorLit = selectorStr
            ? `'${selectorStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
            : null;
          const paramInfos = (act.params || []).map((p) => {
            const name = this.sanitizeIdentifier(p.name, 'arg');
            const t = (p.type || '').toLowerCase();
            const type =
              t === 'string' || t === 'number' || t === 'boolean'
                ? t
                : 'any';
            return { name, type };
          });
          const params = paramInfos.map((p) => `${p.name}: ${p.type}`);
          const firstParamName = paramInfos[0]?.name;
          const rawTarget = (act.returnTarget || '').trim();
        const callSteps = (() => {
          const raw = (act as any).callStepsJson as string | null | undefined;
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            const normalized = parsed
              .map((s: any, idx: number) => {
                const targetActionKey = String(s?.targetActionKey || '').trim();
                if (!targetActionKey) return null;
                const args = Array.isArray(s?.args)
                  ? s.args.map((v: any) => String(v))
                  : [];
                const sortOrder =
                  typeof s?.sortOrder === 'number' && Number.isFinite(s.sortOrder)
                    ? Math.floor(s.sortOrder)
                    : idx;
                return { targetActionKey, args, sortOrder };
              })
              .filter(Boolean) as { targetActionKey: string; args: string[]; sortOrder: number }[];
            normalized.sort((a, b) => a.sortOrder - b.sortOrder);
            return normalized;
          } catch {
            return [];
          }
        })();
          lines.push('');
          if (act.label) {
            lines.push(`  /** ${act.label} */`);
          }
          const sig =
            params.length > 0
              ? `  async ${methodSafe}(${params.join(', ')}) {`
              : `  async ${methodSafe}() {`;
          lines.push(sig);
          lines.push(
            `    // AUTO-GENERATED-ANDROID: ${className}.${methodSafe}`,
          );
        lines.push(
          `    this.logger.debug('${className}.${methodSafe} called');`,
        );
        lines.push(`    await this.delay();`);
        if ((act.kind as any) === 'call' && callSteps.length > 0) {
          for (let i = 0; i < callSteps.length; i++) {
            const step = callSteps[i]!;
            if (i > 0) {
              lines.push('    await this.delay();');
            }
              const targetMethodSafe =
                methodNameByKey.get(step.targetActionKey) ||
                this.sanitizeIdentifier(step.targetActionKey, step.targetActionKey);
              const argsCode = (step.args || [])
                .map((v) => String(v || '').trim())
                .filter((v) => v.length > 0)
                .join(', ');
              const callLine =
                argsCode && argsCode.length > 0
                  ? `    await this.${targetMethodSafe}(${argsCode});`
                  : `    await this.${targetMethodSafe}();`;
              lines.push(callLine);
          }
          lines.push('    await this.delay();');
          if (rawTarget === 'this') {
            lines.push('    return this;');
          } else if (rawTarget) {
            lines.push(`    return new ${rawTarget}(this.testcase);`);
          }
        } else if (selectorLit) {
          if (isAssert) {
            lines.push(`    const el = await this.page.$(${selectorLit});`);
            lines.push(
              `    this.testcase.assertNotNull(el, '${className}.${methodSafe} element');`,
              );
            } else if (firstParamName) {
              // 输入框场景：先点击再清空并输入第一个参数
              lines.push(`    this.curEl = await this.page.$(${selectorLit});`);
              lines.push(`    await this.curEl?.click();`);
              lines.push(`    await this.curEl?.clearValue?.();`);
              lines.push(`    await this.curEl?.setValue(${firstParamName});`);
            } else {
              // 普通点击
              lines.push(
                `    await this.page.$(${selectorLit}).then((el) => el?.click());`,
              );
            }
          }
          lines.push('    await this.delay();');
          if (rawTarget === 'this') {
            lines.push('    return this;');
          } else if (rawTarget) {
            lines.push(`    return new ${rawTarget}(this.testcase);`);
          }
          lines.push('  }');
        }
      }
      lines.push('}', '');
      return lines.join('\n');
    };

    try {
      fs.mkdirSync(srcDir, { recursive: true });
    } catch {
      // ignore
    }

    if (!fs.existsSync(filePath)) {
      const content = buildFullContent();
      try {
        fs.writeFileSync(filePath, content, 'utf8');
      } catch {
        // ignore
      }
      return;
    }

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }

    if (content.includes(headerMarker)) {
      const next = buildFullContent();
      try {
        fs.writeFileSync(filePath, next, 'utf8');
      } catch {
        // ignore
      }
      return;
    }

    if (!content.includes(`export class ${className}`)) {
      return;
    }

    const existing = new Set<string>();
    for (const act of actions) {
      const methodSafe = this.sanitizeIdentifier(
        act.method || act.key || '',
        `action${act.id || ''}`,
      );
      if (content.includes(`async ${methodSafe}(`)) {
        existing.add(methodSafe);
      }
    }

    const importLines: string[] = [];
    for (const [targetClass, targetFileBase] of returnTargets) {
      if (
        content.includes(`import { ${targetClass} `) ||
        content.includes(`from './${targetFileBase}-page'`)
      ) {
        continue;
      }
      importLines.push(
        `import { ${targetClass} } from './${targetFileBase}-page';`,
      );
    }

    if (importLines.length > 0) {
      const marker = `export class ${className}`;
      const idx = content.indexOf(marker);
      if (idx > 0) {
        const before = content.slice(0, idx);
        const after = content.slice(idx);
        const trimmedBefore = before.replace(/\s*$/, '');
        content =
          trimmedBefore +
          '\n' +
          importLines.join('\n') +
          '\n\n' +
          after;
      }
    }

    const newLines: string[] = [];
    for (const act of actions) {
      const methodSafe = this.sanitizeIdentifier(
        act.method || act.key || '',
        `action${act.id || ''}`,
      );
      if (existing.has(methodSafe)) continue;
      const isAssert = (act.kind as any) === 'assert';
      const locatorRaw = (act.locator || '').trim();
      const selectorStr = buildSelectorFromLocator(locatorRaw);
      const selectorLit = selectorStr
        ? `'${selectorStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
        : null;
      const paramInfos = (act.params || []).map((p) => {
        const name = this.sanitizeIdentifier(p.name, 'arg');
        const t = (p.type || '').toLowerCase();
        const type =
          t === 'string' || t === 'number' || t === 'boolean'
            ? t
            : 'any';
        return { name, type };
      });
      const params = paramInfos.map((p) => `${p.name}: ${p.type}`);
      const firstParamName = paramInfos[0]?.name;
      const rawTarget = (act.returnTarget || '').trim();
      newLines.push('');
      if (act.label) {
        newLines.push(`  /** ${act.label} */`);
      }
      const sig =
        params.length > 0
          ? `  async ${methodSafe}(${params.join(', ')}) {`
          : `  async ${methodSafe}() {`;
      newLines.push(sig);
      newLines.push(
        `    // AUTO-GENERATED-ANDROID: ${className}.${methodSafe}`,
      );
      newLines.push(
        `    this.logger.debug('${className}.${methodSafe} called');`,
      );
      newLines.push(`    await this.delay();`);
      if (selectorLit) {
        if (isAssert) {
          newLines.push(`    const el = await this.page.$(${selectorLit});`);
          newLines.push(
            `    this.testcase.assertNotNull(el, '${className}.${methodSafe} element');`,
          );
        } else if (firstParamName) {
          newLines.push(`    this.curEl = await this.page.$(${selectorLit});`);
          newLines.push(`    await this.curEl?.click();`);
          newLines.push(`    await this.curEl?.clearValue?.();`);
          newLines.push(`    await this.curEl?.setValue(${firstParamName});`);
        } else {
          newLines.push(
            `    await this.page.$(${selectorLit}).then((el) => el?.click());`,
          );
        }
      }
      if (rawTarget === 'this') {
        newLines.push('    return this;');
      } else if (rawTarget) {
        newLines.push(`    return new ${rawTarget}(this.testcase);`);
      }
      newLines.push('  }');
    }

    if (newLines.length === 0) {
      try {
        fs.writeFileSync(filePath, content, 'utf8');
      } catch {
        // ignore
      }
      return;
    }

    const insertPos = content.lastIndexOf('}');
    if (insertPos < 0) {
      try {
        fs.writeFileSync(filePath, content, 'utf8');
      } catch {
        // ignore
      }
      return;
    }
    const before = content.slice(0, insertPos);
    const after = content.slice(insertPos);
    const next = before + '\n' + newLines.join('\n') + '\n' + after;
    try {
      fs.writeFileSync(filePath, next, 'utf8');
    } catch {
      // ignore
    }
  }

  private mapPageSummary(p: ActionPage) {
    const actionsCount = Array.isArray(p.actions) ? p.actions.length : 0;
    const elementsCount = Array.isArray((p as any).elements)
      ? (p as any).elements.length
      : 0;
    const hasElementsOnly = elementsCount > 0 && actionsCount === 0;
    return {
      id: p.id,
      platform: p.platform,
      key: p.key,
      label: p.label,
      module: p.module,
      className: p.className,
      varName: p.varName,
      enabled: p.enabled,
      sortOrder: p.sortOrder,
      actionsCount,
      elementsCount,
      hasElementsOnly,
    };
  }

  private mapPlatformSummary(p: ActionPlatform) {
    return {
      id: p.id,
      key: p.key,
      label: p.label,
      libDir: p.libDir ?? null,
      enabled: p.enabled,
      sortOrder: p.sortOrder,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('resolve-lib-path')
  async resolveLibPath(
    @Req() req: any,
    @Query('path') pathRaw?: string,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const raw = (pathRaw || '').trim();
    if (!raw) {
      throw new BadRequestException('path is required');
    }
    const norm = raw.replace(/\\/g, '/');
    const parts = norm.split('/');
    const idx = parts.indexOf('shared-libs');
    if (idx < 0 || idx + 2 >= parts.length) {
      throw new BadRequestException('path must be under workspace/shared-libs');
    }
    const libDir = parts[idx + 1];
    const fileName = parts[parts.length - 1];
    const fileBase = fileName
      .replace(/\.[^.]+$/, '')
      .replace(/-page$/, '')
      .toLowerCase();

    const platformRec = await this.platformRepo.findOne({
      where: [
        { libDir } as any,
        { key: libDir } as any,
      ],
    });
    if (!platformRec) {
      return { page: null };
    }
    const platform = platformRec.key;
    const pages = await this.pageRepo.find({
      where: { platform } as any,
      relations: ['actions'],
      order: { sortOrder: 'ASC', id: 'ASC' } as any,
    });
    let matched: ActionPage | null = null;
    for (const page of pages) {
      const baseRaw =
        (page.className || 'Page').replace(/Page$/, '') || page.key || 'page';
      const fb = baseRaw.toLowerCase();
      if (fb === fileBase) {
        matched = page;
        break;
      }
    }
    if (!matched) {
      return { page: null };
    }
    return {
      page: this.mapPageSummary(matched),
    };
  }

  private mapPageDetail(p: ActionPage) {
    return {
      ...this.mapPageSummary(p),
      elements: ((p as any).elements || []).map((el: ActionPageElement) => ({
        id: el.id,
        elementId: el.elementId,
        description: el.description ?? null,
        defaultLocator: el.defaultLocator ?? null,
      })),
        actions: (p.actions || []).map((a) => ({
          id: a.id,
          key: a.key,
          label: a.label,
          method: a.method,
          actionType:
            (a.kind as any) === 'action'
              ? (a as any).actionType === 'input'
                ? 'input'
                : (a as any).actionType === 'drag'
                  ? 'drag'
                  : 'click'
              : undefined,
          kind:
            (a.kind as any) === 'assert'
              ? 'assert'
              : (a.kind as any) === 'call'
                ? 'call'
              : 'action',
        defaultExpected: a.defaultExpected ?? null,
        description: a.description ?? null,
        locator: a.locator ?? null,
        returnTarget: a.returnTarget ?? null,
        enabled: a.enabled,
        sortOrder: a.sortOrder,
        params: (a.params || [])
          .sort((x, y) => x.sortOrder - y.sortOrder || x.id - y.id)
          .map((param) => ({
            id: param.id,
            name: param.name,
            type: param.type ?? null,
            required: !!param.required,
            placeholder: param.placeholder ?? null,
            defaultValue: param.defaultValue ?? null,
            sortOrder: param.sortOrder,
          })),
        callSteps: (() => {
          const raw = (a as any).callStepsJson as string | null | undefined;
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
              .map((s: any, idx: number) => {
                const targetActionKey = String(s?.targetActionKey || '').trim();
                if (!targetActionKey) return null;
                const args = Array.isArray(s?.args)
                  ? s.args.map((v: any) => String(v))
                  : [];
                const soRaw = Number(s?.sortOrder);
                const sortOrder = Number.isFinite(soRaw) ? Math.floor(soRaw) : idx;
                return {
                  targetActionKey,
                  args,
                  sortOrder,
                };
              })
              .filter(Boolean) as {
              targetActionKey: string;
              args: string[];
              sortOrder: number;
            }[];
          } catch {
            return [];
          }
        })(),
      })),
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('pages')
  async listPages(
    @Req() req: any,
    @Query('platform') platform?: string,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const plat = this.normalizePlatform(platform);
    const rows = await this.pageRepo.find({
      where: { platform: plat } as any,
      relations: ['actions', 'elements'],
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return {
      items: rows.map((p) => this.mapPageSummary(p)),
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('sync-actions-from-lib')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: '平台 key，例如：gettr-android、gettr-web',
          example: 'gettr-android',
        },
      },
    },
  })
  async syncActionsFromLibRoute(
    @Req() req: any,
    @Body('platform') platform?: string,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const plat = this.normalizePlatform(platform || 'gettr-android');
    const stats = await this.syncActionsFromLib(plat);
    return { platform: plat, ...stats };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('clear-actions-from-lib')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: '平台 key，例如：gettr-android、gettr-web',
          example: 'gettr-android',
        },
      },
    },
  })
  async clearActionsFromLibRoute(
    @Req() req: any,
    @Body('platform') platform?: string,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const plat = this.normalizePlatform(platform || 'gettr-android');
    const pages = await this.pageRepo.find({
      where: { platform: plat } as any,
    });
    if (!pages.length) {
      return { platform: plat, pages: 0, deletedActions: 0 };
    }
    let deletedActions = 0;
    for (const page of pages) {
      const res = await this.actionRepo.delete({
        page: { id: page.id } as any,
      } as any);
      deletedActions += res.affected ?? 0;
    }
    return {
      platform: plat,
      pages: pages.length,
      deletedActions,
    };
  }

  // ---- Platforms CRUD ----

  @UseGuards(AuthGuard('jwt'))
  @Get('platforms')
  async listPlatforms(@Req() req: any) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    // 每次进入时尝试与 shared-libs 目录同步一次平台列表（已有的跳过）
    try {
      await this.syncPlatformsFromSharedLibs();
    } catch {}

    const rows = await this.platformRepo.find({
      order: { sortOrder: 'ASC', key: 'ASC' },
    });
    return {
      items: rows
        .filter((p) => p.key !== 'core' && p.key !== 'types')
        .map((p) => this.mapPlatformSummary(p)),
    };
  }

  private prettyPlatformLabelFromDirName(name: string): string {
    const trimmed = (name || '').trim();
    if (!trimmed) return 'Unknown';
    // 特殊处理常见目录名
    if (trimmed === 'gettr-web') return 'GETTR Web';
    if (trimmed === 'gettr-android') return 'GETTR Android';
    if (trimmed === 'gettr-ios') return 'GETTR iOS';
    if (trimmed === 'gettr-mobile-web') return 'GETTR Mobile Web';
    if (trimmed === 'core') return 'Core';
    if (trimmed === 'types') return 'Types';
    // 默认：按 - / _ 分词并首字母大写
    const parts = trimmed.split(/[-_]+/);
    return parts
      .filter((p) => p.length)
      .map((p) => p[0]!.toUpperCase() + p.slice(1))
      .join(' ');
  }

  /** 扫描 workspace/shared-libs 目录，将每个子目录映射为一个平台（已有的跳过）。 */
  private async syncPlatformsFromSharedLibs(): Promise<{
    created: number;
    skipped: number;
  }> {
    let created = 0;
    let skipped = 0;
    try {
      const root = path.join(__dirname, '../..', 'workspace', 'shared-libs');
      const entries = fs.readdirSync(root, { withFileTypes: true });
      let order = await this.platformRepo.count();
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const dirName = ent.name;
        // core/types 为公共库，不作为独立平台参与映射
        if (dirName === 'core' || dirName === 'types') continue;
        const key = this.normalizePlatform(dirName);
        if (!key) continue;
        const exists = await this.platformRepo.findOne({ where: { key } });
        if (exists) {
          skipped += 1;
          continue;
        }
        const p = new ActionPlatform();
        p.key = key;
        p.label = this.prettyPlatformLabelFromDirName(dirName);
        p.libDir = dirName;
        p.enabled = true;
        p.sortOrder = order;
        await this.platformRepo.save(p);
        order += 1;
        created += 1;
      }
    } catch {
      // ignore errors; 调用方只关心统计
    }
    return { created, skipped };
  }

  /** Derive a page key (kebab-case) from a class name, e.g. HomePage -> home, LiveStreamPage -> live-stream */
  private derivePageKeyFromClassName(className: string): string {
    const raw = className.replace(/Page$/, '') || className;
    const withDashes = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2');
    return withDashes.toLowerCase();
  }

  private deriveVarNameFromPageKey(key: string): string {
    const parts = key.split(/[-_]+/).filter(Boolean);
    if (!parts.length) return 'page';
    const [head, ...rest] = parts;
    return (
      head.toLowerCase() +
      rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('')
    );
  }

  private getModuleNameForPlatform(key: string): string {
    switch (key) {
      case 'gettr-web':
        return 'gettr-web-lib';
      case 'gettr-android':
        return 'gettr-android-lib';
      case 'gettr-mobile-web':
        return 'gettr-mobile-web-lib';
      default:
        return `${key}-lib`;
    }
  }

  /** Scan a platform's shared-libs src dir for Page classes (export class Xxx extends IPage) and import as ActionPage. */
  private async syncPagesFromLib(platform: string): Promise<{
    created: number;
    skipped: number;
  }> {
    const plat = this.normalizePlatform(platform);
    if (!plat) return { created: 0, skipped: 0 };
    const srcDir = await this.getLibSrcDirForPlatform(plat);
    if (!srcDir) return { created: 0, skipped: 0 };
    let created = 0;
    let skipped = 0;

    const tasks: Array<Promise<void>> = [];
    const processFile = async (filePath: string, raw: string) => {
      const m = raw.match(/export\s+class\s+(\w+)\s+extends\s+IPage\b/);
      if (!m) return;
      const className = m[1];
      const key = this.derivePageKeyFromClassName(className);
      if (!key) return;
      const exists = await this.pageRepo.findOne({
        where: { platform: plat, key } as any,
      });
      if (exists) {
        skipped += 1;
        return;
      }
      const page = new ActionPage();
      page.platform = plat;
      page.key = key;
      page.label = className;
      page.module = this.getModuleNameForPlatform(plat);
      page.className = className;
      page.varName = this.deriveVarNameFromPageKey(key);
      page.enabled = true;
      page.sortOrder = 0;
      await this.pageRepo.save(page);
      created += 1;
    };

    // Re-implement walk using tasks to allow async inside
    const walkAsync = (dir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          walkAsync(full);
        } else if (ent.isFile() && ent.name.endsWith('.ts') && !ent.name.endsWith('.d.ts')) {
          try {
            const raw = fs.readFileSync(full, 'utf8');
            tasks.push(processFile(full, raw));
          } catch {
            // ignore read errors
          }
        }
      }
    };

    walkAsync(srcDir);
    await Promise.all(tasks);
    return { created, skipped };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('web-ids/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadWebIds(
    @Req() req: any,
    @UploadedFile() file: FastifyMulterFile,
    @Body() body: AnyRec,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    if (!file || !file.buffer) {
      throw new BadRequestException('web-ids CSV file is required');
    }
    const filename = String((file as any).originalname || '').toLowerCase();
    if (!filename.endsWith('.csv')) {
      throw new BadRequestException(
        '当前仅支持 CSV 格式的 web-ids 文件，请从 Excel 另存为 CSV 后再导入。',
      );
    }
    const plat = this.normalizePlatform(body?.platform);
    const raw = file.buffer.toString('utf8');
    const rows = this.parseCsvRows(raw);
    if (rows.length <= 1) {
      return {
        result: 'ok',
        platform: plat,
        pagesCreated: 0,
        elementsCreated: 0,
        elementsUpdated: 0,
      };
    }

    const header = rows[0] || [];
    const norm = header.map((h) =>
      (h || '')
        .toString()
        .trim()
        .replace(/[_\s]+/g, '')
        .toLowerCase(),
    );
    const findIndex = (candidates: string[]): number => {
      return norm.findIndex((h) => candidates.includes(h));
    };

    const idxPageName = findIndex([
      'page',
      'pagename',
      '页面',
      '页面名称',
      '页面名',
    ]);
    const idxElementIds = findIndex([
      'elementid',
      'element',
      '元素id',
      '元素',
      '元素id号',
      'id',
    ]);
    const idxDescription = findIndex([
      'description',
      'desc',
      '描述',
      '说明',
      '备注',
    ]);

    if (idxPageName < 0 || idxElementIds < 0) {
      throw new BadRequestException(
        'web-ids CSV 首行需要包含「页面名称」(page) 与「Element ID」(elementId/元素ID) 列。',
      );
    }

    const pages = await this.pageRepo.find({
      where: { platform: plat } as any,
    });
    const pageByKeyOrLabel = new Map<string, ActionPage>();
    for (const p of pages) {
      const k1 = (p.key || '').trim().toLowerCase();
      const k2 = (p.label || '').trim().toLowerCase();
      if (k1) pageByKeyOrLabel.set(k1, p);
      if (k2) pageByKeyOrLabel.set(k2, p);
    }

    const elementsExisting = await this.elementRepo.find({
      where: { platform: plat } as any,
      relations: ['page'],
    });
    const elementByPageAndId = new Map<string, ActionPageElement>();
    for (const el of elementsExisting) {
      const pageId = (el.page as any)?.id as number | undefined;
      if (!pageId) continue;
      const key = `${pageId}::${el.elementId}`;
      elementByPageAndId.set(key, el);
    }

    let pagesCreated = 0;
    let elementsCreated = 0;
    let elementsUpdated = 0;
    const elementsToSave: ActionPageElement[] = [];

    const getOrCreatePageForName = async (name: string): Promise<ActionPage> => {
      const trimmed = (name || '').trim();
      const normName = trimmed.toLowerCase();
      const cached = pageByKeyOrLabel.get(normName);
      if (cached) return cached;

      const key = this.derivePageKeyFromLabel(trimmed);
      const className = this.buildClassNameFromPageKey(key);
      const module = this.getModuleNameForPlatform(plat);
      const page = new ActionPage();
      page.platform = plat;
      page.key = key;
      page.label = trimmed || key;
      page.module = module;
      page.className = className;
      page.varName = this.deriveVarNameFromPageKey(key);
      page.enabled = true;
      page.sortOrder = pages.length + pagesCreated;
      const saved = await this.pageRepo.save(page);
      pagesCreated += 1;
      pageByKeyOrLabel.set(normName, saved);
      return saved;
    };

    let lastPageName: string | null = null;
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i] || [];
      const pageNameRaw = cols[idxPageName] ?? '';
      const elementIdsRaw = cols[idxElementIds] ?? '';
      const descRaw = idxDescription >= 0 ? cols[idxDescription] ?? '' : '';
      let pageName = (pageNameRaw || '').trim();
      if (!pageName && lastPageName) {
        pageName = lastPageName;
      } else if (pageName) {
        lastPageName = pageName;
      }
      if (!pageName) continue;
      const elementIds = this.splitElementIds(elementIdsRaw);
      if (!elementIds.length) continue;
      const page = await getOrCreatePageForName(pageName);
      for (const elementId of elementIds) {
        const key = `${page.id}::${elementId}`;
        const existing = elementByPageAndId.get(key);
        const defaultLocator = `[data-testid="${elementId}"]`;
        if (!existing) {
          const el = new ActionPageElement();
          el.page = page;
          el.platform = plat;
          el.pageName = pageName;
          el.elementId = elementId;
          el.description = descRaw || null;
          el.defaultLocator = defaultLocator;
          el.source = 'import';
          elementsToSave.push(el);
          elementByPageAndId.set(key, el);
          elementsCreated += 1;
        } else {
          let changed = false;
          if (descRaw && descRaw.trim() && descRaw !== existing.description) {
            existing.description = descRaw;
            changed = true;
          }
          if (!existing.defaultLocator) {
            existing.defaultLocator = defaultLocator;
            changed = true;
          }
          if (changed) {
            elementsToSave.push(existing);
            elementsUpdated += 1;
          }
        }
      }
    }

    if (elementsToSave.length > 0) {
      await this.elementRepo.save(elementsToSave);
    }

    return {
      result: 'ok',
      platform: plat,
      pagesCreated,
      elementsCreated,
      elementsUpdated,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('web-ids')
  async clearWebIds(
    @Req() req: any,
    @Query('platform') platform?: string,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const plat = this.normalizePlatform(platform);
    const res = await this.elementRepo.delete({ platform: plat } as any);
    const deleted = res.affected ?? 0;
    return {
      result: 'ok',
      platform: plat,
      deleted,
    };
  }

  /**
   * 从 shared-libs/<platform>/src 下的 Page 类（extends IPage）自动导入方法到 Action Catalog：
   * - 仅在数据库中尚未存在对应 method 的动作时创建；
   * - key/label/method 默认为方法名，kind 默认为 'action'；
   * - 目前主要用于 gettr-android，将已有手写 Page 方法在 /scenarios/action-catalog 中展示出来。
   */
  private async syncActionsFromLib(platform: string): Promise<{
    created: number;
    pagesScanned: number;
  }> {
    const plat = this.normalizePlatform(platform);
    // 先确保 Page 列表已经与 shared-libs 同步
    await this.syncPagesFromLib(plat);
    const srcDir = await this.getLibSrcDirForPlatform(plat);
    if (!srcDir) {
      return { created: 0, pagesScanned: 0 };
    }

    const project = new Project({
      compilerOptions: {
        target: ScriptTarget.ESNext,
      },
      skipAddingFilesFromTsConfig: true,
      useInMemoryFileSystem: false,
    });
    project.addSourceFilesAtPaths(path.join(srcDir, '**/*.ts'));

    let created = 0;
    let pagesScanned = 0;

    const pagesByClass = new Map<string, ActionPage>();

    const getPageForClass = async (className: string): Promise<ActionPage | null> => {
      if (!className) return null;
      if (pagesByClass.has(className)) return pagesByClass.get(className)!;
      const page = await this.pageRepo.findOne({
        where: { platform: plat, className } as any,
        relations: ['actions', 'actions.params'],
      });
      if (!page) {
        pagesByClass.set(className, null as any);
        return null;
      }
      pagesByClass.set(className, page);
      return page;
    };

    for (const sf of project.getSourceFiles()) {
      for (const cls of sf.getClasses()) {
        const className = cls.getName() || '';
        if (!className) continue;
        const ext = cls.getExtends();
        if (!ext || !/\bIPage\b/.test(ext.getText())) continue;

        const page = await getPageForClass(className);
        if (!page) continue;
        pagesScanned += 1;
        const existingMethods = new Set(
          (page.actions || []).map((a) => (a.method || a.key || '').trim())
        );
        const methods = cls
          .getMembers()
          .filter((m) => ts.isMethodDeclaration(m.compilerNode)) as any[];
        let indexOffset = (page.actions || []).length;

        for (const m of methods) {
          const name = typeof m.getName === 'function' ? m.getName() : undefined;
          if (!name) continue;
          if (name === 'constructor') continue;
          if (name.startsWith('_')) continue;
          if (existingMethods.has(name)) continue;
          const act = new ActionPageAction();
          act.page = page;
          act.key = name;
          act.label = name;
          act.method = name;
          act.kind = 'action';
          act.actionType = 'click';
          act.defaultExpected = null;
          act.description = null;
          act.locator = null;
          act.returnTarget = null;
          act.enabled = true;
          act.sortOrder = indexOffset++;
          act.params = [];
          if (!page.actions) page.actions = [];
          page.actions.push(act);
          existingMethods.add(name);
          created += 1;
        }

        if (created > 0 && page.actions && page.actions.length > 0) {
          await this.pageRepo.save(page);
        }
      }
    }

    return { created, pagesScanned };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('platforms')
  async createPlatform(@Req() req: any, @Body() body: AnyRec) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const rawKey = String(body?.key || '').trim();
    if (!rawKey) {
      throw new BadRequestException('platform key is required');
    }
    const key = this.normalizePlatform(rawKey);
    const label = String(body?.label || '').trim() || rawKey;
    const libDir =
      typeof body?.libDir === 'string' && body.libDir.trim()
        ? body.libDir.trim()
        : key;

    const exists = await this.platformRepo.findOne({ where: { key } });
    if (exists) {
      throw new BadRequestException(`Platform ${key} already exists`);
    }

    const p = new ActionPlatform();
    p.key = key;
    p.label = label;
    p.libDir = libDir;
    p.enabled = body?.enabled !== false;
    p.sortOrder =
      typeof body?.sortOrder === 'number'
        ? Math.floor(body.sortOrder)
        : 0;

    const saved = await this.platformRepo.save(p);
    return this.mapPlatformSummary(saved);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('platforms/:id')
  async updatePlatform(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AnyRec,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const p = await this.platformRepo.findOne({ where: { id } });
    if (!p) {
      throw new NotFoundException(`ActionPlatform ${id} not found`);
    }

    if (body.key !== undefined) {
      const rawKey = String(body.key || '').trim();
      if (!rawKey) {
        throw new BadRequestException('platform key cannot be empty');
      }
      const key = this.normalizePlatform(rawKey);
      if (key !== p.key) {
        const dup = await this.platformRepo.findOne({ where: { key } });
        if (dup) {
          throw new BadRequestException(`Platform ${key} already exists`);
        }
        p.key = key;
      }
    }
    if (body.label !== undefined) {
      p.label = String(body.label || '').trim() || p.key;
    }
    if (body.libDir !== undefined) {
      const libDir = String(body.libDir || '').trim();
      p.libDir = libDir || null;
    }
    if (body.enabled !== undefined) {
      p.enabled = !!body.enabled;
    }
    if (body.sortOrder !== undefined) {
      const so = Number(body.sortOrder);
      if (!Number.isFinite(so)) {
        throw new BadRequestException('sortOrder must be a number');
      }
      p.sortOrder = Math.floor(so);
    }

    const saved = await this.platformRepo.save(p);
    return this.mapPlatformSummary(saved);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('platforms/:id')
  async deletePlatform(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const p = await this.platformRepo.findOne({ where: { id } });
    if (!p) {
      throw new NotFoundException(`ActionPlatform ${id} not found`);
    }
    // 级联删除：先删除该平台下的所有页面（数据库外键会继续级联删除动作与参数），再删除平台本身
    await this.pageRepo.delete({ platform: p.key } as any);
    await this.platformRepo.delete(id);
    return { result: 'ok' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('pages/:id')
  async getPage(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const page = await this.pageRepo.findOne({
      where: { id },
      relations: ['actions', 'actions.params', 'elements'],
      order: {
        actions: {
          sortOrder: 'ASC',
          id: 'ASC',
          params: { sortOrder: 'ASC', id: 'ASC' } as any,
        } as any,
      } as any,
    });
    if (!page) {
      throw new NotFoundException(`ActionPage ${id} not found`);
    }
    return this.mapPageDetail(page);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('pages')
  async createPage(@Req() req: any, @Body() body: AnyRec) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const platform = this.normalizePlatform(body?.platform);
    const key = String(body?.key || '').trim();
    const label = String(body?.label || '').trim() || key;
    const module =
      typeof body?.module === 'string' && body.module.trim()
        ? body.module.trim()
        : this.getModuleNameForPlatform(platform);
    const className = String(body?.className || '').trim();
    const varName = String(body?.varName || '').trim() || 'page';
    if (!key) throw new BadRequestException('key is required');
    if (!className) throw new BadRequestException('className is required');

    const exists = await this.pageRepo.findOne({
      where: { platform, key },
    });
    if (exists) {
      throw new BadRequestException(
        `Page ${platform}/${key} already exists`,
      );
    }

    const page = new ActionPage();
    page.platform = platform;
    page.key = key;
    page.label = label;
    page.module = module;
    page.className = className;
    page.varName = varName;
    page.enabled = body?.enabled !== false;
    page.sortOrder =
      typeof body?.sortOrder === 'number'
        ? Math.floor(body.sortOrder)
        : 0;

    const actionsRaw: AnyRec[] = Array.isArray(body?.actions)
      ? body.actions
      : [];
    page.actions = actionsRaw.map((a: AnyRec, index: number) => {
      const act = new ActionPageAction();
      act.page = page;
      act.key = String(a?.key || '').trim() || `action_${index + 1}`;
      act.label =
        String(a?.label || '').trim() ||
        act.key;
      act.method =
        String(a?.method || '').trim() ||
        act.key;
      act.kind =
        (a?.kind as any) === 'assert'
          ? 'assert'
          : (a?.kind as any) === 'call'
          ? 'call'
          : 'action';
      const rawActionType =
        typeof a?.actionType === 'string' && a.actionType.trim()
          ? a.actionType.trim()
          : '';
      act.actionType =
        act.kind === 'action'
          ? rawActionType === 'input'
            ? 'input'
            : rawActionType === 'drag'
              ? 'drag'
              : 'click'
          : null;
      act.defaultExpected =
        typeof a?.defaultExpected === 'string'
          ? a.defaultExpected
          : null;
      act.description =
        typeof a?.description === 'string' ? a.description : null;
      act.locator =
        typeof a?.locator === 'string' && a.locator.trim()
          ? a.locator.trim()
          : null;
      act.returnTarget =
        typeof a?.returnTarget === 'string' && a.returnTarget.trim()
          ? a.returnTarget.trim()
          : null;
      act.enabled = a?.enabled !== false;
      act.sortOrder =
        typeof a?.sortOrder === 'number'
          ? Math.floor(a.sortOrder)
          : index;
      const paramsRaw: AnyRec[] = Array.isArray(a?.params)
        ? a.params
        : [];
      act.params = paramsRaw.map((p: AnyRec, pIndex: number) => {
        const param = new ActionParam();
        param.action = act;
        param.name = String(p?.name || '').trim();
        if (!param.name) {
          param.name = `arg${pIndex + 1}`;
        }
        param.type =
          typeof p?.type === 'string' && p.type.trim()
            ? p.type.trim()
            : null;
        param.required = p?.required === true;
        param.placeholder =
          typeof p?.placeholder === 'string'
            ? p.placeholder
            : null;
        param.defaultValue =
          typeof p?.defaultValue === 'string'
            ? p.defaultValue
            : null;
        const soRaw = Number(p?.sortOrder);
        param.sortOrder = Number.isFinite(soRaw)
          ? Math.floor(soRaw)
          : pIndex;
        return param;
      });
      const callStepsRaw: AnyRec[] = Array.isArray(a?.callSteps)
        ? a.callSteps
        : [];
      const callStepsNorm = callStepsRaw
        .map((s: AnyRec, sIndex: number) => {
          const targetActionKey = String(s?.targetActionKey || '').trim();
          if (!targetActionKey) return null;
          const args = Array.isArray(s?.args)
            ? s.args.map((v: any) => String(v))
            : [];
          const soRaw = Number(s?.sortOrder);
          const sortOrder = Number.isFinite(soRaw)
            ? Math.floor(soRaw)
            : sIndex;
          return {
            targetActionKey,
            args,
            sortOrder,
          };
        })
        .filter(Boolean);
      act.callStepsJson =
        callStepsNorm.length > 0 ? JSON.stringify(callStepsNorm) : null;
      return act;
    });

    const saved = await this.pageRepo.save(page);
    const full = await this.pageRepo.findOne({
      where: { id: saved.id },
      relations: ['actions', 'actions.params'],
      order: {
        actions: {
          sortOrder: 'ASC',
          id: 'ASC',
          params: { sortOrder: 'ASC', id: 'ASC' } as any,
        } as any,
      } as any,
    });
    const detail = this.mapPageDetail(full || saved);
    await this.ensureLibTsFileForPage(full || saved);
    return detail;
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('pages/:id')
  async updatePage(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AnyRec,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const page = await this.pageRepo.findOne({
      where: { id },
      relations: ['actions'],
    });
    if (!page) {
      throw new NotFoundException(`ActionPage ${id} not found`);
    }

    if (body.platform !== undefined) {
      page.platform = this.normalizePlatform(body.platform);
    }
    if (body.key !== undefined) {
      const key = String(body.key || '').trim();
      if (!key) throw new BadRequestException('key cannot be empty');
      page.key = key;
    }
    if (body.label !== undefined) {
      page.label = String(body.label || '').trim() || page.key;
    }
    if (body.module !== undefined) {
      page.module = String(body.module || '').trim() || page.module;
    }
    if (body.className !== undefined) {
      const cls = String(body.className || '').trim();
      if (!cls) throw new BadRequestException('className cannot be empty');
      page.className = cls;
    }
    if (body.varName !== undefined) {
      const v = String(body.varName || '').trim();
      page.varName = v || page.varName;
    }
    if (body.enabled !== undefined) {
      page.enabled = !!body.enabled;
    }
    if (body.sortOrder !== undefined) {
      const so = Number(body.sortOrder);
      if (!Number.isFinite(so)) {
        throw new BadRequestException('sortOrder must be a number');
      }
      page.sortOrder = Math.floor(so);
    }

    const actionsRaw: AnyRec[] = Array.isArray(body?.actions)
      ? body.actions
      : [];

    // Replace actions wholesale for simplicity
    await this.actionRepo.delete({ page: { id } as any });

    page.actions = actionsRaw.map((a: AnyRec, index: number) => {
      const act = new ActionPageAction();
      act.page = page;
      act.key = String(a?.key || '').trim() || `action_${index + 1}`;
      act.label =
        String(a?.label || '').trim() ||
        act.key;
      act.method =
        String(a?.method || '').trim() ||
        act.key;
      act.kind =
        (a?.kind as any) === 'assert'
          ? 'assert'
          : (a?.kind as any) === 'call'
          ? 'call'
          : 'action';
      const rawActionType =
        typeof a?.actionType === 'string' && a.actionType.trim()
          ? a.actionType.trim()
          : '';
      act.actionType =
        act.kind === 'action'
          ? rawActionType === 'input'
            ? 'input'
            : rawActionType === 'drag'
              ? 'drag'
              : 'click'
          : null;
      act.defaultExpected =
        typeof a?.defaultExpected === 'string'
          ? a.defaultExpected
          : null;
      act.description =
        typeof a?.description === 'string' ? a.description : null;
      act.locator =
        typeof a?.locator === 'string' && a.locator.trim()
          ? a.locator.trim()
          : null;
      act.returnTarget =
        typeof a?.returnTarget === 'string' && a.returnTarget.trim()
          ? a.returnTarget.trim()
          : null;
      act.enabled = a?.enabled !== false;
      act.sortOrder =
        typeof a?.sortOrder === 'number'
          ? Math.floor(a.sortOrder)
          : index;
      const paramsRaw: AnyRec[] = Array.isArray(a?.params)
        ? a.params
        : [];
      act.params = paramsRaw.map((p: AnyRec, pIndex: number) => {
        const param = new ActionParam();
        param.action = act;
        param.name = String(p?.name || '').trim();
        if (!param.name) {
          param.name = `arg${pIndex + 1}`;
        }
        param.type =
          typeof p?.type === 'string' && p.type.trim()
            ? p.type.trim()
            : null;
        param.required = p?.required === true;
        param.placeholder =
          typeof p?.placeholder === 'string'
            ? p.placeholder
            : null;
        param.defaultValue =
          typeof p?.defaultValue === 'string'
            ? p.defaultValue
            : null;
        const soRaw = Number(p?.sortOrder);
        param.sortOrder = Number.isFinite(soRaw)
          ? Math.floor(soRaw)
          : pIndex;
        return param;
      });
      const callStepsRaw: AnyRec[] = Array.isArray(a?.callSteps)
        ? a.callSteps
        : [];
      const callStepsNorm = callStepsRaw
        .map((s: AnyRec, sIndex: number) => {
          const targetActionKey = String(s?.targetActionKey || '').trim();
          if (!targetActionKey) return null;
          const args = Array.isArray(s?.args)
            ? s.args.map((v: any) => String(v))
            : [];
          const soRaw = Number(s?.sortOrder);
          const sortOrder = Number.isFinite(soRaw)
            ? Math.floor(soRaw)
            : sIndex;
          return {
            targetActionKey,
            args,
            sortOrder,
          };
        })
        .filter(Boolean);
      act.callStepsJson =
        callStepsNorm.length > 0 ? JSON.stringify(callStepsNorm) : null;
      return act;
    });

    const saved = await this.pageRepo.save(page);
    const full = await this.pageRepo.findOne({
      where: { id: saved.id },
      relations: ['actions', 'actions.params'],
      order: {
        actions: {
          sortOrder: 'ASC',
          id: 'ASC',
          params: { sortOrder: 'ASC', id: 'ASC' } as any,
        } as any,
      } as any,
    });
    const detail = this.mapPageDetail(full || saved);
    await this.ensureLibTsFileForPage(full || saved);
    return detail;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('pages/:id/actions')
  async createAction(
    @Req() req: any,
    @Param('id', ParseIntPipe) pageId: number,
    @Body() body: AnyRec,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const page = await this.pageRepo.findOne({
      where: { id: pageId },
      relations: ['actions', 'actions.params'],
      order: { actions: { sortOrder: 'ASC', id: 'ASC' } as any },
    });
    if (!page) {
      throw new NotFoundException(`ActionPage ${pageId} not found`);
    }
    const key = String(body?.key || '').trim();
    if (!key) throw new BadRequestException('key cannot be empty');
    if ((page.actions || []).some((a) => a.key === key)) {
      throw new BadRequestException(`Action key ${key} already exists on page`);
    }
    const action = this.buildActionFromBody(new ActionPageAction(), body, (page.actions || []).length);
    action.page = page;
    await this.actionRepo.save(action);
    const full = await this.pageRepo.findOne({
      where: { id: pageId },
      relations: ['actions', 'actions.params'],
      order: {
        actions: {
          sortOrder: 'ASC',
          id: 'ASC',
          params: { sortOrder: 'ASC', id: 'ASC' } as any,
        } as any,
      } as any,
    });
    await this.ensureLibTsFileForPage(full || page);
    return this.mapPageDetail(full || page);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('pages/:id/actions/:actionId')
  async updateAction(
    @Req() req: any,
    @Param('id', ParseIntPipe) pageId: number,
    @Param('actionId', ParseIntPipe) actionId: number,
    @Body() body: AnyRec,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const action = await this.actionRepo.findOne({
      where: { id: actionId, page: { id: pageId } as any },
      relations: ['page', 'params'],
    });
    if (!action) {
      throw new NotFoundException(`Action ${actionId} not found on page ${pageId}`);
    }
    const page = action.page;
    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    const key = String(body?.key || '').trim();
    if (!key) throw new BadRequestException('key cannot be empty');
    const dup = await this.actionRepo.findOne({
      where: { page: { id: pageId } as any, key },
    });
    if (dup && dup.id !== actionId) {
      throw new BadRequestException(`Action key ${key} already exists on page`);
    }

    this.buildActionFromBody(action, body, action.sortOrder ?? 0);
    // replace params
    await this.actionRepo.manager.delete(ActionParam, { action: { id: action.id } as any });
    action.params = this.buildParamsFromBody(body?.params, action);

    await this.actionRepo.save(action);
    const full = await this.pageRepo.findOne({
      where: { id: pageId },
      relations: ['actions', 'actions.params'],
      order: {
        actions: {
          sortOrder: 'ASC',
          id: 'ASC',
          params: { sortOrder: 'ASC', id: 'ASC' } as any,
        } as any,
      } as any,
    });
    await this.ensureLibTsFileForPage(full || page);
    return this.mapPageDetail(full || page);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('pages/:id')
  async deletePage(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await ensureAdminOrBootstrap(this.userRepo, req);
    const existing = await this.pageRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`ActionPage ${id} not found`);
    }
    await this.pageRepo.delete(id);
    return { result: 'ok' };
  }

  private buildCallStepsJson(raw: AnyRec[] | undefined, defaultStart: number) {
    const callStepsRaw: AnyRec[] = Array.isArray(raw) ? raw : [];
    const callStepsNorm = callStepsRaw
      .map((s: AnyRec, sIndex: number) => {
        const targetActionKey = String(s?.targetActionKey || '').trim();
        if (!targetActionKey) return null;
        const args = Array.isArray(s?.args)
          ? s.args.map((v: any) => String(v))
          : [];
        const soRaw = Number(s?.sortOrder);
        const sortOrder = Number.isFinite(soRaw)
          ? Math.floor(soRaw)
          : defaultStart + sIndex;
        return {
          targetActionKey,
          args,
          sortOrder,
        };
      })
      .filter(Boolean);
    return callStepsNorm.length > 0 ? JSON.stringify(callStepsNorm) : null;
  }

  private buildParamsFromBody(params: AnyRec[] | undefined, action: ActionPageAction) {
    const paramsRaw: AnyRec[] = Array.isArray(params) ? params : [];
    return paramsRaw.map((p: AnyRec, pIndex: number) => {
      const param = new ActionParam();
      param.action = action;
      param.name = String(p?.name || '').trim() || `arg${pIndex + 1}`;
      param.type =
        typeof p?.type === 'string' && p.type.trim()
          ? p.type.trim()
          : null;
      param.required = p?.required === true;
      param.placeholder =
        typeof p?.placeholder === 'string'
          ? p.placeholder
          : null;
      param.defaultValue =
        typeof p?.defaultValue === 'string'
          ? p.defaultValue
          : null;
      const soRaw = Number(p?.sortOrder);
      param.sortOrder = Number.isFinite(soRaw)
        ? Math.floor(soRaw)
        : pIndex;
      return param;
    });
  }

  private buildActionFromBody(
    action: ActionPageAction,
    raw: AnyRec,
    defaultSortOrder: number,
  ) {
    action.key = String(raw?.key || '').trim() || action.key || `action_${defaultSortOrder + 1}`;
    action.label =
      String(raw?.label || '').trim() ||
      action.key;
    action.method =
      String(raw?.method || '').trim() ||
      action.key;
    action.kind =
      (raw?.kind as any) === 'assert'
        ? 'assert'
        : (raw?.kind as any) === 'call'
          ? 'call'
          : 'action';
    const rawActionType =
      typeof raw?.actionType === 'string' && raw.actionType.trim()
        ? raw.actionType.trim()
        : '';
    action.actionType =
      action.kind === 'action'
        ? rawActionType === 'input'
          ? 'input'
          : rawActionType === 'drag'
            ? 'drag'
            : 'click'
        : null;
    action.defaultExpected =
      typeof raw?.defaultExpected === 'string'
        ? raw.defaultExpected
        : null;
    action.description =
      typeof raw?.description === 'string' ? raw.description : null;
    action.locator =
      typeof raw?.locator === 'string' && raw.locator.trim()
        ? raw.locator.trim()
        : null;
    action.returnTarget =
      typeof raw?.returnTarget === 'string' && raw.returnTarget.trim()
        ? raw.returnTarget.trim()
        : null;
    action.enabled = raw?.enabled !== false;
    action.sortOrder =
      typeof raw?.sortOrder === 'number'
        ? Math.floor(raw.sortOrder)
        : defaultSortOrder;
    action.callStepsJson = this.buildCallStepsJson(raw?.callSteps, 0);
    action.params = this.buildParamsFromBody(raw?.params, action);
    return action;
  }
}

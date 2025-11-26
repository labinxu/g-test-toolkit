import {
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { InspectorService } from '../mobile/inspector/inspector.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly inspector: InspectorService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('generate-libs-code')
  async generate(@Req() req: any, @Body() body: any) {
    const rawUserId = req?.user?.id;
    if (rawUserId == null) throw new UnauthorizedException('No user');
    const userId = Number(rawUserId);
    if (!Number.isFinite(userId))
      throw new UnauthorizedException('Invalid user');
    const prompt: string = body?.prompt ?? '';
    const deviceId: string | undefined = body?.deviceId || undefined;
    const snapshot = body?.snapshot;
    const focusNodeId: string | undefined = body?.focusNodeId || undefined;
    const useRulesOnly =
      body?.useRulesOnly === '1' || body?.useRulesOnly === true;
    const maxLinesRaw = body?.maxLines;
    const maxColRaw = body?.maxCol;
    const parseBounded = (value: unknown, upper: number) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return undefined;
      if (num <= 0) return 0;
      return Math.max(0, Math.min(upper, Math.floor(num)));
    };
    const maxLines = parseBounded(maxLinesRaw, 200);
    const maxCol = parseBounded(maxColRaw, 400);
    try {
      const snap =
        snapshot && snapshot.nodes
          ? snapshot
          : await this.inspector.snapshot({ deviceId });
      if (!useRulesOnly && (await this.ai.isLLMConfigured(userId))) {
        try {
          const llm = await this.ai.generateWithLLM(
            { snapshot: snap, prompt, focusNodeId },
            { maxLines, maxCol },
            userId,
          );
          if (llm?.snippet && llm.snippet.trim()) {
            return { snippet: llm.snippet, generator: 'llm' };
          }
        } catch (e) {
          console.error('LLM call failed', e);
          return { error: `${e}` };
          // fallthrough to rules
        }
      }
      const res = this.ai.generateFromRules({
        snapshot: snap,
        prompt,
        focusNodeId,
      });
      const clipped = this.ai.finalizeSnippet(res.snippet, {
        maxLines,
        maxCol,
      });
      return {
        snippet: clipped,
        usedSelector: res.usedSelector,
        generator: 'rules',
      };
    } catch (e: any) {
      throw new NotFoundException(e?.message || 'Generation failed');
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('generate-from-spec')
  async generateFromSpec(@Req() req: any, @Body() body: any) {
    const rawUserId = req?.user?.id;
    if (rawUserId == null) throw new UnauthorizedException('No user');
    // The spec is either the body itself or nested under body.spec
    const spec = body?.spec ?? body;
    const { code } = await this.ai.generateFromSpec(spec);
    return { code, generator: 'mcp' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('generate-inspector-libs')
  async generateInspectorLibs(@Req() req: any, @Body() body: any) {
    const rawUserId = req?.user?.id;
    if (rawUserId == null) throw new UnauthorizedException('No user');
    // Snapshot can be passed directly
    const snapshot = body?.snapshot;
    if (!snapshot || !Array.isArray(snapshot?.nodes)) {
      throw new NotFoundException('snapshot required');
    }
    const focusNodeId = body?.focusNodeId || undefined;
    const template = body?.template || undefined;
    const className = body?.className || undefined;
    const { code } = this.ai.generateInspectorLibs({ snapshot, focusNodeId, template, className });
    return { code };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('normalize-user-scenarios')
  async normalizeUserScenarios(@Req() req: any, @Body() body: any) {
    const rawUserId = req?.user?.id;
    if (rawUserId == null) throw new UnauthorizedException('No user');
    const userId = Number(rawUserId);
    if (!Number.isFinite(userId)) throw new UnauthorizedException('Invalid user');
    const rawText: string = body?.rawText ?? '';
    const project: string = body?.project || 'live-stream';
    const docType: string | undefined = body?.docType || undefined;
    const moduleIdHint: string | undefined = body?.moduleIdHint || undefined;
    const moduleNameHint: string | undefined = body?.moduleNameHint || undefined;
    const sourceDoc: string | undefined = body?.sourceDoc || undefined;
    try {
      const result = await this.ai.normalizeUserScenarios({
        rawText,
        project,
        docType,
        moduleIdHint,
        moduleNameHint,
        sourceDoc,
        userId,
      });
      return result ?? { cases: [] };
    } catch (e: any) {
      throw new NotFoundException(e?.message || 'Failed to normalize user scenarios');
    }
  }
}

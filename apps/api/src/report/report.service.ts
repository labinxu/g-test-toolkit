import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestCase } from './entities/testcase.entity';
import { tryGenerateAllure } from './allure-adapter';
@Injectable()
export class ReportService {
  private logger: CustomLogger;

  constructor(
    @InjectRepository(TestCase)
    private readonly testCasesRepository: Repository<TestCase>,
    private readonly loggerService: LoggerService,
  ) {}
  async onModuleInit() {
    this.logger = this.loggerService.createLogger('ReportService');
  }

  async generate(
    workspace: string,
    testName: string,
    data: any,
  ): Promise<{ testcase: TestCase; reportFile: string }> {
    this.logger.debug(`generate report at ${workspace}`);
    const escapeHtml = (value: any) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatDuration = (ms?: number) => {
      if (ms == null || Number.isNaN(ms)) return '-';
      if (ms < 2000) return `${ms} ms`;
      return `${(ms / 1000).toFixed(2)} s`;
    };

    const now = new Date().toISOString();
    const reportRoot = path.isAbsolute(workspace)
      ? workspace
      : path.resolve(process.cwd(), workspace || 'reports');
    mkdirSync(reportRoot, { recursive: true });
    const safeName = (testName || 'TestCase').replace(/[<>:"/\\|?*]+/g, '_');
    const safeTimestamp = now.replace(/[:]/g, '-');
    const reportFile = path.join(reportRoot, `${safeName}_${safeTimestamp}.html`);
    const cases: Array<{
      name?: string;
      status?: string;
      durationMs?: number;
      error?: string;
      logs?: string[];
      details?: string[];
      metadata?: Record<string, any>;
      artifacts?: Array<{ path: string; description?: string; kind?: string }>;
    }> = Array.isArray(data?.cases) ? data.cases : [];
    const failedCases = cases.filter((c) => c.status === 'failed');
    const skippedCases = cases.filter((c) => c.status === 'skipped');
    const passedCases = cases.filter((c) => c.status === 'passed');
    const totalCases = cases.length;
    const hasErrorFromLogs = Array.isArray(data?.logs)
      ? data.logs.some((log: string) => log?.toLowerCase?.().includes('error'))
      : false;
    const overallStatus = failedCases.length
      ? 'Failed'
      : totalCases && passedCases.length === totalCases
      ? 'Passed'
      : hasErrorFromLogs
      ? 'Failed'
      : 'Passed';
    const durationSeconds = data?.duration
      ? (data.duration / 1000).toFixed(2)
      : '0.00';
    const testcase = await this.testCasesRepository.create({
      testCaseName: testName,
      status: overallStatus,
      date: now,
      detail: reportFile,
    });

    const artifacts: Array<{ path: string; description?: string; kind?: string }> = Array.isArray(
      data?.artifacts,
    )
      ? data.artifacts
      : [];

    const renderList = (items?: string[]) =>
      Array.isArray(items) && items.length
        ? items
            .map(
              (value) =>
                `<li><pre>${escapeHtml(value)}</pre></li>`,
            )
            .join('')
        : '<li><em>No entries</em></li>';

    const casesTable =
      cases.length > 0
        ? cases
            .map((c, index) => {
              const metadataSuite = Array.isArray(c.metadata?.suitePath)
                ? c.metadata?.suitePath?.join(' › ')
                : undefined;
              const caseName = c.name || metadataSuite || `Case ${index + 1}`;
              const statusClass = `status-${(c.status || 'unknown').toLowerCase()}`;
              const errorText = c.error ? escapeHtml(c.error) : '';
              return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(caseName)}</td>
        <td>${metadataSuite ? escapeHtml(metadataSuite) : '-'}</td>
        <td class="${statusClass}">${escapeHtml(c.status || 'unknown')}</td>
        <td>${formatDuration(c.durationMs)}</td>
        <td>${errorText}</td>
      </tr>`;
            })
            .join('')
        : '<tr><td colspan="6" class="text-center"><em>No individual cases recorded.</em></td></tr>';

    const caseDetails = cases
      .map((c, index) => {
        const metadataSuite = Array.isArray(c.metadata?.suitePath)
          ? c.metadata?.suitePath?.join(' › ')
          : undefined;
        const caseName = c.name || metadataSuite || `Case ${index + 1}`;
        const caseArtifacts = Array.isArray(c.artifacts) && c.artifacts.length
          ? `<div class="case-artifacts"><h4>Artifacts</h4><ul>${c.artifacts
              .map((art) => {
                const label = art.description ? `${art.description} (${art.path})` : art.path;
                return `<li><code>${escapeHtml(label)}</code></li>`;
              })
              .join('')}</ul></div>`
          : '';
        return `
    <details class="case-detail" open>
      <summary><strong>${escapeHtml(caseName)}</strong> — ${escapeHtml(c.status || 'unknown')}</summary>
      <div class="case-meta">
        <div><strong>Suite:</strong> ${metadataSuite ? escapeHtml(metadataSuite) : '-'}</div>
        <div><strong>Duration:</strong> ${formatDuration(c.durationMs)}</div>
        <div><strong>Error:</strong> ${c.error ? `<code>${escapeHtml(c.error)}</code>` : '-'}</div>
      </div>
      <div class="case-logs">
        <h4>Logs</h4>
        <ul>${renderList(c.logs)}</ul>
      </div>
      <div class="case-details">
        <h4>Details</h4>
        <ul>${renderList(c.details)}</ul>
      </div>
      ${caseArtifacts}
    </details>`;
      })
      .join('');

    const artifactSection =
      artifacts.length > 0
        ? `<div class="artifacts-section">
      <h2>Artifacts</h2>
      <ul>
        ${artifacts
          .map((item) => {
            const label = item.description
              ? `${item.description} (${item.path})`
              : item.path;
            return `<li><code>${escapeHtml(label)}</code></li>`;
          })
          .join('')}
      </ul>
    </div>`
        : '';

    const toRelative = (value?: string | null) => {
      if (!value) return undefined;
      const resolved = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
      return path.relative(process.cwd(), resolved);
    };

    const reportHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report: ${escapeHtml(testName)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .log-section, .details-section, .cases-section, .artifacts-section { margin: 20px 0; }
    .log-entry { padding: 5px; border-bottom: 1px solid #eee; }
    .details-entry { padding: 10px; margin: 5px 0; background: #f9f9f9; border-radius: 4px; }
    .status-passed { color: #0f9d58; font-weight: bold; }
    .status-failed { color: #d93025; font-weight: bold; }
    .status-skipped { color: #f9ab00; font-weight: bold; }
    .status-unknown { color: #5f6368; font-weight: bold; }
    .summary { background: #e0e0e0; padding: 15px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    .text-center { text-align: center; }
    .case-detail { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; margin-top: 12px; background: #fafafa; }
    .case-detail summary { cursor: pointer; }
    .case-detail h4 { margin: 12px 0 6px; }
    .case-detail ul { margin: 0; padding-left: 18px; }
    .case-detail pre { margin: 0; }
    code { background: #f1f3f4; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', Courier, monospace; }
  </style>
</head>
<body>
  <h1>Test Report: ${escapeHtml(testName)} <small>(${now})</small></h1>
  <div class="summary">
    <p><strong>Status:</strong> <span class="status-${overallStatus.toLowerCase()}">${overallStatus}</span></p>
    <p><strong>Duration:</strong> ${durationSeconds} seconds</p>
    <p><strong>Total Cases:</strong> ${totalCases}</p>
    <p><strong>Passed / Failed / Skipped:</strong> ${passedCases.length} / ${failedCases.length} / ${skippedCases.length}</p>
    <p><strong>Assertions Run:</strong> ${data.exceptCounter}</p>
  </div>
  <div class="cases-section">
    <h2>Test Cases</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Case</th>
          <th>Suite</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        ${casesTable}
      </tbody>
    </table>
    ${caseDetails}
  </div>
  <div class="log-section">
    <h2>Logs</h2>
    ${Array.isArray(data.logs) && data.logs.length
      ? data.logs.map((log: string) => `<div class="log-entry">${escapeHtml(log)}</div>`).join('')
      : '<p><em>No logs.</em></p>'}
  </div>
  <div class="details-section">
    <h2>Test Details</h2>
    ${Array.isArray(data.details) && data.details.length
      ? data.details.map((detail: string) => `<pre class="details-entry">${escapeHtml(detail)}</pre>`).join('')
      : '<p><em>No additional details.</em></p>'}
  </div>
  ${artifactSection}
</body>
</html>`;

    writeFileSync(reportFile, reportHtml);
    const normalizePath = (value?: string) => (value ? value.replace(/\\+/g, '/') : value)

    const casesForMeta = cases.map((c, index) => ({
      index,
      name: c.name || (Array.isArray(c.metadata?.suitePath) ? c.metadata?.suitePath?.join(' › ') : undefined) || `Case ${index + 1}`,
      status: c.status || 'unknown',
      durationMs: c.durationMs,
      error: c.error,
      metadata: c.metadata ?? undefined,
      artifacts: Array.isArray(c.artifacts)
        ? c.artifacts.map((art) => ({
            path: normalizePath(toRelative(art.path) ?? art.path),
            description: art.description,
            kind: art.kind,
          }))
        : [],
    }));

    const reportMeta = {
      testName,
      generatedAt: now,
      reportHtml: normalizePath(path.relative(process.cwd(), reportFile)),
      cases: casesForMeta,
      artifacts: artifacts.map((art) => ({
        path: normalizePath(toRelative(art.path) ?? art.path),
        description: art.description,
        kind: art.kind,
      })),
    };

    const reportMetaFile = reportFile.replace(/\.html?$/i, '.json');
    writeFileSync(reportMetaFile, JSON.stringify(reportMeta, null, 2));

    // Additionally emit allure-results (optional; only if allure-js-commons is available)
    try {
      const resultsRoot = path.resolve(reportRoot, '..', 'allure-results');
      const ok = tryGenerateAllure(resultsRoot, testName, data, this.logger);
      if (ok) {
        this.logger.debug?.(`Allure results updated at ${resultsRoot}`);
      }
    } catch (e) {
      this.logger.warn?.(`Allure generation failed: ${e}`);
    }

    return { testcase, reportFile };
  }
}

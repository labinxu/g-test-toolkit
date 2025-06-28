import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { writeFileSync } from 'fs';
@Injectable()
export class ReportService {
  private logger: CustomLogger;

  constructor(private readonly loggerService: LoggerService) {}
  async onModuleInit() {
    this.logger = this.loggerService.createLogger('ReportService');
  }

  async generate(
    workspace: string,
    testName: string,
    data: any,
  ): Promise<string> {
    this.logger.debug(`generate report at ${workspace}`);
    const now = new Date();
    const reportFile = `${workspace}/${testName}.html`;
    const hasError = data.logs.some((log: string) =>
      log.toLowerCase().includes('error'),
    );
    const status = hasError ? 'Failed' : 'Passed';
    const durationSeconds = (data.duration / 1000).toFixed(2);

    const reportHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report: ${testName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .log-section, .details-section { margin: 20px 0; }
    .log-entry { padding: 5px; border-bottom: 1px solid #eee; }
    .details-entry { padding: 10px; margin: 5px 0; background: #f9f9f9; border-radius: 4px; }
    .status-passed { color: green; font-weight: bold; }
    .status-failed { color: red; font-weight: bold; }
    .summary { background: #e0e0e0; padding: 15px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Test Report: ${testName} Time: ${now.toISOString()}</h1>
  <div class="summary">
    <p><strong>Status:</strong> <span class="status-${status.toLowerCase()}">${status}</span></p>
    <p><strong>Duration:</strong> ${durationSeconds} seconds</p>
    <p><strong>Assertions Run:</strong> ${data.exceptCounter}</p>
  </div>
  <div class="log-section">
    <h2>Logs</h2>
    ${data.logs.map((log: string) => `<div class="log-entry">${log}</div>`).join('')}
  </div>
  <div class="details-section">
    <h2>Test Details</h2>
    ${data.details.map((detail: string) => `<pre class="details-entry">${detail}</pre>`).join('')}
  </div>
</body>
</html>`;

    writeFileSync(reportFile, reportHtml);
    return reportFile;
  }
}

import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import axios from 'axios';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
@Injectable()
export class EmailService {
  private logger: CustomLogger;

  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('EmailService');
  }
  async mailgunVerify() {
    return;
  }
  async verifyEmailWithMailgun(domains: string[], apiKey: string) {
    const testEmails = domains.map(
      (domain) => `test_${Math.random().toString(36).substring(7)}@${domain}`,
    );
    this.logger.debug('verify email with mailgun');
    // Mailgun 配置
    const results: {
      email: string;
      isValid: boolean;
      reason: string;
      service: string;
    }[] = [];

    // 使用 Mailgun 验证
    for (const email of testEmails) {
      try {
        const response = await axios.get(
          'https://api.mailgun.net/v4/address/validate',
          {
            params: { address: email },
            auth: { username: 'api', password: apiKey },
          },
        );
        results.push({
          email,
          isValid: response.data.result === 'deliverable',
          reason: response.data.reason || 'Valid',
          service: 'Mailgun',
        });
      } catch (err) {
        const error = err as Error;
        results.push({
          email,
          isValid: false,
          reason: error.message,
          service: 'Mailgun',
        });
      }
    }
    console.log('====', results);
    return results;
  }
}

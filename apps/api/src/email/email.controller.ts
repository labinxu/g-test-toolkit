import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { EmailDomainDto } from './dto/emaildomain.dto';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('verify/mailgun')
  async verifyMailgun(@Body() domains: EmailDomainDto) {
    this.emailService.verifyEmailWithMailgun(
      domains.domains,
      domains.mailgunKey,
    );
  }
}

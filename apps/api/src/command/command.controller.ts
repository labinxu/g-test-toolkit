import { Controller, Get,Post,Body } from '@nestjs/common';
import { CommandService } from './command.service';

@Controller('commands')
export class CommandController {
  constructor(private readonly commandService: CommandService) {}

  @Get('execute')
  async execute() {
    const result = await this.commandService.runCommand('adb devices');
    return { output: result.stdout, error: result.stderr };
  }


}

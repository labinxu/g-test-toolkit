import { UserScenarioStatus } from '../entities/user-scenario.entity';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateUserScenarioDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  feature?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  submenu?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  priority?: 'P0' | 'P1' | 'P2';

  @IsOptional()
  @IsEnum(['draft', 'in_progress', 'ready', 'code_generated'] as any)
  status?: UserScenarioStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  suiteId?: number | null;
}

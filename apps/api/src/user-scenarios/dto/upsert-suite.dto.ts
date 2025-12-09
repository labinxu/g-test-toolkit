import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpsertSuiteDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  platform?: string | null;

  @IsOptional()
  @IsString()
  module?: string | null;

  @IsOptional()
  @IsArray()
  sharedPreSteps?: string[];
}

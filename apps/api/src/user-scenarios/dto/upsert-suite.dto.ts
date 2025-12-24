import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  @IsObject()
  actors?: Record<string, any>;

  @IsOptional()
  @IsString()
  defaultActor?: string | null;
}

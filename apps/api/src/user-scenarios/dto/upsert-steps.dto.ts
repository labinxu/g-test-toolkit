import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UserScenarioStepInputDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsInt()
  @Min(1)
  order: number;

  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  data?: string;

  @IsString()
  expected: string;

   @IsOptional()
   @IsString()
   binding?: string;
}

export class UpsertUserScenarioStepsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserScenarioStepInputDto)
  steps: UserScenarioStepInputDto[];
}

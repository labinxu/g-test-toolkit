import { ArrayNotEmpty, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InstallAppDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  serials: string[];

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

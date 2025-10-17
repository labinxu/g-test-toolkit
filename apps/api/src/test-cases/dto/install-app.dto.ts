import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class InstallAppDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  serials: string[];
}

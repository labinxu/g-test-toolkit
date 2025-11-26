import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartTestCaseDto {
  @ApiProperty({
    description: 'The name of the test case',
    example: 'TestCase1',
  })
  @IsString()
  @IsNotEmpty({ message: 'Case name cannot be empty' })
  caseName: string;

  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;
}
export class TestCaseDto {
  @ApiProperty({ description: 'code ', example: 'TestCase1' })
  @IsString()
  @IsNotEmpty({ message: 'Case name cannot be empty' })
  code: string;

  @ApiProperty({ description: 'clientId', example: '6gdOX1bg-aRGgwvEAAAB"}' })
  @IsString()
  clientId: string;
}

export class RunTestCaseDto {
  @IsString()
  @IsNotEmpty()
  testCode: string;
}
export class RunTestCaseFileDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;
  @IsString()
  @IsNotEmpty()
  clientId: string;
  @IsOptional()
  @IsBoolean()
  keepAppOpen?: boolean;
  @IsOptional()
  @IsBoolean()
  shareSession?: boolean;
  @IsOptional()
  @IsString()
  sessionKey?: string;
  @IsOptional()
  envConfig?: any;
}

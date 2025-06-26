import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
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

  @ApiProperty({ description: 'browser use', example: 'true' })
  @IsBoolean()
  useBrowser: boolean;

  @ApiProperty({ description: 'clientId', example: '6gdOX1bg-aRGgwvEAAAB"}' })
  @IsString()
  clientId: string;
}

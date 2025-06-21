import { IsString, IsNotEmpty,  } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartTestCaseDto {
  @ApiProperty({ description: 'The name of the test case', example: 'TestCase1' })
  @IsString()
  @IsNotEmpty({ message: 'Case name cannot be empty' })
  caseName: string;

  @ApiProperty({type:'string',format:'binary'})
  file:any;
  }

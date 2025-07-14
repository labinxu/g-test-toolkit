import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { IsString, IsDateString } from 'class-validator';

@Entity()
export class TestCase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  testCaseName: string;

  @Column()
  @IsString()
  status: string;

  @Column()
  @IsDateString()
  date: Date;
  @Column()
  @IsString()
  detail: string;
}

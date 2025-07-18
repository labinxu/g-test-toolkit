import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'
import { IsString, IsDateString } from 'class-validator'

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  type: string

  @Column()
  @IsString()
  account: string

  @Column()
  @IsString()
  password: string

  @Column()
  @IsString()
  url: string

  @Column()
  @IsDateString()
  cdate: Date
}

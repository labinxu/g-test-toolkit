import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'varchar', length: 190 })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @Column({ type: 'boolean', default: false })
  encrypted: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}


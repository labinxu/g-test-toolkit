import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'env_templates' })
export class EnvTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  platform: string;

  @Column({ length: 32 })
  driver: 'browser' | 'android' | 'ios' | 'other';

  @Column({ length: 64, unique: true })
  key: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text' })
  config: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: 0 })
  sortOrder: number;
}


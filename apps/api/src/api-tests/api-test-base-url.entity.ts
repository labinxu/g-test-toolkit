import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('api_test_base_urls')
export class ApiTestBaseUrl {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'integer' })
  userId: number;

  @Index()
  @Column({ length: 64 })
  module: string;

  @Column({ type: 'text' })
  url: string;

  @Index()
  @Column({ length: 255 })
  endpointId: string;

  @Column({ type: 'text', nullable: true })
  headersJson?: string | null;

  @Column({ length: 128, nullable: true })
  label?: string | null;

  @Column({ type: 'integer', default: 1 })
  usageCount: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  lastUsedAt: Date;
}

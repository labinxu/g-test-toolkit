import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('requirements')
export class Requirement {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 128 })
  key: string; // e.g., JIRA-123, REQ-001

  @Column({ length: 32, default: 'jira' })
  system: string; // jira | testrail | other

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text', nullable: true })
  url?: string | null;
}


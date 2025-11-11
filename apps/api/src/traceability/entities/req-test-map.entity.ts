import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('req_test_maps')
@Index(['requirementKey', 'testId'], { unique: true })
export class ReqTestMap {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 128 })
  requirementKey: string; // Requirement.key

  @Column({ type: 'text' })
  testId: string; // Stable test identifier (e.g., "Suite › Subsuite › Test")

  @Column({ length: 32, default: 'tests' })
  linkType: string; // semantic link type for export (tests/relates/etc.)

  @Column({ type: 'text', nullable: true })
  note?: string | null;
}


import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserScenario } from './user-scenario.entity';
import { UserScenarioSuite } from './user-scenario-suite.entity';
import { Actor } from '../../actors/entities/actor.entity';

@Entity({ name: 'user_scenario_suite_cases' })
@Index(['suiteId', 'caseId'], { unique: true })
export class UserScenarioSuiteCase {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserScenarioSuite, (s) => s.suiteCases, {
    onDelete: 'CASCADE',
  })
  suite: UserScenarioSuite;

  @Column()
  suiteId: number;

  @ManyToOne(() => UserScenario, (c) => c.suiteCases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'case_id' })
  scenario?: UserScenario;

  @Column({ name: 'case_id' })
  caseId: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId?: number | null;

  @ManyToOne(() => Actor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: Actor | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}

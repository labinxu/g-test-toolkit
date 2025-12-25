import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserScenario } from './user-scenario.entity';
import { UserScenarioSuite } from './user-scenario-suite.entity';

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
  scenario: UserScenario;

  @Column({ name: 'case_id' })
  caseId: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}

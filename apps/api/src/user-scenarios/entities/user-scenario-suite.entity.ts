import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserScenario } from './user-scenario.entity';
import { UserScenarioSuiteCase } from './user-scenario-suite-case.entity';

@Entity({ name: 'user_scenario_suites' })
export class UserScenarioSuite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 128 })
  name: string;

  @Column({ length: 64, default: 'gettr-web' })
  platform: string;

  @Column({ length: 64, default: 'live-stream' })
  module: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', name: 'shared_pre_steps', nullable: true })
  sharedPreStepsJson?: string | null;

  @Column({ type: 'text', name: 'actors', nullable: true })
  actorsJson?: string | null;

  @Column({ type: 'text', name: 'default_actor', nullable: true })
  defaultActor?: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  // Legacy relation: user_scenarios.suiteId (single suite per case)
  @OneToMany(() => UserScenario, (c) => c.suite)
  cases?: UserScenario[];

  // New relation: many-to-many via join table (supports per-suite ordering)
  @OneToMany(() => UserScenarioSuiteCase, (link) => link.suite)
  suiteCases?: UserScenarioSuiteCase[];
}

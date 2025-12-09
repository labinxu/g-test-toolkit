import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserScenario } from './user-scenario.entity';

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

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => UserScenario, (c) => c.suite)
  cases?: UserScenario[];
}

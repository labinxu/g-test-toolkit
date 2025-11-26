import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserScenario } from './user-scenario.entity';

@Entity({ name: 'user_scenario_steps' })
export class UserScenarioStep {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserScenario, (c) => c.steps, {
    onDelete: 'CASCADE',
  })
  scenario: UserScenario;

  @Column()
  order: number;

  @Column({ type: 'text' })
  action: string;

  @Column({ type: 'text', nullable: true })
  data?: string | null;

  @Column({ type: 'text' })
  expected: string;

  @Column({ type: 'text', nullable: true })
  binding?: string | null;
}

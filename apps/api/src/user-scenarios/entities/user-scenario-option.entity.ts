import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'user_scenario_options' })
@Index(['kind', 'value'], { unique: true })
export class UserScenarioOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 32 })
  kind: string; // 'module' | 'submenu' | 'priority'

  @Column({ length: 64 })
  value: string;

  @Column({ length: 128 })
  label: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}


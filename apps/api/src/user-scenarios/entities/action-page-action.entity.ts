import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActionPage } from './action-page.entity';
import { ActionParam } from './action-param.entity';

@Entity({ name: 'action_page_actions' })
@Index(['page', 'key'], { unique: true })
export class ActionPageAction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ActionPage, (page) => page.actions, {
    onDelete: 'CASCADE',
  })
  page: ActionPage;

  @Column()
  key: string;

  @Column()
  label: string;

  @Column()
  method: string;

  @Column({ type: 'text', default: 'action' })
  kind: 'action' | 'assert' | 'call';

  @Column({ name: 'action_type', type: 'text', nullable: true, default: 'click' })
  actionType?: 'click' | 'input' | 'drag' | null;

  @Column({ name: 'call_steps', type: 'text', nullable: true })
  callStepsJson?: string | null;

  @Column({ name: 'default_expected', type: 'text', nullable: true })
  defaultExpected?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', nullable: true })
  locator?: string | null;

  @Column({ name: 'return_target', nullable: true })
  returnTarget?: string | null;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => ActionParam, (param) => param.action, {
    cascade: ['insert', 'update'],
  })
  params?: ActionParam[];
}

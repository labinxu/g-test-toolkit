import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActionPageAction } from './action-page-action.entity';

@Entity({ name: 'action_pages' })
@Index(['platform', 'key'], { unique: true })
export class ActionPage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  platform: string;

  @Column()
  key: string;

  @Column()
  label: string;

  @Column()
  module: string;

  @Column({ name: 'class_name' })
  className: string;

  @Column({ name: 'var_name' })
  varName: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => ActionPageAction, (action) => action.page, {
    cascade: ['insert', 'update'],
  })
  actions?: ActionPageAction[];
}


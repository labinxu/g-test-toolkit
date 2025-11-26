import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActionPageAction } from './action-page-action.entity';

@Entity({ name: 'action_params' })
@Index(['action', 'name'], { unique: true })
export class ActionParam {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ActionPageAction, (action) => action.params, {
    onDelete: 'CASCADE',
  })
  action: ActionPageAction;

  @Column()
  name: string;

  @Column({ nullable: true })
  type?: string | null;

  @Column({ default: false })
  required: boolean;

  @Column({ nullable: true })
  placeholder?: string | null;

  @Column({ name: 'default_value', nullable: true })
  defaultValue?: string | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}


import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActorEnv } from './actor-env.entity';

@Entity({ name: 'actors' })
@Index(['accountName', 'envId'], { unique: true })
export class Actor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  accountName: string;

  @Column({ type: 'text' })
  password: string;

  @Column()
  envId: number;

  @ManyToOne(() => ActorEnv, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'envId' })
  env: ActorEnv;
}


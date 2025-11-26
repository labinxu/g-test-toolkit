import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'action_platforms' })
@Index(['key'], { unique: true })
export class ActionPlatform {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;

  @Column()
  label: string;

  @Column({ name: 'lib_dir', type: 'text', nullable: true })
  libDir?: string | null;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}


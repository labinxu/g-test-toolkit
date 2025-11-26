import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserScenarioStep } from './user-scenario-step.entity';

export type UserScenarioStatus = 'draft' | 'in_progress' | 'ready' | 'code_generated';

@Entity({ name: 'user_scenarios' })
export class UserScenario {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 所属平台（与 ActionPlatform.key 对应），例如：gettr-web / gettr-android。
   * 默认值为 gettr-web，便于向后兼容。
   */
  @Column({ length: 64, default: 'gettr-web' })
  platform: string;

  /**
   * 业务模块，例如 live-stream / push / notification 等。
   * 目前默认值为 live-stream，后续可以在同一张表中承载更多类型。
   * 注意：底层列名仍为 type 以兼容已有数据。
   */
  @Column({ name: 'type', length: 64, default: 'live-stream' })
  module: string;

  /**
   * 用例编码，例如 LS001，用于在前端展示和生成文件名。
   */
  @Column({ length: 64, unique: true })
  code: string;

  /**
   * 原始 CSV 中的 ID 或编号，便于同步。
   */
  @Column({ nullable: true, length: 64 })
  csvId?: string | null;

  @Column({ length: 255 })
  title: string;

  @Column({ nullable: true, length: 128 })
  feature?: string | null;

  /**
   * 子菜单分组，例如 host / viewer / interaction 等。
   */
  @Column({ nullable: true, length: 64 })
  submenu?: string | null;

  @Column({ default: 'P1', length: 4 })
  priority: 'P0' | 'P1' | 'P2';

  @Column({ default: 'draft', length: 32 })
  status: UserScenarioStatus;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /**
   * 是否已经生成了测试代码文件。
   */
  @Column({ default: false })
  hasCode: boolean;

  /**
   * 验收标准 / 关键检查条件，例如 From Studio open 等。
   */
  @Column({ type: 'text', nullable: true })
  acceptanceCriteria?: string | null;

  /**
   * 生成的测试代码相对路径，例如 users/labin/cases/live-stream/host/LS001.ts
   */
  @Column({ nullable: true, length: 512 })
  generatedFilePath?: string | null;

  @Column({ type: 'datetime', nullable: true })
  generatedAt?: Date | null;

  @Column({ nullable: true, length: 128 })
  lastUpdatedBy?: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => UserScenarioStep, (step) => step.scenario, {
    cascade: true,
  })
  steps?: UserScenarioStep[];
}

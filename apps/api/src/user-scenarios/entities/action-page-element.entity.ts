import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActionPage } from './action-page.entity';

@Entity({ name: 'action_page_elements' })
@Index(['page', 'elementId'], { unique: true })
export class ActionPageElement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ActionPage, (page) => page.elements, {
    onDelete: 'CASCADE',
  })
  page: ActionPage;

  /**
   * 冗余记录所属平台，便于按平台范围查询。
   * 与 ActionPage.platform 一致，例如：gettr-web / gettr-android。
   */
  @Column({ length: 64 })
  platform: string;

  /**
   * 原始页面名称（来自 web-ids 文件中的「页面名称」列）。
   */
  @Column({ name: 'page_name', length: 255 })
  pageName: string;

  /**
   * 元素 ID，一般对应前端的 data-testid 值。
   */
  @Column({ name: 'element_id', length: 255 })
  elementId: string;

  /**
   * 元素描述/说明。
   */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /**
   * 默认定位字符串，例如 [data-testid="login_button"]。
   */
  @Column({ name: 'default_locator', type: 'text', nullable: true })
  defaultLocator?: string | null;

  /**
   * 数据来源：import/manual 等，用于后续追溯（当前仅做标记）。
   */
  @Column({ length: 32, default: 'import' })
  source: string;
}


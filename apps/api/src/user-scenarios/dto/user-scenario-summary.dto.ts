import { UserScenarioStatus } from '../entities/user-scenario.entity';

export class UserScenarioSummaryDto {
  id: number;
  code: string;
  csvId?: string | null;
  title: string;
  module?: string | null;
  platform?: string | null;
  feature?: string | null;
  submenu?: string | null;
  priority: 'P0' | 'P1' | 'P2';
  status: UserScenarioStatus;
  hasSteps: boolean;
  hasCode: boolean;
  description?: string | null;
  acceptanceCriteria?: string | null;
  generatedFilePath?: string | null;
}

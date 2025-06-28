export interface TestcaseReport {
  date: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  cases: Array<{
    id: number;
    name: string;
    status: 'Passed' | 'Failed' | 'Skipped';
    duration: string;
    message: string;
  }>;
}

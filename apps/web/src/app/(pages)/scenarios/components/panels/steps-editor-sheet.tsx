import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Save } from 'lucide-react';
import { ScenarioStepsTable } from '../shared/steps-table';
import { SuitePanel } from './suite-panel';
import type { StepParamHint, UserScenarioStep, UserScenarioSummary, UserScenarioSuiteSummary } from '../../types';

export type StepsEditorSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCase: UserScenarioSummary | null;
  suites: UserScenarioSuiteSummary[];
  selectedSuiteId: number | null;
  suiteLoading: boolean;
  suiteGenerating: boolean;
  suiteDescDraft: string;
  suiteNameDraft: string;
  suitePreSteps: string[];
  suitePreStepDraft: string;
  suiteSaving: boolean;
  suiteDeleting?: boolean;
  onSuiteDescChange: (val: string) => void;
  onSuiteNameChange: (val: string) => void;
  onSuitePreStepsChange: (steps: string[]) => void;
  onSuitePreStepDraftChange: (val: string) => void;
  onOpenSuiteStepDialog: () => void;
  onEditSuiteStep: (id: string) => void;
  onAssignSuite: (id: number | null) => void;
  onSaveSuitePreSteps: () => void;
  onDeleteSuite: () => void;
  onOpenCreateSuite: () => void;
  onGenerateSuiteCode: () => void;
  currentSteps: UserScenarioStep[];
  getStepParamHint: (step: UserScenarioStep) => StepParamHint | null;
  onEditStep: (id: string) => void;
  onDeleteStep: (id: string) => void;
  onMoveStep: (id: string, direction: 'up' | 'down') => void;
  onAddStep: () => void;
  onSaveSteps: () => void;
};

export function StepsEditorSheet({
  open,
  onOpenChange,
  selectedCase,
  suites,
  selectedSuiteId,
  suiteLoading,
  suiteGenerating,
  suiteDescDraft,
  suiteNameDraft,
  suitePreSteps,
  suitePreStepDraft,
  suiteSaving,
  suiteDeleting,
  onSuiteDescChange,
  onSuiteNameChange,
  onSuitePreStepsChange,
  onSuitePreStepDraftChange,
  onOpenSuiteStepDialog,
  onEditSuiteStep,
  onAssignSuite,
  onSaveSuitePreSteps,
  onDeleteSuite,
  onOpenCreateSuite,
  onGenerateSuiteCode,
  currentSteps,
  getStepParamHint,
  onEditStep,
  onDeleteStep,
  onMoveStep,
  onAddStep,
  onSaveSteps,
}: StepsEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>编辑步骤与检查点</SheetTitle>
          {selectedCase && (
            <SheetDescription>
              为用例 {selectedCase.code}（{selectedCase.title}）补充或调整执行步骤。
            </SheetDescription>
          )}
        </SheetHeader>
        {!selectedCase ? (
          <p className="text-muted-foreground mt-2 text-sm">请先在列表中选择一个用户场景。</p>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
            <SuitePanel
              suites={suites}
              selectedSuiteId={selectedSuiteId}
              suiteLoading={suiteLoading}
              suiteGenerating={suiteGenerating}
              suiteNameDraft={suiteNameDraft}
              suiteDescDraft={suiteDescDraft}
              suitePreSteps={suitePreSteps}
              suitePreStepDraft={suitePreStepDraft}
              onSuiteDescChange={onSuiteDescChange}
              onSuiteNameChange={onSuiteNameChange}
              onSuitePreStepsChange={onSuitePreStepsChange}
              onSuitePreStepDraftChange={onSuitePreStepDraftChange}
              onOpenSuiteStepDialog={onOpenSuiteStepDialog}
              onEditSuiteStep={onEditSuiteStep}
              onAssignSuite={(id) => void onAssignSuite(id)}
              onSaveSuitePreSteps={onSaveSuitePreSteps}
              onDeleteSuite={onDeleteSuite}
              onOpenCreateSuite={onOpenCreateSuite}
              onGenerateSuiteCode={onGenerateSuiteCode}
              suiteSaving={suiteSaving}
              suiteDeleting={suiteDeleting}
            />

            <Card className="flex min-h-0 flex-1 flex-col border-none shadow-none">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>步骤与检查点</CardTitle>
                  <p className="text-muted-foreground mt-1 text-xs">
                    为当前用例补充详细执行步骤，每一步包含操作、数据与期望结果。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-full"
                        onClick={onAddStep}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>添加步骤</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={onSaveSteps}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>保存步骤</TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto">
                <ScenarioStepsTable
                  steps={currentSteps}
                  mode="editable"
                  showRowNumber
                  getStepParamHint={getStepParamHint}
                  onEditStep={onEditStep}
                  onDeleteStep={onDeleteStep}
                  onMoveStep={onMoveStep}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

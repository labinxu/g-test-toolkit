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
  selectedCaseId: number | null;
  allCases: Pick<UserScenarioSummary, 'id' | 'code' | 'title'>[];
  suites: UserScenarioSuiteSummary[];
  selectedSuiteId: number | null;
  suiteCases: Pick<UserScenarioSummary, 'id' | 'code' | 'title'>[];
  removingSuiteCaseId?: number | null;
  addingSuiteCases?: boolean;
  onEditSuiteCase: (id: number) => void;
  onRemoveSuiteCase: (id: number) => void;
  onAddSuiteCases: (suiteId: number, caseIds: number[]) => Promise<boolean> | boolean;
  suiteLoading: boolean;
  suiteGenerating: boolean;
  suiteDescDraft: string;
  suitePreSteps: string[];
  suitePreStepDraft: string;
  suiteActorsDraft: {
    name: string;
    scope: 'suite' | 'test';
    authMode: 'ui' | 'cookies';
    cookiesPath: string;
  }[];
  suiteDefaultActorDraft: string;
  suiteSaving: boolean;
  suiteDeleting?: boolean;
  onSuiteDescChange: (val: string) => void;
  onSuitePreStepsChange: (steps: string[]) => void;
  onSuitePreStepDraftChange: (val: string) => void;
  onSuiteActorsDraftChange: (
    actors: {
      name: string;
      scope: 'suite' | 'test';
      authMode: 'ui' | 'cookies';
      cookiesPath: string;
    }[],
  ) => void;
  onSuiteDefaultActorDraftChange: (val: string) => void;
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
  selectedCaseId,
  allCases,
  suites,
  selectedSuiteId,
  suiteCases,
  removingSuiteCaseId,
  addingSuiteCases,
  onEditSuiteCase,
  onRemoveSuiteCase,
  onAddSuiteCases,
  suiteLoading,
  suiteGenerating,
  suiteDescDraft,
  suitePreSteps,
  suitePreStepDraft,
  suiteActorsDraft,
  suiteDefaultActorDraft,
  suiteSaving,
  suiteDeleting,
  onSuiteDescChange,
  onSuitePreStepsChange,
  onSuitePreStepDraftChange,
  onSuiteActorsDraftChange,
  onSuiteDefaultActorDraftChange,
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
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col overflow-hidden sm:max-w-3xl"
      >
        <SheetHeader>
          <SheetTitle>编辑步骤与检查点</SheetTitle>
          {selectedCase && (
            <SheetDescription>
              为用例 {selectedCase.code}（{selectedCase.title}）补充或调整执行步骤。
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {!selectedCase ? (
            <p className="text-muted-foreground text-sm">
              请先在列表中选择一个用户场景。
            </p>
          ) : (
            <div className="flex min-h-0 flex-col gap-2">
              <SuitePanel
                suites={suites}
                selectedSuiteId={selectedSuiteId}
                suiteCases={suiteCases}
                allCases={allCases}
                selectedCaseId={selectedCaseId}
                removingSuiteCaseId={removingSuiteCaseId}
                addingSuiteCases={addingSuiteCases}
                suiteLoading={suiteLoading}
                suiteGenerating={suiteGenerating}
                suiteDescDraft={suiteDescDraft}
                suitePreSteps={suitePreSteps}
                suitePreStepDraft={suitePreStepDraft}
                suiteActorsDraft={suiteActorsDraft}
                suiteDefaultActorDraft={suiteDefaultActorDraft}
                onSuiteDescChange={onSuiteDescChange}
                onSuitePreStepsChange={onSuitePreStepsChange}
                onSuitePreStepDraftChange={onSuitePreStepDraftChange}
                onSuiteActorsDraftChange={onSuiteActorsDraftChange}
                onSuiteDefaultActorDraftChange={onSuiteDefaultActorDraftChange}
                onOpenSuiteStepDialog={onOpenSuiteStepDialog}
                onEditSuiteStep={onEditSuiteStep}
                onAssignSuite={(id) => void onAssignSuite(id)}
                onEditSuiteCase={onEditSuiteCase}
                onRemoveSuiteCase={onRemoveSuiteCase}
                onAddSuiteCases={onAddSuiteCases}
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

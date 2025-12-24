'use client';

import { SocketProvider } from '../testcases/socket-content';
import { CasesPanel } from './components/panels/cases-panel';
import { StepsEditorSheet } from './components/panels/steps-editor-sheet';
import { CaseMetaDialog } from './components/dialogs/case-meta-dialog';
import { EnvTemplateDialog } from './components/dialogs/env-template-dialog';
import { StepDialog } from './components/dialogs/step-dialog';
import { NewCaseDialog } from './components/dialogs/new-case-dialog';
import { DocAiPromptDialog } from './components/dialogs/doc-ai-prompt-dialog';
import { NewSuiteDialog } from './components/dialogs/new-suite-dialog';
import { RunLogDrawer } from './components/run-log-drawer';
import {
  SUBMENU_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  useScenariosModel,
} from './hooks/use-scenarios';

export default function ScenariosPage() {
  return (
    <SocketProvider>
      <ScenariosPageContent />
    </SocketProvider>
  );
}

function ScenariosPageContent() {
  const vm = useScenariosModel();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div>
        <h1 className="text-2xl font-semibold">用户场景管理</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          可从结构化 CSV（推荐使用 Livestream CSV
          模板）或说明文档/设计文档导入用例草稿，在此补充详细步骤与检查点，并生成
          workspace 测试代码。
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
        <CasesPanel
          platform={vm.platform}
          platforms={vm.platforms}
          ingestingDoc={vm.ingestingDoc}
          loadingCases={vm.loadingCases}
          onOpenDocPrompt={() => vm.setDocAiPromptOpen(true)}
          onCsvFileChange={vm.handleUploadCsvFile}
          onDocFileChange={vm.handleUploadDocFile}
          onPlatformChange={vm.handlePlatformChange}
          onRefresh={vm.refreshCases}
          tablePage={vm.tablePage}
          tablePageSize={vm.tablePageSize}
          tableFilteredRows={vm.tableFilteredRows}
          onRowCountChange={(total, filtered) => {
            vm.setTableTotalRows(total);
            vm.setTableFilteredRows(filtered);
          }}
          filteredCases={vm.filteredCases}
          totalPages={vm.totalPages}
          safePage={vm.safePage}
          onPageChange={(p) => vm.setTablePage(p)}
          onPageSizeChange={(size) => {
            vm.setTablePageSize(size);
            vm.setTablePage(1);
          }}
          onNewCase={() => {
            vm.setNewCaseCode('');
            vm.setNewCaseTitle('');
            vm.setNewCaseFeature('');
            vm.setNewCaseSubmenu(undefined);
            vm.setNewCasePriority('P1');
            vm.setNewCaseStatus('draft');
            vm.setNewCaseDesc('');
            vm.setNewCaseAcceptance('');
            vm.setNewCaseOpen(true);
          }}
          selectedIds={vm.selectedIds}
          deletingBulk={vm.deletingBulk}
          onDeleteSelected={vm.handleDeleteSelected}
          onExport={vm.handleExportCases}
          selectedCaseId={vm.selectedCaseId}
          onSelectCase={vm.setSelectedCaseId}
          moduleLabelMap={vm.moduleLabelMap}
          submenuLabelMap={SUBMENU_LABEL}
          priorityLabelMap={PRIORITY_LABEL}
          statusLabelMap={STATUS_LABEL}
          runEnvItems={[
            { value: 'none', label: '默认环境（无模板）' },
            ...vm.runEnvTemplates.map((tpl) => ({
              value: `${tpl.id}`,
              label: tpl.name || tpl.key || `模板 #${tpl.id}`,
            })),
          ]}
          runEnvSelected={vm.runEnvSelectedId ?? 'none'}
          onSelectRunEnv={vm.handleSelectRunEnv}
          tableSelectedKeys={vm.tableSelectedKeys}
          onSelectionChange={(keys, ids) => {
            vm.setTableSelectedKeys(keys);
            vm.setSelectedIds(ids);
          }}
          deletingId={vm.deletingId}
          onDeleteCase={(id) => void vm.handleDeleteCase(id)}
          onOpenMeta={(id) => {
            vm.setSelectedCaseId(id);
            vm.setMetaDialogOpen(true);
          }}
          onOpenSteps={(id) => {
            vm.setSelectedCaseId(id);
            vm.setDetailsOpen(true);
          }}
          onGenerateCode={(id, plat) =>
            void vm.openEnvTemplateDialogForCase(id, plat || vm.platform)
          }
          onOpenTestcases={(filePath) => {
            const pathVal = (filePath || '').trim();
            if (pathVal) {
              try {
                localStorage.setItem('gtt:testcases:lastFile', pathVal);
              } catch {}
            }
            vm.router.push('/testcases');
          }}
          onRunCase={vm.handleRunCase}
          onRunSelected={vm.handleRunSelected}
          onOpenRunLogs={() => vm.setLogPanelOpen(true)}
        />
      </div>

      {/* 用例步骤编辑侧边栏（Sheet） */}
      <StepsEditorSheet
        open={vm.detailsOpen}
        onOpenChange={vm.setDetailsOpen}
        selectedCase={vm.selectedCase}
        suites={vm.suites}
        selectedSuiteId={vm.selectedSuiteId}
        suiteLoading={vm.suiteLoading}
        suiteGenerating={vm.suiteGenerating}
        suiteDescDraft={vm.suiteDescDraft}
        suiteNameDraft={vm.suiteNameDraft}
        suitePreSteps={vm.suitePreSteps}
        suitePreStepDraft={vm.suitePreStepDraft}
        suiteActorsDraft={vm.suiteActorsDraft}
        suiteDefaultActorDraft={vm.suiteDefaultActorDraft}
        suiteSaving={vm.suiteSaving}
        suiteDeleting={vm.suiteDeleting}
        onSuiteDescChange={vm.setSuiteDescDraft}
        onSuiteNameChange={vm.setSuiteNameDraft}
        onSuitePreStepsChange={vm.setSuitePreSteps}
        onSuitePreStepDraftChange={vm.setSuitePreStepDraft}
        onSuiteActorsDraftChange={vm.setSuiteActorsDraft}
        onSuiteDefaultActorDraftChange={vm.setSuiteDefaultActorDraft}
        onOpenSuiteStepDialog={vm.handleAddSuitePreStep}
        onEditSuiteStep={vm.handleEditSuitePreStep}
        onAssignSuite={(id) => void vm.handleAssignSuite(id)}
        onSaveSuitePreSteps={vm.handleSaveSuitePreSteps}
        onDeleteSuite={vm.handleDeleteSuite}
        onOpenCreateSuite={() => vm.setSuiteDialogOpen(true)}
        onGenerateSuiteCode={vm.handleGenerateSuiteCode}
        currentSteps={vm.currentSteps}
        getStepParamHint={vm.getStepParamHint}
        onEditStep={vm.handleEditStepInDialog}
        onDeleteStep={vm.handleDeleteStep}
        onMoveStep={vm.handleMoveStep}
        onAddStep={vm.handleAddStep}
        onSaveSteps={vm.handleSaveSteps}
      />

      <CaseMetaDialog
        open={vm.metaDialogOpen}
        selectedCase={vm.selectedCase}
        platform={vm.platform}
        platforms={vm.platforms}
        submenuItems={vm.submenuItems}
        priorityItems={vm.priorityItems}
        moduleItems={vm.moduleItems}
        statusItems={vm.statusItems}
        editingTitle={vm.editingTitle}
        editingSubmenu={vm.editingSubmenu}
        editingPriority={vm.editingPriority}
        editingModule={vm.editingModule}
        onOpenChange={vm.setMetaDialogOpen}
        onChangeTitle={vm.setEditingTitle}
        onChangeSubmenu={vm.setEditingSubmenu}
        onChangePriority={vm.setEditingPriority}
        onChangeModule={(val) => vm.setEditingModule(val.replace(/[^A-Za-z0-9]+/g, ''))}
        onUpdateStatus={(status) => vm.updateCaseMeta({ status })}
        onUpdatePlatform={(value) => vm.updateCaseMeta({ platform: value })}
        onSave={vm.handleMockSaveCase}
      />

      <NewSuiteDialog
        open={vm.suiteDialogOpen}
        saving={vm.suiteSaving}
        name={vm.newSuiteName}
        description={vm.newSuiteDesc}
        onOpenChange={vm.setSuiteDialogOpen}
        onNameChange={vm.setNewSuiteName}
        onDescChange={vm.setNewSuiteDesc}
        onSubmit={vm.handleCreateSuite}
      />

      <EnvTemplateDialog
        open={vm.envDialogOpen}
        loading={vm.envDialogLoading}
        platform={vm.envDialogPlatform}
        driver={vm.envDialogDriver}
        templates={vm.envDialogTemplates}
        selectedId={vm.envDialogSelectedId}
        caseId={vm.envDialogCaseId}
        onOpenChange={vm.setEnvDialogOpen}
        onSelectTemplate={(val) => vm.setEnvDialogSelectedId(val)}
        onConfirm={vm.handleEnvDialogConfirm}
        onNavigateSettings={() => vm.router.push('/settings/env-templates')}
      />

      <StepDialog
        open={vm.stepDialogOpen}
        loadingCatalog={vm.loadingCatalog}
        isApiPlatform={vm.isDialogApiPlatform}
        actionCatalog={vm.actionCatalog}
        stepDialogPageKey={vm.stepDialogPageKey}
        stepDialogActionKey={vm.stepDialogActionKey}
        stepDialogArgs={vm.stepDialogArgs}
        stepDialogExpected={vm.stepDialogExpected}
        stepDialogActionText={vm.stepDialogActionText}
        stepDialogCheckType={vm.stepDialogCheckType}
        stepDialogCheckLocator={vm.stepDialogCheckLocator}
        stepDialogCheckExpectedUrl={vm.stepDialogCheckExpectedUrl}
        stepDialogCheckTimeoutMs={vm.stepDialogCheckTimeoutMs}
        editingStepIdForDialog={vm.editingStepIdForDialog}
        stepDialogApiMethod={vm.stepDialogApiMethod}
        stepDialogApiPath={vm.stepDialogApiPath}
        stepDialogApiBody={vm.stepDialogApiBody}
        stepDialogTarget={vm.stepDialogTarget}
        selectedCase={vm.selectedCase}
        platform={vm.platform}
        onOpenChange={vm.handleStepDialogOpenChange}
        onSetStepDialogPageKey={vm.setStepDialogPageKey}
        onSetStepDialogActionKey={vm.setStepDialogActionKey}
        onSetStepDialogArgs={(updater) => vm.setStepDialogArgs((prev) => updater(prev))}
        onSetStepDialogExpected={vm.setStepDialogExpected}
        onSetStepDialogActionText={vm.setStepDialogActionText}
        onSetStepDialogCheckType={vm.setStepDialogCheckType}
        onSetStepDialogCheckLocator={vm.setStepDialogCheckLocator}
        onSetStepDialogCheckExpectedUrl={vm.setStepDialogCheckExpectedUrl}
        onSetStepDialogCheckTimeoutMs={vm.setStepDialogCheckTimeoutMs}
        onSetStepDialogApiMethod={vm.setStepDialogApiMethod}
        onSetStepDialogApiPath={vm.setStepDialogApiPath}
        onSetStepDialogApiBody={vm.setStepDialogApiBody}
        onSubmit={vm.handleStepDialogSubmit}
      />

      <NewCaseDialog
        open={vm.newCaseOpen}
        platform={vm.platform}
        platforms={vm.platforms}
        submenuItems={vm.submenuItems}
        priorityItems={vm.priorityItems}
        statusItems={vm.statusItems}
        newCaseCode={vm.newCaseCode}
        newCaseTitle={vm.newCaseTitle}
        newCaseFeature={vm.newCaseFeature}
        newCaseSubmenu={vm.newCaseSubmenu}
        newCasePriority={vm.newCasePriority}
        newCaseStatus={vm.newCaseStatus}
        newCaseDesc={vm.newCaseDesc}
        newCaseAcceptance={vm.newCaseAcceptance}
        submitting={vm.newCaseSubmitting}
        onOpenChange={vm.setNewCaseOpen}
        onPlatformChange={(val) => {
          vm.setPlatform(val);
          try {
            localStorage.setItem('gtt:scenarios:platform', val);
          } catch {}
        }}
        onCodeChange={vm.setNewCaseCode}
        onTitleChange={vm.setNewCaseTitle}
        onFeatureChange={vm.setNewCaseFeature}
        onSubmenuChange={vm.setNewCaseSubmenu}
        onPriorityChange={vm.setNewCasePriority}
        onStatusChange={vm.setNewCaseStatus}
        onDescChange={vm.setNewCaseDesc}
        onAcceptanceChange={vm.setNewCaseAcceptance}
        onSubmit={vm.handleCreateCase}
      />

      <DocAiPromptDialog
        open={vm.docAiPromptOpen}
        promptText={vm.docAiPromptText}
        onOpenChange={vm.setDocAiPromptOpen}
        onPromptChange={vm.setDocAiPromptText}
        onConfirm={vm.handleDocAiConfirm}
      />

      <RunLogDrawer
        open={vm.logPanelOpen}
        onOpenChange={vm.setLogPanelOpen}
        tasks={vm.runQueue}
        runningCaseId={vm.runningCaseId}
        logs={vm.runLogs}
        onClearLogs={vm.clearLogs}
        connected={vm.runConnected}
      />
    </div>
  );
}

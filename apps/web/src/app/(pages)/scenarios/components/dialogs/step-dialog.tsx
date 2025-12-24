import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { OptionsSelect } from '@/components/select/options-select';
import { OptionsSelectSearch } from '@/components/select/options-select-search';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import type {
  ActionCatalog,
  StepCheckRuleType,
  UserScenarioSummary,
} from '../../types';

export type StepDialogProps = {
  open: boolean;
  loadingCatalog: boolean;
  isApiPlatform: boolean;
  actionCatalog: ActionCatalog | null;
  stepDialogPageKey?: string;
  stepDialogActionKey?: string;
  stepDialogArgs: Record<string, string>;
  stepDialogExpected: string;
  stepDialogActionText: string;
  stepDialogCheckType: StepCheckRuleType | '';
  stepDialogCheckLocator: string;
  stepDialogCheckExpectedUrl: string;
  stepDialogCheckTimeoutMs: string;
  editingStepIdForDialog: string | null;
  stepDialogApiMethod: string;
  stepDialogApiPath: string;
  stepDialogApiBody: string;
  stepDialogTarget: 'case' | 'suite';
  selectedCase: UserScenarioSummary | null;
  platform: string;
  onOpenChange: (open: boolean) => void;
  onSetStepDialogPageKey: (val: string | undefined) => void;
  onSetStepDialogActionKey: (val: string | undefined) => void;
  onSetStepDialogArgs: (
    updater: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
  onSetStepDialogExpected: (val: string) => void;
  onSetStepDialogActionText: (val: string) => void;
  onSetStepDialogCheckType: (val: StepCheckRuleType | '') => void;
  onSetStepDialogCheckLocator: (val: string) => void;
  onSetStepDialogCheckExpectedUrl: (val: string) => void;
  onSetStepDialogCheckTimeoutMs: (val: string) => void;
  onSetStepDialogApiMethod: (val: string) => void;
  onSetStepDialogApiPath: (val: string) => void;
  onSetStepDialogApiBody: (val: string) => void;
  onSubmit: () => void;
};

export function StepDialog({
  open,
  loadingCatalog,
  isApiPlatform,
  actionCatalog,
  stepDialogPageKey,
  stepDialogActionKey,
  stepDialogArgs,
  stepDialogExpected,
  stepDialogActionText,
  stepDialogCheckType,
  stepDialogCheckLocator,
  stepDialogCheckExpectedUrl,
  stepDialogCheckTimeoutMs,
  editingStepIdForDialog,
  stepDialogApiMethod,
  stepDialogApiPath,
  stepDialogApiBody,
  stepDialogTarget,
  selectedCase,
  platform,
  onOpenChange,
  onSetStepDialogPageKey,
  onSetStepDialogActionKey,
  onSetStepDialogArgs,
  onSetStepDialogExpected,
  onSetStepDialogActionText,
  onSetStepDialogCheckType,
  onSetStepDialogCheckLocator,
  onSetStepDialogCheckExpectedUrl,
  onSetStepDialogCheckTimeoutMs,
  onSetStepDialogApiMethod,
  onSetStepDialogApiPath,
  onSetStepDialogApiBody,
  onSubmit,
}: StepDialogProps) {
  const router = useRouter();
  const dialogPlatform = (
    (stepDialogTarget === 'case' ? selectedCase?.platform : platform) ||
    platform ||
    ''
  )
    .toString()
    .toLowerCase();
  const isDialogApiPlatform = isApiPlatform || dialogPlatform.includes('-api-');
  const dialogPage =
    (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null;
  const dialogAction =
    dialogPage?.actions.find((a) => a.key === stepDialogActionKey) || null;

  const handleOpenInActionCatalog = () => {
    if (!dialogPage) return;
    const qs = new URLSearchParams();
    if (dialogPlatform) qs.set('platform', dialogPlatform);
    qs.set('pageKey', dialogPage.key);
    if (dialogAction) qs.set('actionKey', dialogAction.key);
    router.push(`/scenarios/action-catalog?${qs.toString()}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onEscapeKeyDown={(e) => {
          if (loadingCatalog) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (loadingCatalog) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (loadingCatalog) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {(() => {
              const targetLabel = stepDialogTarget === 'suite' ? '套件前置步骤' : '步骤';
              if (isDialogApiPlatform) {
                const base =
                  editingStepIdForDialog != null ? `编辑${targetLabel}（API）` : `添加${targetLabel}（API）`;
                return base;
              }
              const page =
                (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null;
              const action = page?.actions.find((a) => a.key === stepDialogActionKey) || null;
              const base =
                editingStepIdForDialog != null ? `编辑${targetLabel}` : `添加${targetLabel}`;
              if (!action) {
                return `${base}：选择页面与动作`;
              }
              const typeLabel = action.kind === 'assert' ? '检查点' : '操作';
              return `${base}（${typeLabel}）`;
            })()}
          </DialogTitle>
          <DialogDescription>
            {(() => {
              if (isDialogApiPlatform) {
                return '直接编辑步骤说明与期望结果，适用于基于 API 的用户场景（不绑定页面动作）。';
              }
              return '通过下拉选择页面和动作，自动与 gettr-web-lib 中的 Page 类和方法建立映射，再补充参数与期望检查点。';
            })()}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto rounded-lg border-1 px-4 py-3">
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>操作说明</Label>
              <Textarea
                rows={2}
                value={stepDialogActionText}
                onChange={(e) => onSetStepDialogActionText(e.target.value)}
                placeholder={(() => {
                  if (isDialogApiPlatform) {
                    return '例如：调用 /u/live/stream 接口，校验返回流对象信息。';
                  }
                  const page =
                    (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null;
                  const action =
                    page?.actions.find((a) => a.key === stepDialogActionKey) || null;
                  if (page && action) return `${page.label} · ${action.label}`;
                  return '可选：补充对该步骤的人类可读说明';
                })()}
              />
            </div>
            {(() => {
              if (!isDialogApiPlatform) return null;
              return (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="api-step-method">HTTP 方法</Label>
                      <OptionsSelect<string>
                        id="api-step-method"
                        value={stepDialogApiMethod}
                        items={[
                          { value: 'GET', label: 'GET' },
                          { value: 'POST', label: 'POST' },
                          { value: 'PUT', label: 'PUT' },
                          { value: 'DELETE', label: 'DELETE' },
                          { value: 'PATCH', label: 'PATCH' },
                        ]}
                        placeholder="选择方法"
                        onSelect={(item) =>
                          onSetStepDialogApiMethod(
                            (item.value || 'GET').toString().toUpperCase() || 'GET',
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="api-step-path">请求路径</Label>
                      <Input
                        id="api-step-path"
                        value={stepDialogApiPath}
                        onChange={(e) => onSetStepDialogApiPath(e.target.value)}
                        placeholder="/u/live/stream"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="api-step-body">请求 Body（JSON，可选）</Label>
                    <Textarea
                      id="api-step-body"
                      rows={3}
                      value={stepDialogApiBody}
                      onChange={(e) => onSetStepDialogApiBody(e.target.value)}
                      placeholder='例如：{"streamIds":["lv_p_cbx_live_1s"]}'
                    />
                  </div>
                </>
              );
            })()}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ls-step-page">页面</Label>
                <OptionsSelectSearch
                  id="ls-step-page"
                  placeholder="选择页面"
                  value={stepDialogPageKey}
                  items={(actionCatalog?.pages || []).map((p) => ({
                    value: p.key,
                    label: p.label,
                  }))}
                  onChange={(val) => {
                    onSetStepDialogPageKey(val);
                    onSetStepDialogActionKey(undefined);
                    onSetStepDialogArgs(() => ({}));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ls-step-action">动作</Label>
                <OptionsSelectSearch
                  id="ls-step-action"
                  placeholder="选择动作"
                  value={stepDialogActionKey}
                  items={
                    (actionCatalog?.pages || [])
                      .find((p) => p.key === stepDialogPageKey)
                      ?.actions.map((a) => ({
                        value: a.key,
                        label: a.label,
                      })) || []
                  }
                  onChange={(val) => {
                    onSetStepDialogActionKey(val);
                    onSetStepDialogArgs(() => ({}));
                    const page =
                      (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) ||
                      null;
                    const action = page?.actions.find((a) => a.key === val) || null;
                    if (action?.defaultExpected && !stepDialogExpected) {
                      onSetStepDialogExpected(action.defaultExpected);
                    }
                    if (!stepDialogCheckType && action && action.kind === 'assert') {
                      const locRaw = (action as any).locator as string | null | undefined;
                      if (locRaw && locRaw.trim()) {
                        onSetStepDialogCheckType('element-visible');
                        onSetStepDialogCheckLocator(locRaw.trim());
                      }
                    }
                  }}
                />
              </div>
            </div>

            {!isDialogApiPlatform && dialogPage ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                  已选择映射：{dialogPage.label}
                  {dialogAction ? ` · ${dialogAction.label}` : ''}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-7 px-2"
                  onClick={handleOpenInActionCatalog}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  去页面映射
                </Button>
              </div>
            ) : null}

            <div className="space-y-3">
              {(() => {
                const page =
                  (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null;
                const action =
                  page?.actions.find((a) => a.key === stepDialogActionKey) || null;
                const params = action?.params || [];
                if (!params.length) return null;
                return (
                  <div className="space-y-2">
                    <Label className="text-xs">动作参数</Label>
                    <div className="space-y-2">
                      {params.map((param) => (
                        <div key={param.name} className="space-y-1">
                          <Label className="flex items-center justify-between text-xs">
                            <span>{param.name}</span>
                            {param.required && (
                              <span className="text-[11px] text-red-500">必填</span>
                            )}
                          </Label>
                          <Input
                            value={stepDialogArgs[param.name] || ''}
                            onChange={(e) =>
                              onSetStepDialogArgs((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            placeholder={param.placeholder || ''}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const page =
                  (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null;
                const action =
                  page?.actions.find((a) => a.key === stepDialogActionKey) || null;
                const callSteps = (action as any)?.callSteps as
                  | {
                      targetActionKey: string;
                      args?: string[];
                      sortOrder?: number;
                    }[]
                  | undefined;
                if (!page || !action || action.kind !== 'call' || !callSteps || !callSteps.length) {
                  return null;
                }
                const stepsSorted = [...callSteps].sort((a, b) => {
                  const sa =
                    typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder)
                      ? a.sortOrder
                      : 0;
                  const sb =
                    typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder)
                      ? b.sortOrder
                      : 0;
                  return sa - sb;
                });
                return (
                  <div className="space-y-2 rounded-md border px-2 py-2">
                    <Label className="text-xs">内部调用预览（函数调用）</Label>
                    <p className="text-[11px] text-muted-foreground">
                      该动作为函数调用类型，将在 Page 类中生成一个组合方法，内部依次调用当前页面上的其它方法。
                    </p>
                    <div className="space-y-1">
                      {stepsSorted.map((step, idx) => {
                        const target =
                          page.actions.find((a) => a.key === step.targetActionKey) || null;
                        const targetLabel = target
                          ? `${target.method || target.key} · ${target.label || target.key}`
                          : step.targetActionKey;
                        const argList = (step.args || [])
                          .map((v) => String(v || '').trim())
                          .filter((v) => v.length > 0);
                        const argPreview = argList.length > 0 ? argList.join(', ') : '（无参数或不传）';
                        return (
                          <div
                            key={`${step.targetActionKey}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted px-2 py-1.5 text-[11px]"
                          >
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="font-mono text-[11px]">
                                步骤 {idx + 1}:{' '}
                                <span className="font-normal">
                                  {page.varName || 'page'}.
                                  {target ? target.method : step.targetActionKey}({argPreview})
                                </span>
                              </span>
                              {target && <span className="text-muted-foreground truncate">{target.label}</span>}
                            </div>
                            <span className="text-muted-foreground truncate">{targetLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label className="text-xs">自动检查规则（可选）</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="ls-step-check-type" className="text-[11px]">
                      检查类型
                    </Label>
                    <OptionsSelect<string>
                      id="ls-step-check-type"
                      value={stepDialogCheckType || 'none'}
                      items={[
                        { value: 'none', label: '不配置（仅写期望文案）' },
                        { value: 'element-visible', label: '元素出现（element visible）' },
                        { value: 'element-hidden', label: '元素消失（element hidden）' },
                        { value: 'url-contains', label: '页面 URL 包含（url contains）' },
                        { value: 'url-equals', label: '页面 URL 等于（url equals）' },
                      ]}
                      onSelect={(item) => {
                        const v = item.value;
                        if (
                          v === 'element-visible' ||
                          v === 'element-hidden' ||
                          v === 'url-contains' ||
                          v === 'url-equals'
                        ) {
                          onSetStepDialogCheckType(v);
                        } else {
                          onSetStepDialogCheckType('');
                        }
                      }}
                      size="sm"
                      triggerClassName="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ls-step-check-timeout" className="text-[11px]">
                      超时时间（毫秒，可选）
                    </Label>
                    <Input
                      id="ls-step-check-timeout"
                      className="h-8 text-xs"
                      value={stepDialogCheckTimeoutMs}
                      onChange={(e) =>
                        onSetStepDialogCheckTimeoutMs(e.target.value.replace(/[^0-9]/g, ''))
                      }
                      placeholder="例如：30000"
                    />
                  </div>
                </div>
                {stepDialogCheckType === 'element-visible' || stepDialogCheckType === 'element-hidden' ? (
                  <div className="space-y-1">
                    <Label htmlFor="ls-step-check-locator" className="text-[11px]">
                      元素定位字符串（CSS/XPath/资源 ID）
                    </Label>
                    <Input
                      id="ls-step-check-locator"
                      className="h-8 text-xs"
                      value={stepDialogCheckLocator}
                      onChange={(e) => onSetStepDialogCheckLocator(e.target.value)}
                      placeholder='例如：div.action-bar > button，或 android=new UiSelector().resourceId("com.xx:id/btn")'
                    />
                  </div>
                ) : null}
                {stepDialogCheckType === 'url-contains' || stepDialogCheckType === 'url-equals' ? (
                  <div className="space-y-1">
                    <Label htmlFor="ls-step-check-url" className="text-[11px]">
                      期望 URL
                    </Label>
                    <Input
                      id="ls-step-check-url"
                      className="h-8 text-xs"
                      value={stepDialogCheckExpectedUrl}
                      onChange={(e) => onSetStepDialogCheckExpectedUrl(e.target.value)}
                      placeholder="例如：/live 或 https://stg.gettr.com/live"
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="ls-step-expected">提示信息（可选）</Label>
                <Textarea
                  id="ls-step-expected"
                  rows={3}
                  value={stepDialogExpected}
                  onChange={(e) => onSetStepDialogExpected(e.target.value)}
                  placeholder="当检查失败时打印的提示，例如：在 30 秒内进入“直播中”状态，观众端可以看到直播画面。"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-3">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                取消
              </Button>
            </DialogClose>
            <Button type="button" onClick={onSubmit}>
              保存
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

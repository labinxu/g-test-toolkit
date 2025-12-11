import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  OptionsSelect,
  type OptionsSelectItem,
} from '@/components/select/options-select';
import { Button } from '@/components/ui/button';
import type { EnvTemplateSummary } from '../../types';

export type EnvTemplateDialogProps = {
  open: boolean;
  loading: boolean;
  platform: string;
  driver: 'browser' | 'android' | 'ios' | 'other';
  templates: EnvTemplateSummary[];
  selectedId: number | 'none' | null;
  caseId: number | null;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (value: number | 'none' | null) => void;
  onConfirm: () => void;
  onNavigateSettings: () => void;
};

export function EnvTemplateDialog({
  open,
  loading,
  platform,
  driver,
  templates,
  selectedId,
  caseId,
  onOpenChange,
  onSelectTemplate,
  onConfirm,
  onNavigateSettings,
}: EnvTemplateDialogProps) {
  const templateOptions: OptionsSelectItem<string>[] = [
    { value: 'none', label: '不使用模板（使用默认配置）' },
    ...templates.map((tpl) => ({
      value: String(tpl.id),
      label: `${tpl.name} (${tpl.key})`,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (loading) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (loading) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>选择环境模板生成代码</DialogTitle>
          <DialogDescription>
            为当前用例选择一套预定义的运行环境配置（useTestCase
            参数）。如不选择，将使用默认占位配置。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            当前平台：{platform} · 驱动：
            {driver === 'android' ? 'Android' : driver === 'browser' ? 'Browser' : driver}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">环境模板</Label>
            <OptionsSelect<string>
              value={selectedId == null ? 'none' : selectedId === 'none' ? 'none' : String(selectedId)}
              items={templateOptions}
              onSelect={(item) => {
                if (item.value === 'none') {
                  onSelectTemplate('none');
                } else {
                  const n = Number(item.value);
                  onSelectTemplate(Number.isFinite(n) ? n : null);
                }
              }}
              disabled={loading}
              triggerClassName="text-xs"
            />
            {templates.length === 0 && !loading && (
              <p className="text-[11px] text-muted-foreground">
                当前平台尚未配置环境模板，将使用默认占位配置。
              </p>
            )}
            <button
              type="button"
              className="mt-1 text-[11px] text-blue-600 hover:underline"
              onClick={() => {
                if (loading) return;
                onOpenChange(false);
                onNavigateSettings();
              }}
            >
              在「环境模板管理」中配置更多模板…
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              if (loading) return;
              onOpenChange(false);
            }}
          >
            取消
          </Button>
          <Button type="button" disabled={loading || !caseId} onClick={onConfirm}>
            生成代码
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

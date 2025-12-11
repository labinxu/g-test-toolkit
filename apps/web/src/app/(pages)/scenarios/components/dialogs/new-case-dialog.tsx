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
import { Button } from '@/components/ui/button';
import type { CaseStatus } from '../../types';
import type { OptionsSelectItem } from '@/components/select/options-select';

export type NewCaseDialogProps = {
  open: boolean;
  platform: string;
  platforms: OptionsSelectItem<string>[];
  submenuItems: OptionsSelectItem<string>[];
  priorityItems: OptionsSelectItem<'P0' | 'P1' | 'P2'>[];
  statusItems: OptionsSelectItem<CaseStatus>[];
  newCaseCode: string;
  newCaseTitle: string;
  newCaseFeature: string;
  newCaseSubmenu: string | undefined;
  newCasePriority: 'P0' | 'P1' | 'P2';
  newCaseStatus: CaseStatus;
  newCaseDesc: string;
  newCaseAcceptance: string;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onPlatformChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onFeatureChange: (value: string) => void;
  onSubmenuChange: (value: string | undefined) => void;
  onPriorityChange: (value: 'P0' | 'P1' | 'P2') => void;
  onStatusChange: (value: CaseStatus) => void;
  onDescChange: (value: string) => void;
  onAcceptanceChange: (value: string) => void;
  onSubmit: () => void;
};

export function NewCaseDialog({
  open,
  platform,
  platforms,
  submenuItems,
  priorityItems,
  statusItems,
  newCaseCode,
  newCaseTitle,
  newCaseFeature,
  newCaseSubmenu,
  newCasePriority,
  newCaseStatus,
  newCaseDesc,
  newCaseAcceptance,
  submitting,
  onOpenChange,
  onPlatformChange,
  onCodeChange,
  onTitleChange,
  onFeatureChange,
  onSubmenuChange,
  onPriorityChange,
  onStatusChange,
  onDescChange,
  onAcceptanceChange,
  onSubmit,
}: NewCaseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新增用户场景</DialogTitle>
          <DialogDescription>
            填写基本信息和验收标准，创建一条新的用户场景。编号应保持唯一，例如 LS001 / US-0-host-1。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="nc-platform">平台</Label>
              <OptionsSelect
                id="nc-platform"
                value={platform}
                items={platforms.length ? platforms : [{ value: 'gettr-web', label: 'GETTR Web' }]}
                placeholder="选择平台"
                onSelect={(item) => onPlatformChange(item.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-code">用例编号</Label>
              <Input
                id="nc-code"
                value={newCaseCode}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder="例如：LS001 或 US-0-host-1"
                className="h-9"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="nc-title">标题</Label>
              <Input
                id="nc-title"
                value={newCaseTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="简要描述该用户场景，例如：主播从 Studio 发起直播"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-feature">模块 / Feature</Label>
              <Input
                id="nc-feature"
                value={newCaseFeature}
                onChange={(e) => onFeatureChange(e.target.value)}
                placeholder="例如：Live Stream / Login"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-submenu">子菜单 / Persona</Label>
              <OptionsSelect
                id="nc-submenu"
                value={newCaseSubmenu}
                items={submenuItems}
                placeholder="选择子菜单"
                onSelect={(item) => onSubmenuChange(item.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-priority">优先级</Label>
              <OptionsSelect<'P0' | 'P1' | 'P2'>
                id="nc-priority"
                value={newCasePriority}
                items={priorityItems}
                placeholder="选择优先级"
                onSelect={(item) => onPriorityChange(item.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-status">状态</Label>
              <OptionsSelect<CaseStatus>
                id="nc-status"
                value={newCaseStatus}
                items={statusItems}
                placeholder="选择状态"
                onSelect={(item) => onStatusChange(item.value as CaseStatus)}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nc-desc">用例说明信息</Label>
              <Textarea
                id="nc-desc"
                rows={3}
                value={newCaseDesc}
                onChange={(e) => onDescChange(e.target.value)}
                placeholder="可在此处补充从业务角度对该用户场景的说明、前置条件等。"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-acceptance">验收标准（Acceptance Criteria）</Label>
              <Textarea
                id="nc-acceptance"
                rows={3}
                value={newCaseAcceptance}
                onChange={(e) => onAcceptanceChange(e.target.value)}
                placeholder="例如：Given-When-Then 形式的关键验收条件。"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={submitting}>
              取消
            </Button>
          </DialogClose>
          <Button type="button" onClick={onSubmit} disabled={submitting}>
            {submitting && <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />}
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

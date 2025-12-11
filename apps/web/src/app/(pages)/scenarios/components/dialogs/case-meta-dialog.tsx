import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  OptionsSelect,
  type OptionsSelectItem,
} from '@/components/select/options-select';
import { OptionsSelectInput } from '@/components/select/options-select-input';
import { Button } from '@/components/ui/button';
import type { CaseStatus, UserScenarioSummary } from '../../types';

export type CaseMetaDialogProps = {
  open: boolean;
  selectedCase: UserScenarioSummary | null;
  platform: string;
  platforms: OptionsSelectItem<string>[];
  submenuItems: OptionsSelectItem<string>[];
  priorityItems: OptionsSelectItem<'P0' | 'P1' | 'P2'>[];
  moduleItems: OptionsSelectItem<string>[];
  statusItems: OptionsSelectItem<CaseStatus>[];
  editingTitle: string | null;
  editingSubmenu: string | null;
  editingPriority: string | null;
  editingModule: string | null;
  onOpenChange: (open: boolean) => void;
  onChangeTitle: (value: string) => void;
  onChangeSubmenu: (value: string) => void;
  onChangePriority: (value: string) => void;
  onChangeModule: (value: string) => void;
  onUpdateStatus: (status: CaseStatus) => void;
  onUpdatePlatform: (platform: string) => void;
  onSave: () => void | Promise<void>;
};

export function CaseMetaDialog({
  open,
  selectedCase,
  platform,
  platforms,
  submenuItems,
  priorityItems,
  moduleItems,
  statusItems,
  editingTitle,
  editingSubmenu,
  editingPriority,
  editingModule,
  onOpenChange,
  onChangeTitle,
  onChangeSubmenu,
  onChangePriority,
  onChangeModule,
  onUpdateStatus,
  onUpdatePlatform,
  onSave,
}: CaseMetaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑用例基本信息</DialogTitle>
          {selectedCase && (
            <DialogDescription>
              调整用例 {selectedCase.code} 的标题、模块、角色和优先级等信息。
            </DialogDescription>
          )}
        </DialogHeader>
        {!selectedCase ? (
          <p className="text-muted-foreground text-sm">
            请先在列表中选择一个用户场景。
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="md-title">标题</Label>
                <Input
                  id="md-title"
                  value={
                    editingTitle != null ? editingTitle : selectedCase.title || ''
                  }
                  onChange={(e) => onChangeTitle(e.target.value)}
                  placeholder="请输入用例标题"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="md-platform">平台</Label>
                <OptionsSelect
                  id="md-platform"
                  placeholder="选择平台"
                  value={selectedCase.platform || platform || 'gettr-web'}
                  items={
                    platforms.length
                      ? platforms
                      : [{ value: 'gettr-web', label: 'GETTR Web' }]
                  }
                  onSelect={(item) => onUpdatePlatform(item.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="md-submenu">子菜单 / 角色</Label>
                <OptionsSelectInput
                  id="md-submenu"
                  placeholder="输入或选择角色，例如 host / viewer"
                  value={
                    editingSubmenu != null
                      ? editingSubmenu
                      : (selectedCase.submenu as string) || ''
                  }
                  onChange={(val) => onChangeSubmenu(val)}
                  items={submenuItems}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="md-priority">优先级</Label>
                <OptionsSelectInput<'P0' | 'P1' | 'P2'>
                  id="md-priority"
                  placeholder="输入或选择优先级（P0 / P1 / P2）"
                  value={
                    editingPriority != null
                      ? editingPriority
                      : selectedCase.priority || ''
                  }
                  onChange={(val) => onChangePriority(val)}
                  items={priorityItems}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="md-module">业务模块</Label>
                <OptionsSelectInput
                  id="md-module"
                  placeholder="输入或选择业务模块，仅限字母和数字，例如 livestream"
                  value={
                    editingModule != null
                      ? editingModule
                      : (selectedCase.module as string) || 'live-stream'
                  }
                  onChange={(val) => onChangeModule(val)}
                  items={moduleItems}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="md-status">状态</Label>
                <OptionsSelect<CaseStatus>
                  id="md-status"
                  placeholder="选择状态"
                  value={selectedCase.status}
                  items={statusItems}
                  onSelect={(item) => onUpdateStatus(item.value as CaseStatus)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await onSave();
                  onOpenChange(false);
                }}
              >
                保存
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

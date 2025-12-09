'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

type NewSuiteDialogProps = {
  open: boolean;
  saving: boolean;
  name: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  onNameChange: (val: string) => void;
  onDescChange: (val: string) => void;
  onSubmit: () => void;
};

export function NewSuiteDialog({
  open,
  saving,
  name,
  description,
  onOpenChange,
  onNameChange,
  onDescChange,
  onSubmit,
}: NewSuiteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建测试套件</DialogTitle>
          <DialogDescription>
            为一组用例创建套件，复用共享前置步骤并生成单个文件。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="suite-name">套件名称</Label>
            <Input
              id="suite-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="例如：直播-主播端冒烟"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="suite-desc">套件描述（可选）</Label>
            <Textarea
              id="suite-desc"
              rows={3}
              value={description}
              onChange={(e) => onDescChange(e.target.value)}
              placeholder="说明套件覆盖范围、角色或环境要求，方便团队复用。"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              创建并保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

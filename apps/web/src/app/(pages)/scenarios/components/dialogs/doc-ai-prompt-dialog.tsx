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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export type DocAiPromptDialogProps = {
  open: boolean;
  promptText: string;
  onOpenChange: (open: boolean) => void;
  onPromptChange: (value: string) => void;
  onConfirm: () => void;
};

export function DocAiPromptDialog({
  open,
  promptText,
  onOpenChange,
  onPromptChange,
  onConfirm,
}: DocAiPromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>说明文档解析提示（可选）</DialogTitle>
          <DialogDescription>
            在上传说明文档/设计文档前，可在此补充给 AI 的解析说明，例如重点字段、命名规则或拆分粒度。不填写时将使用默认规则。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="doc-ai-hint">给 AI 的补充说明</Label>
          <Textarea
            id="doc-ai-hint"
            rows={6}
            value={promptText}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="例如：请优先复用文档中的用例编号作为 caseCode；没有编号时按模块 + 序号生成稳定 ID；测试步骤与预期结果使用 1./2. 的编号形式。"
          />
          <p className="text-muted-foreground mt-1 text-[11px]">
            提示仅影响本次上传，后续可在此调整；系统仍会自动应用 Livestream CSV 模板相关的默认规则。
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button type="button" onClick={onConfirm}>
            确定并选择文档
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

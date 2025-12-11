import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Loader2,
  Play,
  Radio,
  XCircle,
} from 'lucide-react';
import type { RunTask } from '../hooks/use-scenarios';

type RunLogDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: RunTask[];
  runningCaseId: number | null;
  logs: string[];
  onClearLogs: () => void;
  connected: boolean;
};

export function RunLogDrawer({
  open,
  onOpenChange,
  tasks,
  runningCaseId,
  logs,
  onClearLogs,
  connected,
}: RunLogDrawerProps) {
  const statusBadge = (status: RunTask['status']) => {
    if (status === 'running') {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          运行中
        </Badge>
      );
    }
    if (status === 'success') {
      return (
        <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          已完成
        </Badge>
      );
    }
    if (status === 'failed') {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          失败
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Play className="h-3 w-3" />
        等待
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[55vh] min-h-[360px]">
        <SheetHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex flex-col items-start gap-1">
            <SheetTitle className="flex items-center gap-2">
              运行日志
              <span
                className={cn(
                  'flex items-center gap-1 text-xs',
                  connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                )}
              >
                <Radio className={cn('h-3.5 w-3.5', connected ? 'animate-pulse' : 'opacity-50')} />
                {connected ? '已连接日志通道' : '未连接'}
              </span>
            </SheetTitle>
            <SheetDescription>顺序执行所选用例，并实时展示日志输出。</SheetDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onClearLogs}
            >
              清空日志
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-4 grid h-[calc(55vh-120px)] min-h-[240px] grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">运行队列</div>
              <div className="rounded-md border bg-muted/40 p-2">
                <ScrollArea className="h-[220px] pr-2">
                  <div className="space-y-2">
                    {tasks.length === 0 && (
                      <p className="text-muted-foreground text-sm">暂无待运行的用例</p>
                    )}
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          'rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition',
                          runningCaseId === task.id && 'border-primary shadow-primary/10',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium" title={task.title}>
                            {task.title}
                          </span>
                          {statusBadge(task.status)}
                        </div>
                        {task.error && (
                          <p className="text-destructive mt-1 text-[12px]">{task.error}</p>
                        )}
                        {task.filePath && (
                          <p className="text-[11px] text-muted-foreground break-all mt-1">
                            {task.filePath}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-8">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">实时日志</div>
            </div>
            <div className="mt-2 h-[calc(55vh-170px)] rounded-md border bg-background p-3">
              <ScrollArea className="h-full pr-3">
                <div className="space-y-1 font-mono text-xs leading-relaxed">
                  {logs.length === 0 && (
                    <p className="text-muted-foreground">等待日志输出…</p>
                  )}
                  {logs.map((line, idx) => (
                    <div key={`${idx}-${line.slice(0, 8)}`} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

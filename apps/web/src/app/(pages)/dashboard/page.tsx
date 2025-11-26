import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Activity, FileText, LayoutGrid, PlayCircle, SquarePen, TabletSmartphone, WorkflowIcon } from 'lucide-react'
import Link from 'next/link'

const mockMetrics = {
  testcasesTotal: 342,
  scenariosTotal: 58,
  last7dRuns: 24,
  lastRunPassRate: 0.87,
  lastRunFailed: 5,
  mappedRequirements: 132,
  totalRequirements: 180,
  onlineDevices: 3,
  totalDevices: 10,
}

const mockRecentRuns = [
  {
    id: 'run-20250301-001',
    time: '2025-03-01 10:20',
    type: '场景回归',
    owner: 'tester01',
    passRate: '91%',
    failed: 3,
  },
  {
    id: 'run-20250228-004',
    time: '2025-02-28 16:45',
    type: '接口回归（core-be）',
    owner: 'ci-bot',
    passRate: '100%',
    failed: 0,
  },
  {
    id: 'run-20250227-003',
    time: '2025-02-27 21:10',
    type: '脚本集执行',
    owner: 'tester02',
    passRate: '82%',
    failed: 7,
  },
]

const mockTodoItems = [
  {
    id: 'TC-1001',
    title: '直播间进入-观众侧首帧加载',
    type: 'TestCase',
    priority: 'P0',
    status: 'draft',
  },
  {
    id: 'SC-023',
    title: '直播推流异常自动重连场景',
    type: 'Scenario',
    priority: 'P1',
    status: 'in_progress',
  },
  {
    id: 'TC-0987',
    title: '通知消息多端一致性校验',
    type: 'TestCase',
    priority: 'P1',
    status: 'ready',
  },
]

const quickTools = [
  {
    href: '/tools/android-inspector',
    label: 'Android Inspector',
    description: '查看移动端页面结构并生成定位路径',
  },
  {
    href: '/tools/mobile-network',
    label: 'Mobile Network',
    description: '基于 mitmproxy 抓取移动网络流量',
  },
  {
    href: '/tools/live-push',
    label: 'Live Push',
    description: '推流/直播相关快速调试工具',
  },
  {
    href: '/tools/store-comments',
    label: 'Store Comments',
    description: '拉取应用商店评论用于分析',
  },
  {
    href: '/tools/curl-command',
    label: 'Curl Command',
    description: '生成和管理接口 curl 命令',
  },
  {
    href: '/tools/fast-user-db',
    label: 'Fast User Info',
    description: '快速查看和校验用户状态',
  },
]

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export default function DashBoard() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-4 lg:p-6 w-full">
      {/* 顶部欢迎 & 快捷入口 */}
      <section className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">测试工作台 Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            统一管理测试用例、场景、接口回归与移动实验室状态，从这里开始今天的测试工作。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/testcases">
              <SquarePen className="mr-2 h-4 w-4" />
              新建测试脚本
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/scenarios">
              <WorkflowIcon className="mr-2 h-4 w-4" />
              新建场景用例
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/api-tests/core-be">
              <PlayCircle className="mr-2 h-4 w-4" />
              运行接口回归
            </Link>
          </Button>
        </div>
      </section>

      {/* 顶部指标卡片 */}
      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              测试资产概览
            </CardTitle>
            <CardDescription>用例与场景整体规模</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-semibold">
                {mockMetrics.testcasesTotal}{' '}
                <span className="text-sm font-normal text-muted-foreground">脚本</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                场景用例 {mockMetrics.scenariosTotal} 个
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/testcases">前往用例库</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              最近执行健康度
            </CardTitle>
            <CardDescription>最近一次自动化执行结果</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">
                  {formatPercent(mockMetrics.lastRunPassRate)}
                </span>
                <Badge variant="outline" className="text-xs">
                  失败 {mockMetrics.lastRunFailed}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                近 7 天执行 {mockMetrics.last7dRuns} 次
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reports">查看报告</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Traceability 覆盖
            </CardTitle>
            <CardDescription>需求-测试关联情况</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-semibold">
                {mockMetrics.mappedRequirements}/{mockMetrics.totalRequirements}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">已建立映射的需求 / 总需求</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/traceability">管理映射</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              实验室状态
            </CardTitle>
            <CardDescription>设备与工具在线情况</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold">{mockMetrics.onlineDevices}</span>
                <span className="text-sm text-muted-foreground">
                  /{mockMetrics.totalDevices} 在线设备
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                mitmproxy / Frida 状态将在接入后端后展示
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/devices">
                <TabletSmartphone className="mr-1 h-4 w-4" />
                管理设备
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* 主体两列布局 */}
      <section className="grid gap-2 xl:grid-cols-3">
        {/* 左侧：两列宽 */}
        <div className="flex flex-col gap-2 xl:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" />
                    最近执行
                  </CardTitle>
                  <CardDescription>最近几次自动化执行的结果摘要</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/reports">查看全部报告</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">时间</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>触发人</TableHead>
                    <TableHead className="w-[120px]">通过率</TableHead>
                    <TableHead className="w-[80px] text-right">失败数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRecentRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="whitespace-nowrap text-xs">{run.time}</TableCell>
                      <TableCell className="text-xs">{run.type}</TableCell>
                      <TableCell className="text-xs">{run.owner}</TableCell>
                      <TableCell className="text-xs">{run.passRate}</TableCell>
                      <TableCell className="text-right text-xs font-medium text-destructive">
                        {run.failed}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" />
                    待处理用例 & 场景
                  </CardTitle>
                  <CardDescription>更高优先级但尚未完善或执行的资产</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/scenarios">前往场景与用例</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">编号</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead className="w-[80px]">类型</TableHead>
                    <TableHead className="w-[64px]">优先级</TableHead>
                    <TableHead className="w-[80px]">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTodoItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-medium">{item.id}</TableCell>
                      <TableCell className="max-w-[260px] text-xs">
                        <span className="line-clamp-1">{item.title}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.type}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline">{item.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="capitalize text-muted-foreground">{item.status}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：一列宽 */}
        <div className="flex flex-col gap-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">实验室 & 环境状态</CardTitle>
              <CardDescription>当前环境、设备与关键服务的概览</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">当前环境</span>
                <span>待接入 settings/parameters</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Appium / Device Hub</span>
                <span>状态信息后续由 /devices 聚合</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mitmproxy / Frida</span>
                <span>状态信息后续由 /tools/mobile-network 聚合</span>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <Link href="/devices">前往设备与实验室管理</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">常用工具快捷入口</CardTitle>
              <CardDescription>一键打开高频使用的测试工具</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {quickTools.map((tool) => (
                <Button
                  key={tool.href}
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-auto justify-start py-2"
                >
                  <Link
                    href={tool.href}
                    className="flex w-full flex-col items-start gap-1"
                  >
                    <span className="w-full truncate text-xs font-medium">
                      {tool.label}
                    </span>
                    <span className="w-full break-words text-[11px] text-muted-foreground line-clamp-2">
                      {tool.description}
                    </span>
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">使用提示 & 更新</CardTitle>
              <CardDescription>帮助新人快速上手，展示最近变更</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                · 如果你是第一次使用，请从 <strong>场景用例</strong> 开始梳理业务流，再生成自动化脚本。
              </p>
              <p>
                · 移动端相关调试建议结合 <strong>Devices</strong> 页面和{' '}
                <strong>Android Inspector / Mobile Network</strong> 联合使用。
              </p>
              <p>· 后续会在此展示版本更新、规范变更等公告信息。</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

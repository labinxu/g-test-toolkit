# Gettr Test Toolkit 前端 Dashboard 设计说明

> 版本：v1  
> 适用前端：`apps/web`（Next.js App Router）  
> 路由：`/dashboard`（主页面），`/` 重定向至 `/dashboard`

## 1. 角色与目标

Dashboard 的定位是 **测试资产与测试工具的一体化工作台首页**，接入现有的 Admin Panel 布局（Sidebar + Navbar + ContentLayout），为测试同学提供：

- 快速进入常用工作流（脚本、场景、接口回归、移动工具）。
- 一眼感知当前测试健康度（执行、Traceability 覆盖度）。
- 了解环境 / 设备 / 工具整体状态（移动实验室）。
- 为新同学提供“从哪里开始”的指引。

同时，它是未来接入更多统计和趋势图表的承载页面。

## 2. 页面结构概览

Dashboard 位于：

- 页面组件：`apps/web/src/app/(pages)/dashboard/page.tsx`
- 根路由入口重定向：
  - `apps/web/src/app/page.tsx`：使用 `redirect('/dashboard')`

布局结构（自上而下）：

1. **顶部欢迎 & 快捷操作区**
2. **关键指标卡片区（4 个 Card）**
3. **主体两列布局**
   - 左侧（2 列宽）：最近执行 / 待处理用例与场景
   - 右侧（1 列宽）：实验室 & 环境状态 / 常用工具入口 / 使用提示

Dashboard 嵌在现有的：

- 左侧 Sidebar：`apps/web/src/components/admin-panel/sidebar.tsx`
- 顶部 Navbar：`apps/web/src/components/admin-panel/navbar.tsx`
- 内容布局：`apps/web/src/components/admin-panel/content-layout.tsx`
- Admin 布局：`apps/web/src/components/admin-panel/admin-panel-layout.tsx`
- `(pages)` 共享布局：`apps/web/src/app/(pages)/layout.tsx`

## 3. 详细模块设计

### 3.1 顶部欢迎 & 快捷操作区

**位置**

- `Dashboard` 页面顶部 `<section>`。

**内容与交互**

- 左侧：
  - 标题：`测试工作台 Dashboard`
  - 图标：`LayoutGrid`（lucide-react）
  - 一行描述文案：
    - “统一管理测试用例、场景、接口回归与移动实验室状态，从这里开始今天的测试工作。”

- 右侧：三个主要快速操作按钮（Button as Link）：
  1. “新建测试脚本”
     - 图标：`SquarePen`
     - 跳转：`/testcases`
  2. “新建场景用例”
     - 图标：`WorkflowIcon`（lucide-react）
     - 跳转：`/scenarios`
  3. “运行接口回归”
     - 图标：`PlayCircle`
     - 跳转：`/api-tests/core-be`

**备注**

- 目前为静态跳转，后续可增加：
  - 打开时自动弹出“新建用例”弹窗；
  - 接口模块下拉选择（core-be / notif 等）。

### 3.2 指标卡片区（4 卡）

使用 `grid gap-4 md:grid-cols-2 xl:grid-cols-4` 布局，每个卡片使用 `Card` 组件。

当前全部为 mock 数据，集中定义在 `mockMetrics` 常量中，后续可替换为实际聚合 API。

#### 卡片 A：测试资产概览

- 标题：`测试资产概览`
- 描述：`用例与场景整体规模`
- 主指标：
  - 脚本用例总数：`testcasesTotal`
  - 场景用例总数：`scenariosTotal`
- 右侧按钮：
  - 文案：`前往用例库`
  - 跳转：`/testcases`

**后端数据建议**

- 来源：Testcases + Scenarios 聚合 API。
- 字段：
  - `testcasesTotal`
  - `scenariosTotal`

#### 卡片 B：最近执行健康度

- 标题：`最近执行健康度`
- 描述：`最近一次自动化执行结果`
- 主指标：
  - 最近一次执行通过率：`lastRunPassRate`（例如 0.87 → `87%`）
  - 最近一次失败用例数：`lastRunFailed`
  - 辅助信息：`近 7 天执行 {last7dRuns} 次`
- 右侧按钮：
  - 文案：`查看报告`
  - 跳转：`/reports`

**后端数据建议**

- 聚合数据来自报告模块：
  - `lastRunPassRate`
  - `lastRunFailed`
  - `last7dRuns`

#### 卡片 C：Traceability 覆盖

- 标题：`Traceability 覆盖`
- 描述：`需求-测试关联情况`
- 主指标：
  - `mappedRequirements / totalRequirements`
  - 辅助信息：`已建立映射的需求 / 总需求`
- 右侧按钮：
  - 文案：`管理映射`
  - 跳转：`/traceability`

**后端数据建议**

- 来源：Traceability 模块聚合接口。
  - `mappedRequirements`
  - `totalRequirements`

#### 卡片 D：实验室状态

- 标题：`实验室状态`
- 描述：`设备与工具在线情况`
- 主指标：
  - 在线设备数：`onlineDevices`
  - 总设备数：`totalDevices`
- 辅助信息：
  - Placeholder 文案：`mitmproxy / Frida 状态将在接入后端后展示`
- 右侧按钮：
  - 图标：`TabletSmartphone`
  - 文案：`管理设备`
  - 跳转：`/devices`

**后端数据建议**

- 汇总自：
  - `/devices` 模块：在线设备数、模拟器状态、Appium 状态。
  - `/tools/mobile-network` 模块：mitmproxy / Frida 状态。

### 3.3 主体两列布局

使用 `grid gap-4 xl:grid-cols-3`：

- 左侧：`xl:col-span-2`（两列宽）
- 右侧：一列宽

#### 3.3.1 左侧：最近执行

**模块：最近执行**

- 使用 `Card` + `Table`。
- 标题区：
  - 标题：`最近执行`
  - 图标：`Activity`
  - 描述：`最近几次自动化执行的结果摘要`
  - 右上角按钮：`查看全部报告` → `/reports`

- 表格列：
  - 时间（`time`）
  - 类型（`type`：场景回归 / 接口回归 / 脚本集等）
  - 触发人（`owner`：tester / ci-bot）
  - 通过率（`passRate`）
  - 失败数（`failed`）

- 数据源：
  - 目前使用 `mockRecentRuns` 静态数组。
  - 后续可对接报告模块的 `/reports/summary` 之类接口。

#### 3.3.2 左侧：待处理用例 & 场景

**模块：待处理用例 & 场景**

- 标题区：
  - 标题：`待处理用例 & 场景`
  - 图标：`FileText`
  - 描述：`更高优先级但尚未完善或执行的资产`
  - 右上角按钮：`前往场景与用例` → `/scenarios`（后续可增加 Tab 分场景/脚本）

- 表格列：
  - 编号（`id`，如 `TC-1001` / `SC-023`）
  - 标题（`title`，单行省略）
  - 类型（`type`：TestCase / Scenario）
  - 优先级（`priority`：P0 / P1 / P2，使用 `Badge`）
  - 状态（`status`：draft / in_progress / ready 等）

- 数据源：
  - 当前使用 `mockTodoItems` 静态数组。
  - 后续可由：
    - Scenarios API：过滤 `draft` / `in_progress` 且优先级为 P0/P1。
    - Testcases Meta API：筛选尚未生成代码或未覆盖的用例。

### 3.4 右侧：状态与工具

#### 3.4.1 实验室 & 环境状态

**目标**

- 汇总 `Settings/Parameters`、`Devices`、`Tools/Mobile Network` 的关键信息，以只读摘要形式展示。

**当前内容（占位说明）**

- 行 1：当前环境
  - 左：`当前环境`
  - 右：`待接入 settings/parameters`
- 行 2：Appium / Device Hub
  - 左：`Appium / Device Hub`
  - 右：`状态信息后续由 /devices 聚合`
- 行 3：Mitmproxy / Frida
  - 左：`Mitmproxy / Frida`
  - 右：`状态信息后续由 /tools/mobile-network 聚合`
- 底部按钮：`前往设备与实验室管理` → `/devices`

**后端集成建议**

- 新增聚合 API（例如 `/api/dashboard/lab-status`）返回：
  - 当前环境标识 & 基础 URL（读自 `settings/parameters`）
  - Appium 服务状态（`running/failed/stopped`）
  - 在线设备数 / 总数概况（可复用 `devices` 页面使用的接口）
  - mitmproxy / Frida 的当前状态（复用 `mobile-network` 使用的接口）

#### 3.4.2 常用工具快捷入口

**目标**

- 为高频访问的工具提供显眼入口，降低新人学习成本。

**内容**

- 使用 `Card` + `Button asChild` + `Link`，两列网格布局：
  - 每个按钮包含：
    - 名称（如 `Android Inspector`）
    - 1~2 行简短描述

- 当前工具列表（`quickTools`）：
  1. `/tools/android-inspector` – 查看移动端页面结构并生成定位路径
  2. `/tools/mobile-network` – 基于 mitmproxy 抓取移动网络流量
  3. `/tools/live-push` – 推流/直播相关快速调试工具
  4. `/tools/store-comments` – 拉取应用商店评论用于分析
  5. `/tools/curl-command` – 生成和管理接口 curl 命令
  6. `/tools/fast-user-db` – 快速查看和校验用户状态

**扩展方向**

- 后续可由后端或配置决定展示哪些工具（按使用频次排序）。
- 可结合权限控制，隐藏不适用的工具。

#### 3.4.3 使用提示 & 更新

**目标**

- 为新用户提供“从哪里开始”的指引，同时展示简单的变更信息。

**当前内容**

- 三条文案建议：
  - 从场景用例入手（先梳理业务流，再生成脚本）。
  - 移动端调试时联合 Devices + Android Inspector + Mobile Network 使用。
  - 后续会在此展示版本更新与规范变更。

**扩展方向**

- 后续可接入：
  - 版本发布记录（来自 `docs/traceability` 或 release 说明）。
  - 团队内部规范链接。

## 4. 路由与导航关系

### 4.1 主导航

- 侧边栏 `Dashboard` 菜单：
  - 定义于：`apps/web/src/lib/menu-list.ts`
  - `href: '/dashboard'`，图标 `LayoutGrid`

- 根路由：
  - `apps/web/src/app/page.tsx` 使用：
    - `import { redirect } from 'next/navigation'`
    - `redirect('/dashboard')`
  - 确保用户访问 `/` 或成功登录后，可统一落到 `/dashboard`。

### 4.2 与其他模块的关系

Dashboard 中的所有按钮 / 链接只做导航，不承担真实业务操作：

- 用例 & 场景：
  - `/testcases` – 脚本与目录树编辑器
  - `/testcases/libs` – 公共库、路由配置
  - `/scenarios` – 场景用例管理
  - `/traceability` – 需求映射
  - `/reports` – 执行报告

- 接口回归：
  - `/api-tests/core-be`
  - `/api-tests/notif`

- 移动实验室 / 工具：
  - `/devices`
  - `/tools/android-inspector`
  - `/tools/mobile-network`
  - 以及其他 `Tools` 子页面。

## 5. 实现与后续集成建议

### 5.1 当前实现要点

- 使用已有 UI 组件：
  - `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`
  - `Button`, `Badge`
  - `Table`, `TableHead`, `TableRow`, `TableCell`
  - `Link` from `next/link`
  - 图标使用 `lucide-react`
- 所有业务数据：
  - `mockMetrics`, `mockRecentRuns`, `mockTodoItems`, `quickTools`
  - 统一定义在 `dashboard/page.tsx` 顶部作为临时占位。

### 5.2 后续落地步骤建议

1. **设计 Dashboard 聚合 API**
   - `GET /api/dashboard/summary`：
     - 汇总：`mockMetrics` 相关字段。
   - `GET /api/dashboard/recent-runs`：
     - 填充 `mockRecentRuns` 表格。
   - `GET /api/dashboard/todo-items`：
     - 从 Scenarios / Testcases 的状态与优先级中筛选数据。
   - `GET /api/dashboard/lab-status`：
     - 汇总 Devices + Mobile Network 模块的状态。

2. **前端接入数据**
   - 在 Dashboard 中引入 React Query / fetch，替换 mock。
   - 增加 Loading 状态（Skeleton / Spinner）。
   - 错误展示统一复用现有 toast / Alert 组件。

3. **交互优化**
   - 快捷按钮根据权限 / 角色配置显示。
   - “待处理用例 & 场景”表格支持：
     - 点击行直接跳转到具体用例或场景详情。
     - 按“只看我的”、“只看 P0”过滤。

4. **视觉增强（可选）**
   - 接入图表（如 Recharts / ECharts）呈现：
     - 最近 N 天执行趋势。
     - 模块维度的通过率热力图。

## 6. 总结

本 Dashboard 设计以“尽量复用现有模块 + 快速落地骨架”为目标，当前实现：

- 提供统一入口与全局视角，让测试同学每天打开就是这个页面。
- 把复杂的测试资产（脚本、场景、接口、Traceability）通过指标和列表串联起来。
- 为移动实验室场景预留了状态汇总区域。

后续工作重点在于：

- 后端聚合 API 设计与接入；
- 根据真实使用反馈迭代指标和入口优先级；
- 按角色权限动态调整 Dashboard 上展示的模块。 


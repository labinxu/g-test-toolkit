# Livestream 用例 CSV 导入说明

> 适用模块：`apps/api/src/user-scenarios`  
> 场景：从外部维护的直播测试计划 / 用例表，批量同步到「用户场景用例」模块

## 1. 文件位置与入口

- 默认文件路径（后端进程为 `g-test-toolkit/apps/api` 时）：
  - `../gettr-wks/livestream-user-case/livestream-testcases.csv`
- 也可以通过环境变量覆盖：
  - `LIVE_STREAM_CSV_PATH=/absolute/or/relative/path/to/your.csv`
- 后端入口：
  - `UserScenariosService.syncFromCsv()` / `syncFromCsvContent()`  
  - 实现位置：`apps/api/src/user-scenarios/user-scenarios.service.ts`

## 2. CSV 表头约定

基础表头（推荐，用于直播域 API / Web 用例）：

- `用例ID`（必填）
- `模块ID`
- `模块名称`（或别名：`模块`）
- `平台`
- `检查点描述`

可选扩展列（可按平台选择性使用）：

- 需求&验收：
  - `UserStory` / `User Story` / `用户故事`
  - `AcceptanceCriteria` / `Acceptance Criteria` / `验收标准`
- 测试过程：
  - `前置条件` / `前提条件` / `Precondition` / `Preconditions`
  - `测试步骤` / `TestSteps` / `Test Steps` / `Steps`
  - `预期结果` / `ExpectedResult` / `Expected Result` / `Expected`

> 说明：额外列会被自动忽略，不会影响导入；缺失的列会按下述映射规则退化处理。

## 3. 字段映射规则

以 `UserScenario` 实体为目标（`apps/api/src/user-scenarios/entities/user-scenario.entity.ts`）：

- `用例ID` → `code`（必需；为空则跳过当前行）
- `模块ID` → `csvId`
  - `模块名称` / `模块` → `feature`
  - `平台` → 作为平台 key，参与生成 `submenu`，并影响后续代码生成与运行：
    - Web 自动化：`gettr-web` / `gettr-mobile-web` / `gettr-android` / `gettr-ios` 等；
    - API 用例：推荐使用形如 `<product>-api-<module>` 的命名约定，例如：
      - `gettr-api-livestream`（直播域 API）
      - `gettr-api-corebe`（CoreBe 域 API）
      - 其它项目可按相同模式自定义（如 `foo-api-orders`）；凡平台字段包含 `-api-` 的用例，代码生成将按“API 平台”处理（使用 useTestCase + fetch，不启动浏览器/Android）。
- 文本描述：
  - `UserStory` + `检查点描述` → 基础描述块
  - `前置条件` → 追加为 `【前置条件】\n...`
  - `测试步骤` → 追加为 `【测试步骤】\n...`
  - 最终写入：`UserScenario.description`
- 验收标准：
  - 优先使用 `AcceptanceCriteria / 验收标准` 列
  - 若为空，则退化为使用整列 `预期结果`
  - 写入：`UserScenario.acceptanceCriteria`
- 其他元信息：
  - `module` 固定为 `'live-stream'`
  - `priority` 默认 `'P1'`
  - `status` 初始为 `'draft'`，若生成了步骤则会推进到 `'in_progress'`

旧数据兼容：

- 若 CSV 中没有任何扩展列（只含基础表头），行为与旧实现一致：
  - `description` 只包含 UserStory + 检查点描述
  - 不会生成任何步骤行

## 4. 测试步骤 → UserScenarioStep 生成规则

当且仅当当前行存在非空「测试步骤」列时，会为该用例自动生成结构化步骤（`UserScenarioStep`）：

- 文本拆分
  - `测试步骤` 与 `预期结果` 都会按以下方式拆分为多个段落：
    - 分隔符：换行、`；`、`;`
    - 自动去掉前缀序号：`1. xxx` / `1) xxx` / `1）xxx`
  - 示例：
    - `1. 打开直播页面；2. 点击开始直播`  
      → `["打开直播页面", "点击开始直播"]`
- 步骤配对
  - 按索引一一对应：
    - 第 1 段步骤 ↔ 第 1 段预期
    - 第 2 段步骤 ↔ 第 2 段预期
    - ...
  - 步骤比预期多：多出来的步骤会给一个默认的 expected 文案（提示在系统中补充）。
  - 预期比步骤多：复用第 1 条步骤文案作为 action，避免信息丢失。
- 前置条件挂载
  - 若存在 `前置条件` 列，其内容会挂到第一个步骤的 `data` 字段：
    - `UserScenarioStep.data = 前置条件文本`
- 步骤写入策略
  - 每次导入、且该行「测试步骤」非空时：
    - 先删除该用例现有的所有步骤
    - 再用 CSV 解析出的步骤覆盖
  - 若该行「测试步骤」为空：
    - 不会改动已有步骤（方便在系统 UI 中手工维护）
  - 若用例原本为 `draft`，且成功生成了至少一条步骤：
    - 状态会自动更新为 `in_progress`

## 5. 与现有 zh-CN 测试计划的对应关系

示例文件：`../gettr-wks/livestream-user-case/zh-CN/livestream_test_plan.csv`

表头：

- `用例ID, 模块, 用例标题, 前置条件, 测试步骤, 预期结果`

在当前实现下，其映射关系为：

- `用例ID` → `code`
- `模块` → `feature`（作为模块名称使用）
- `前置条件` → `description` 中的 `【前置条件】` 块 + 第一个步骤的 `data`
- `测试步骤` → `description` 中的 `【测试步骤】` 块 + 结构化步骤的 `action`
- `预期结果` → 若未提供单独的 `AcceptanceCriteria` 列，则作为整体验收标准写入 `acceptanceCriteria`，同时按 1/2/3… 拆分后映射为各步骤的 `expected`

> 建议：后续维护时，优先在「测试步骤」中同时写出“操作 + 检查点”，`预期结果` 用来补充关键断言或整体期望；对于没有明确步骤的高层用例，可以只写 UserStory/验收标准，然后在系统中手工补步骤。

## 6. 使用建议

- 作为导入规范：
  - 推荐把现有直播用例表维护为本说明的 CSV 超集格式（包含上面提到的所有列），然后通过「导入直播用例」按钮/接口定期同步。
- 作为协作约定：
  - 测试同学主要编辑 CSV 中的：
    - `UserStory / 用户故事`
    - `前置条件`
    - `测试步骤`
    - `预期结果 / 验收标准`
  - 自动化同学：
    - UI 场景：在系统中基于生成的 `UserScenarioStep` 和 `acceptanceCriteria` 继续补充 binding 与代码生成；
    - API 场景（平台名中包含 `-api-`，例如 `gettr-api-livestream` / `gettr-api-corebe` 等）：
      - 使用「生成代码」在 `workspace/users/<user>/cases/<platform>/...` 下生成基于 `useTestCase` + `fetch` 的 API 测试骨架（平台名中包含 `-api-` 即视为 API 平台）；
      - 在「用例库 / Testcases」页面运行前，可为该平台 + 驱动 `other` 配置一套或多套环境模板（`/settings/env-templates`），其 `config` JSON 会与全局 `apiTestConfig`（Settings → Parameters → API Tests）合并，用于覆盖 `baseUrl` / `defaultHeaders` / `sampleLivePostId` 等字段；
      - 将自动生成的步骤注释逐步替换为真实接口调用与断言。

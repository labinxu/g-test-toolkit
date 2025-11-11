# 需求接入指南：用户关注 + 发帖通知（Follow → Post Notification）

本指南说明如何将“用户A关注用户B；用户B发帖后，用户A收到通知”的需求，接入现有 Traceability（需求 ⇄ 测试 映射）工作流，并提供可落地的测试标注与导出方法。

- 适用范围：本仓库内 Traceability 页面（Next.js 前端）与 API（NestJS）内置的映射/导出能力。
- 关键点：使用测试报告中的 REQ 标签自动建议映射；或在页面手动建立需求与测试映射。

## 1. 需求条目

- Key（建议与需求系统一致）：例如 `feat-proj-0001`（本功能）或 `PROJ-1234`
- System：`jira`（默认），也可用 `testrail`/`other`
- Title：用户关注 + 发帖通知
- URL（可选）：对应需求/Jira 的链接

在 Traceability 页面可以一次性录入多个 Key；也可通过 API 录入（见附录）。

## 2. 验收标准（示例）

- A 可以关注 B；A 取关后不再收到 B 的发帖通知。
- B 发布公开帖后，A 在通知中心看到一条“B 发帖”的新通知。
- A 的通知偏好中关闭“关注的人发帖”后，不再收到该类型通知；打开后恢复。
- B 发帖后通知去重（同一帖不产生重复通知）；撤回/删除帖后通知按产品规则处理（可选）。
- 被 A 拉黑的用户不触发通知（或按隐私策略处理）。
- 极端场景：高并发发帖、A 关注大量用户时的速率限制与稳定性。

建议将上述条目拆分为可验证的测试用例，并为每个用例加上相同的需求 Key 标签（见第 3 节）。

## 3. 测试标注规范（REQ 标签）

Traceability 的“建议映射”会从最新测试报告 JSON 中读取 `cases[].metadata.tags`，自动识别形如 `REQ:<SYSTEM>:<KEY>` 的标签并生成建议。

- 标签格式：`REQ:PRD:feat-proj-0001`（本功能）或 `REQ:JIRA:PROJ-1234`
- 多标签：同一个测试可对应多个需求 Key。
- 元数据来源：测试框架会把标签写入报告的 `metadata.tags: string[]`。

示例做法（任选其一，按你们的测试基建实际情况）：

- 在装饰器中传入 tags（若支持）：

  ```ts
  @Test({ module: 'notification', tags: ['REQ:PRD:feat-proj-0001'] })
  ```

- 在用例运行期写入元数据（若暴露了 API，如 `this.meta`/`this.addTag`）：

  ```ts
  this.meta({ tags: ['REQ:PRD:feat-proj-0001'] })
  // 或 this.addTag('REQ:PRD:feat-proj-0001')
  ```

- BDD/Describe 体系：在 Suite/Case 层写入标签，并确保最终进入报告的 `metadata.tags`。

报告中期望出现如下结构（节选）：

```json
{
  "cases": [
    {
      "name": "Follow → Post notification happy path",
      "status": "passed",
      "metadata": {
        "suitePath": ["Notification", "Follow"],
        "tags": ["REQ:PRD:feat-proj-0001"]
      }
    }
  ]
}
```

## 4. Traceability 页面操作步骤

1) 选择用户目录：进入“需求 ⇄ 测试 映射”页面，选择你运行测试的用户目录（例如 `labin`）。

2) 录入需求：在“需求与映射”卡片左侧输入需求 Key（可多行/逗号分隔，例如 `PROJ-1234, PROJ-5678`），点击“保存需求”。

3) 自动建议（推荐）：点击“查看建议映射”。若你的报告中包含 `REQ:*:*` 标签，将看到建议数量提示；点击“一键应用建议”即可批量建立映射。

4) 手动建映射（备选）：在右侧“测试列表”勾选对应用例，点击“保存映射（N）”，即可把这些测试与左侧输入的需求 Key 建立映射。

5) 导出：
- TestRail CSV：可选择“Section/Template/Type/Priority”等选项，点击“导出 TestRail CSV”。
- Xray JSON：输入项目 Key（如 `PROJ`）与标签（可用于 Xray 的 labels），点击“导出 Xray JSON”。
- 也支持“仅导出当前筛选”两种格式，便于增量同步。

备注：页面还提供了“删除映射”“导出映射 CSV”等维护操作。

## 5. 测试建议（覆盖面）

- 关注/取关：A 关注/取关 B 场景的通知有无。
- 通知偏好：开/关“关注的人发帖”开关的正反向验证。
- 内容类型：文本、图片、视频、转发等对通知触发的影响（按产品策略）。
- 权限/隐私：被拉黑、私密账号、受限内容的处理。
- 去重/一致性：重复发帖、撤回、删除、并发触发与幂等。
- 端到端 UI：A 登录后在通知中心可见对应提示；标记已读等行为可选。

为以上用例统一加入同一个需求 Key 标签，借助“建议映射”可快速同步映射关系。

## 6. 示例测试骨架（可按需放入你的用户目录）

以下仅为示意，真实登录与页面对象请替换为你们的实现：

```ts
import { TestCase, Test, withBrowser, useBrowser } from 'core-lib'
import { HomePage } from 'gettr-lib'

@Test({ module: 'notification', tags: ['REQ:JIRA:PROJ-1234'] })
@withBrowser({ headless: true, debug: false, domain: 'https://your-env.example.com' })
export class FollowNotifyE2E extends TestCase {
  private home!: HomePage

  async tearUp() {
    this.home = new HomePage(this)
    const loginA = await this.home.gotoLoginPage()
    await loginA.loginWithPassword('userA@example.com', '***')
    // 可在此写入额外元数据
    this.meta?.({ tags: ['REQ:JIRA:PROJ-1234'] })
  }

  async test_follow_and_receive_post_notification() {
    // 1) A 关注 B
    // 2) 切换为 B 发帖（或通过 API 触发）
    // 3) 回到 A，检查通知中心存在“B 发帖”的新通知
    // 断言：通知文案/时间/去重等
  }
}
```

## 7. 持续维护

- 新增/修改用例时，务必带上稳定的 REQ 标签，确保建议映射可持续工作。
- 当需求 Key 变更或拆分时，可在页面批量调整映射；导出时支持按 Key/测试过滤。
- 建议把关键用例纳入冒烟集，稳定产出报告，利于 Traceability 自动建议。

---

## 附录：相关 API（可脚本化）

- 录入需求：`POST /traceability/requirements`，Body: `{ items: [{ key, system?, title?, url? }] }`
- 列出需求：`GET /traceability/requirements`
- 保存映射：`POST /traceability/mappings`，Body: `{ mappings: [{ requirementKey, testId, linkType?, note? }] }`
- 列出映射：`GET /traceability/mappings`
- 自动建议：`GET /traceability/suggest?user=<user>`
- 一键应用：`POST /traceability/apply-suggestions`，Body: `{ user }`
- 导出：`POST /traceability/export`（`format: 'testrail-cases' | 'xray'` 等）

示例（curl）：

```bash
curl -X POST "$API/traceability/requirements" \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"key":"PROJ-1234","system":"jira","title":"Follow + Post Notification"}]}'

curl -X GET "$API/traceability/suggest?user=labin"

curl -X POST "$API/traceability/apply-suggestions" \
  -H 'Content-Type: application/json' \
  -d '{"user":"labin"}'
```

# 需求接入模板（Traceability）

> 用于快速将单一功能/需求接入 Traceability 工作流。复制本模板并替换 TODO 部分。

## 1. 背景

- 功能名称：TODO（如：用户关注 + 发帖通知）
- 需求 Key：TODO（如：`PROJ-1234` 或 `REQ-XXXX`）
- 需求系统：jira | testrail | other（缺省 `jira`）
- 需求链接：TODO（可选）

## 2. 验收标准（示例）

- [ ] TODO：明确的用户视角 + 验证点
- [ ] TODO：开关/权限/异常等边界行为
- [ ] TODO：并发/去重/一致性

## 3. 测试标注（REQ 标签）

- 统一标签：`REQ:<SYSTEM>:<KEY>`，例如 `REQ:JIRA:PROJ-1234`
- 建议在每个相关测试用例中写入相同标签，便于“建议映射”统一识别。
- 可选写法：

```ts
@Test({ module: 'TODO', tags: ['REQ:JIRA:PROJ-1234'] })
// 或 this.meta?.({ tags: ['REQ:JIRA:PROJ-1234'] })
```

报告示意：

```json
{
  "cases": [
    {
      "name": "TODO",
      "metadata": { "tags": ["REQ:JIRA:PROJ-1234"] }
    }
  ]
}
```

## 4. Traceability 页面操作

1) 选择用户目录（你的测试报告所在目录）。
2) 输入需求 Key（可多条），点击“保存需求”。
3) 点击“查看建议映射”→“一键应用建议”（推荐）。
4) 或手动：勾选测试 → “保存映射（N）”。
5) 导出：TestRail CSV / Xray JSON（可使用“仅导出当前筛选”）。

## 5. 测试覆盖建议

- [ ] 主流程（Happy Path）
- [ ] 负向与边界：权限、隐私、异常
- [ ] 配置/开关：开/关对行为的影响
- [ ] 去重/幂等/并发
- [ ] UI 与可观测性（日志、事件、指标）

## 6. 示例用例骨架

```ts
import { TestCase, Test, withBrowser } from 'core-lib'

@Test({ module: 'TODO', tags: ['REQ:JIRA:PROJ-1234'] })
@withBrowser({ headless: true, debug: false, domain: 'https://env.example.com' })
export class FeatureE2E extends TestCase {
  async test_something() {
    // TODO: 步骤 + 断言
  }
}
```

## 7. API 速查

- POST `/traceability/requirements`
- GET `/traceability/requirements`
- POST `/traceability/mappings`
- GET `/traceability/mappings`
- GET `/traceability/suggest?user=<user>`
- POST `/traceability/apply-suggestions`
- POST `/traceability/export`（`testrail-cases` | `xray`）

## 8. 维护建议

- 新增用例请同步贴好 REQ 标签；
- 需求 Key 变更时统一调整映射；
- 将关键用例纳入冒烟，保持建议映射可用。


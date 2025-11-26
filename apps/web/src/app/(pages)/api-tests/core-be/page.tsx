'use client';

import { ApiTestsWorkbench } from '@/components/api-tests/api-tests-workbench';

export default function CoreBeApiTestsPage() {
  return (
    <ApiTestsWorkbench
      moduleId="corebe"
      schemaApiPath="/api/api-tests/core-be/schema"
      runApiPath="/api/api-tests/core-be/run"
      title="Core-be 接口回归测试"
      description="为 corebe 模块配置多个环境（Base URL + Headers），在此按接口维度覆盖参数与边界值，并单次或批量执行。"
    />
  );
}


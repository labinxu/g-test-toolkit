'use client';

import { ApiTestsWorkbench } from '@/components/api-tests/api-tests-workbench';

export default function NotifApiTestsPage() {
  return (
    <ApiTestsWorkbench
      moduleId="notif"
      schemaApiPath="/api/api-tests/notif/schema"
      runApiPath="/api/api-tests/notif/run"
      title="Notif 接口回归测试"
      description="为 notif 模块配置多个环境（Base URL + Headers），在此按接口维度覆盖参数与边界值，并单次或批量执行。"
    />
  );
}


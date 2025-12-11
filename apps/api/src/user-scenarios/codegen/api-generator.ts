type ApiStep = {
  order: number;
  action: string;
  expected: string;
  data?: string;
};

export function parseApiStepData(raw: string | null | undefined) {
  const result: { method: string; path: string; body: string } = {
    method: 'GET',
    path: '',
    body: '',
  };
  const text = (raw || '').toString();
  if (text.trim()) {
    for (const part of text.split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const eqIdx = seg.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = seg.slice(0, eqIdx).trim().toLowerCase();
      const value = seg.slice(eqIdx + 1).trim();
      if (key === 'method' && value) {
        result.method = value.toUpperCase();
      } else if (key === 'path') {
        result.path = value;
      } else if (key === 'body' || key === 'payload') {
        result.body = value;
      }
    }
  }
  return result;
}

export function buildApiStepLines(step: ApiStep, resVarPrefix = 'res') {
  const lines: string[] = [];
  const actionText = (step.action || '').replace(/\r?\n/g, ' ');
  const expectedText = (step.expected || '').replace(/\r?\n/g, ' ');
  const dataText = (step.data || '').replace(/\r?\n/g, ' ');
  lines.push(`    // Step ${step.order}: ${actionText}`);
  if (dataText) lines.push(`    //   Data / Precondition: ${dataText}`);
  if (expectedText) lines.push(`    //   Expected: ${expectedText}`);
  const parsed = parseApiStepData(step.data);
  const method = (parsed.method || 'GET').toUpperCase();
  const pathValue = parsed.path;
  const bodyValue = parsed.body;
  if (!pathValue) {
    lines.push(
      `    // TODO: 本步骤尚未配置 path=...，请在「步骤与检查点」中补充 API 路径后，在此处实现调用。`,
      '',
    );
    return lines;
  }
  const resVar = `${resVarPrefix}${step.order}`;
  const methodLit = JSON.stringify(method);
  const pathLit = JSON.stringify(pathValue);
  if (method === 'GET' || method === 'DELETE') {
    lines.push(
      `    // AUTO-GEN: API 调用骨架（${method} ${pathValue}）`,
      `    const ${resVar} = await apiRequest(${pathLit}, { method: ${methodLit} });`,
      `    tc.assertEqual(200, ${resVar}.status, 'HTTP ${method} ${pathValue} 返回 200');`,
      `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
      '',
    );
  } else if (method === 'POST') {
    if (bodyValue) {
      const bodyComment = bodyValue.replace(/\r?\n/g, ' ');
      lines.push(
        `    // AUTO-GEN: API 调用骨架（POST ${pathValue}）`,
        `    //   Body: ${bodyComment}`,
        `    const ${resVar} = await apiPost(${pathLit}); // TODO: 将上面的 Body 填入 apiPost 第二个参数`,
        `    tc.assertEqual(200, ${resVar}.status, 'HTTP POST ${pathValue} 返回 200');`,
        `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
        '',
      );
    } else {
      lines.push(
        `    // AUTO-GEN: API 调用骨架（POST ${pathValue}）`,
        `    const ${resVar} = await apiPost(${pathLit}); // TODO: 传入请求 body（如有需要）`,
        `    tc.assertEqual(200, ${resVar}.status, 'HTTP POST ${pathValue} 返回 200');`,
        `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
        '',
      );
    }
  } else {
    lines.push(
      `    // AUTO-GEN: API 调用骨架（${method} ${pathValue}）`,
      `    const ${resVar} = await apiRequest(${pathLit}, { method: ${methodLit} }); // TODO: 如有 Body，请补充 body 字段`,
      `    tc.assertEqual(200, ${resVar}.status, 'HTTP ${method} ${pathValue} 返回 200');`,
      `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
      '',
    );
  }
  return lines;
}

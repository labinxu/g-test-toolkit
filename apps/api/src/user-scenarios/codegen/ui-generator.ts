import { StepBindingV1, StepCheckRule } from '../action-catalog';
import type { UsedPage, StepInput } from './ui-helpers';

type Catalog = {
  pages: {
    key: string;
    className: string;
    varName: string;
    module?: string | null;
    actions: {
      key: string;
      method: string;
      kind?: string;
      actionType?: string | null;
      returnTarget?: string | null;
      locator?: string | null;
    }[];
  }[];
};

type AppendUiStepLinesParams = {
  step: StepInput;
  dest: string[];
  indent?: string;
  platform: string;
  catalog: Catalog;
  usedPages: Map<string, UsedPage>;
  declaredVars: Set<string>;
  returnedPageKeys: Set<string>;
  setHasBindings: () => void;
};

export function appendUiStepLines({
  step,
  dest,
  indent = '    ',
  platform,
  catalog,
  usedPages,
  declaredVars,
  returnedPageKeys,
  setHasBindings,
}: AppendUiStepLinesParams) {
  const makeLine = (txt: string) => `${indent}${txt}`;
  let binding: StepBindingV1 | null = null;
  if (step.binding) {
    try {
      binding =
        typeof step.binding === 'string'
          ? (JSON.parse(step.binding) as StepBindingV1)
          : (step.binding as StepBindingV1);
    } catch {
      binding = null;
    }
  }
  const normalizedBinding =
    binding && typeof binding === 'object'
      ? ({
          ver: (binding as any).ver ?? 1,
          platform: (binding as any).platform || platform,
          ...binding,
        } as StepBindingV1)
      : null;
  const resolved = normalizedBinding
    ? resolveBindingWithCatalog(catalog, normalizedBinding)
    : null;
  if (!resolved) {
    dest.push(makeLine(`// Step ${step.order}: ${step.action.replace(/\r?\n/g, ' ')}`));
    if (step.data) {
      dest.push(makeLine(`//   Data / Precondition: ${step.data.replace(/\r?\n/g, ' ')}`));
    }
    if (step.expected) {
      dest.push(makeLine(`//   Expected: ${step.expected.replace(/\r?\n/g, ' ')}`));
    }
    return;
  }
  setHasBindings();
  const { page, action } = resolved;
  const pageKey = page.key;
  if (!usedPages.has(pageKey)) {
    usedPages.set(pageKey, {
      className: page.className,
      varName: page.varName,
      module: (page as any).module ?? null,
    });
  }
  // 任何在步骤中出现的页面对象都会在文件头被实例化或通过前置步骤返回，提前标记为“已声明”，避免后续 returnTarget 再用 let 重新声明。
  declaredVars.add(page.varName);
  const rawReturnTarget = (action as any)?.returnTarget ? String((action as any).returnTarget).trim() : '';
  const returnTargetPage =
    rawReturnTarget &&
    catalog.pages.find(
      (p) => p.className === rawReturnTarget || p.key === rawReturnTarget || p.varName === rawReturnTarget
    );
  if (returnTargetPage) {
    returnedPageKeys.add(returnTargetPage.key);
  }
  const args = (binding?.args || []).map((a) => `${a.value}`).filter((v) => v.length > 0) || [];
  const argsCode = args.map((v) => JSON.stringify(v)).join(', ');
  const callExpr = argsCode.length > 0 ? `${page.varName}.${action.method}(${argsCode})` : `${page.varName}.${action.method}()`;
  const call = makeLine(`await ${callExpr};`);
  dest.push(makeLine(`// Step ${step.order}: ${step.action.replace(/\r?\n/g, ' ')}`));
  if (step.data) {
    dest.push(makeLine(`//   Data / Precondition: ${step.data.replace(/\r?\n/g, ' ')}`));
  }
  if (step.expected) {
    dest.push(makeLine(`//   Expected: ${step.expected.replace(/\r?\n/g, ' ')}`));
  }
  if (returnTargetPage) {
    const targetVar = returnTargetPage.varName;
    const assign = declaredVars.has(targetVar)
      ? makeLine(`${targetVar} = await ${callExpr};`)
      : makeLine(`let ${targetVar} = await ${callExpr};`);
    declaredVars.add(targetVar);
    dest.push(assign);
  } else {
    dest.push(call);
  }
  const rule: StepCheckRule | undefined =
    binding && typeof (binding as any).checkRule === 'object'
      ? ((binding as any).checkRule as StepCheckRule)
      : undefined;
  if (rule && rule.type) {
    dest.push(
      ...buildCheckRuleLines({
        rule,
        step,
        indent,
        descriptionPrefix: '',
        locatorFallback: (action as any)?.locator,
      }),
    );
  }
}

function resolveBindingWithCatalog(catalog: Catalog, binding: StepBindingV1) {
  const page = catalog.pages.find(
    (p) =>
      p.key === binding.pageKey ||
      p.varName === binding.pageKey ||
      p.className === binding.pageKey,
  );
  if (!page) return null;
  const action = page.actions.find(
    (a: any) =>
      a.key === binding.actionKey ||
      a.method === binding.actionKey,
  );
  if (!action) return null;
  return { page, action };
}

export function buildCheckRuleLines(params: {
  rule: StepCheckRule;
  step: StepInput;
  indent?: string;
  descriptionPrefix?: string;
  locatorFallback?: string | null;
}): string[] {
  const {
    rule,
    step,
    indent = '    ',
    descriptionPrefix = '',
    locatorFallback = '',
  } = params;
  const makeLine = (txt: string) => `${indent}${txt}`;
  const lines: string[] = [];
  if (rule.type === 'element-visible' || rule.type === 'element-hidden') {
    const fromRule = (rule.locator || '').toString().trim();
    const fromAction = locatorFallback ? locatorFallback.toString().trim() : '';
    const locator = fromRule || fromAction;
    if (!locator) return lines;
    const locatorLit = JSON.stringify(locator);
    const expectedText = (step.expected || '').toString().trim();
    const userMessage = expectedText ? expectedText.replace(/\r?\n/g, ' ') : '';
    const defaultMessage =
      rule.type === 'element-visible'
        ? `元素应出现：${locator}`
        : `元素应消失：${locator}`;
    const description = descriptionPrefix
      ? `${descriptionPrefix}${userMessage || defaultMessage}`
      : userMessage || defaultMessage;
    const timeoutMs =
      rule.timeoutMs && Number.isFinite(rule.timeoutMs)
        ? Math.max(0, Math.floor(rule.timeoutMs))
        : null;
    lines.push(makeLine('{'));
    lines.push(makeLine('  const driver: any = (tc as any).page;'));
    lines.push(makeLine(`  const locator = ${locatorLit};`));
    lines.push(makeLine('  const checkVisible = async () => {'));
    lines.push(makeLine('    try {'));
    lines.push(
      makeLine(
        "      const el = driver && typeof driver.$ === 'function' ? await driver.$(locator) : null;",
      ),
    );
    lines.push(
      makeLine(
        "      const displayed = el && typeof el.isDisplayed === 'function' ? await el.isDisplayed() : !!el;",
      ),
    );
    lines.push(makeLine('      return { el, displayed };'));
    lines.push(makeLine('    } catch {'));
    lines.push(makeLine('      return { el: null, displayed: false };'));
    lines.push(makeLine('    }'));
    lines.push(makeLine('  };'));
    if (timeoutMs != null) {
      lines.push(makeLine(`  const waited = driver && typeof driver.waitUntil === 'function'`));
      lines.push(
        makeLine(
          `    ? await driver.waitUntil(async () => (await checkVisible()).displayed === ${rule.type === 'element-visible' ? 'true' : 'false'}, { timeout: ${timeoutMs}, interval: 300, timeoutMsg: ${JSON.stringify(description)} })`,
        ),
      );
      lines.push(makeLine('    : await checkVisible();'));
      lines.push(
        makeLine(
          '  const result = waited && (waited.el !== undefined ? waited : await checkVisible());',
        ),
      );
    } else {
      lines.push(makeLine('  const result = await checkVisible();'));
    }
    lines.push(
      makeLine(
        rule.type === 'element-visible'
          ? `  tc.assertEqual(true, !!(result), ${JSON.stringify(description)});`
          : `  if (result && result.displayed) { throw new Error(${JSON.stringify(description)} + '（实际仍然存在）'); }`,
      ),
    );
    lines.push(makeLine('}'));
  } else if (rule.type === 'url-contains' || rule.type === 'url-equals') {
    const expectedUrl = (rule.expectedUrl || '').toString().trim();
    if (!expectedUrl) return lines;
    const expectedLit = JSON.stringify(expectedUrl);
    const mode = rule.type === 'url-contains' ? '包含' : '等于';
    lines.push(makeLine('{'));
    lines.push(makeLine('  const driver: any = (tc as any).page;'));
    lines.push(
      makeLine(
        "  const url = driver && typeof driver.getUrl === 'function' ? await driver.getUrl() :",
      ),
    );
    lines.push(
      makeLine(
        "    driver && typeof driver.url === 'function' ? await driver.url() : '';",
      ),
    );
    lines.push(
      rule.type === 'url-contains'
        ? makeLine(`  const ok = typeof url === 'string' && url.includes(${expectedLit});`)
        : makeLine(`  const ok = typeof url === 'string' && url === ${expectedLit};`),
    );
    lines.push(
      makeLine(
        `  tc.assertEqual(true, ok, ${JSON.stringify(`URL 检查：期望${mode} ${expectedUrl}`)});`,
      ),
    );
    lines.push(makeLine('}'));
  } else if (rule.type === 'api-status') {
    const expectedCode = Number((rule as any)?.expectedStatus ?? (rule as any)?.expectedCode);
    if (Number.isFinite(expectedCode)) {
      const expCode = Math.floor(expectedCode);
      lines.push(makeLine(`  tc.assertEqual(${expCode}, res.status, 'HTTP 状态码应为 ${expCode}');`));
    }
  }
  return lines;
}

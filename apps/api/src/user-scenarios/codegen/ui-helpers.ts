import { StepBindingV1 } from '../action-catalog';

export type StepInput = {
  order: number;
  action: string;
  expected: string;
  data?: string;
  binding?: string | StepBindingV1 | null;
};

export type UsedPage = {
  className: string;
  varName: string;
  module?: string | null;
  key?: string;
  fromReturnOnly?: boolean;
};

export function normalizeStepInput(raw: any, idx: number): StepInput {
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') obj = parsed;
    } catch {
      obj = { action: raw };
    }
  }
  const order = Number.isFinite(obj?.order) ? Number(obj.order) : idx + 1;
  const actionText = (
    obj?.action ??
    (typeof raw === 'string' ? raw : '') ??
    ''
  ).toString();
  const expectedText = (obj?.expected ?? '').toString();
  const dataText = (obj?.data ?? '').toString();
  const bindingRaw = obj?.binding ?? null;
  const binding =
    bindingRaw && typeof bindingRaw === 'object'
      ? JSON.stringify(bindingRaw)
      : bindingRaw
        ? String(bindingRaw)
        : null;
  return {
    order,
    action: actionText,
    expected: expectedText,
    data: dataText,
    binding,
  };
}

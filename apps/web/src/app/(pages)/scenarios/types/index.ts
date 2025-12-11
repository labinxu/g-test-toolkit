export type CaseStatus = 'draft' | 'in_progress' | 'ready' | 'code_generated'

export type UserScenarioSummary = {
  id: number
  code: string
  title: string
  module?: string | null
  platform?: string | null
  feature?: string | null
  submenu?: string | null
  priority?: 'P0' | 'P1' | 'P2'
  status: CaseStatus
  hasSteps: boolean
  hasCode: boolean
  description?: string | null
  acceptanceCriteria?: string | null
  generatedFilePath?: string | null
  suiteId?: number | null
  suiteName?: string | null
}

export type UserScenarioStep = {
  id: string
  order: number
  action: string
  data?: string
  expected: string
  binding?: string
}

export type ActionParamDef = {
  name: string
  type?: string
  required?: boolean
  placeholder?: string
}

export type StepCheckRuleType =
  | 'element-visible'
  | 'element-hidden'
  | 'url-contains'
  | 'url-equals'

export type StepCheckRule = {
  type: StepCheckRuleType
  locator?: string
  expectedUrl?: string
  timeoutMs?: number
}

export type PageActionDef = {
  key: string
  label: string
  method: string
  kind: 'action' | 'assert' | 'call'
  defaultExpected?: string
  locator?: string | null
  callSteps?: {
    targetActionKey: string
    args?: string[]
    sortOrder?: number
  }[]
  params?: ActionParamDef[]
}

export type PageDef = {
  key: string
  label: string
  module: string
  className: string
  varName: string
  actions: PageActionDef[]
}

export type ActionCatalog = {
  platform: string
  pages: PageDef[]
}

export type StepBindingV1 = {
  ver: 1
  platform: string
  pageKey: string
  actionKey: string
  args?: { name: string; value: string }[]
  checkRule?: StepCheckRule
}

export type StepParamHint = {
  summary: string
  example: string
}

export type EnvTemplateSummary = {
  id: number
  platform: string
  driver: 'browser' | 'android' | 'ios' | 'other'
  key: string
  name: string
  description?: string | null
}

export type UserScenarioSuiteSummary = {
  id: number
  name: string
  description?: string | null
  platform: string
  module: string
  sharedPreSteps?: string[]
  caseIds?: number[]
  caseCount?: number
}

'use client'

export type PageSummary = {
  id: number
  platform: string
  key: string
  label: string
  module: string
  className: string
  varName: string
  enabled: boolean
  sortOrder: number
}

export type AdminParam = {
  id?: number
  name: string
  type?: string | null
  required: boolean
  placeholder?: string | null
  defaultValue?: string | null
  sortOrder: number
}

export type AdminCallStep = {
  targetActionKey: string
  args: string[]
  sortOrder: number
}

export type AdminAction = {
  id?: number
  key: string
  label: string
  method: string
  actionType?: 'click' | 'input' | 'drag'
  kind: 'action' | 'assert' | 'call'
  defaultExpected?: string | null
  description?: string | null
  enabled: boolean
  sortOrder: number
  locator?: string | null
  returnTarget?: string | null
  params: AdminParam[]
  callSteps?: AdminCallStep[]
}

export type AdminElement = {
  id?: number
  elementId: string
  description?: string | null
  defaultLocator?: string | null
}

export type AdminPage = {
  id?: number
  platform: string
  key: string
  label: string
  module: string
  className: string
  varName: string
  enabled: boolean
  sortOrder: number
  actions: AdminAction[]
  elements?: AdminElement[]
}

export type PlatformSummary = {
  id: number
  key: string
  label: string
  libDir?: string | null
  enabled: boolean
  sortOrder: number
}

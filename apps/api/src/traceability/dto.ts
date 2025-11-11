export type UpsertRequirementDto = {
  key: string
  system?: string
  title?: string
  url?: string
}

export type SaveMappingsDto = {
  mappings: Array<{
    requirementKey: string
    testId: string
    linkType?: string
    note?: string
  }>
}

export type ExportDto = {
  format: 'testrail-cases' | 'testrail-refs' | 'xray' | 'jira-links'
  user?: string
  projectKey?: string
  labels?: string[]
  requirementKeys?: string[]
  testIds?: string[]
  testrail?: {
    section?: string
    useFirstSuite?: boolean
    template?: string
    type?: string
    priority?: string
  }
}

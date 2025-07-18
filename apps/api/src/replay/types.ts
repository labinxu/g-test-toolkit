export interface RecordedEvent {
  type: 'click' | 'input'
  x?: number
  y?: number
  value?: string
  target?: string
  id?: string
  class?: string
  timestamp: number
}

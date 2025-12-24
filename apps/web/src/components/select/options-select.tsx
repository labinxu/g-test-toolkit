'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type OptionsSelectItem<TValue extends string = string> = {
  label: string
  value: TValue
}

type OptionsSelectProps<TValue extends string = string> = {
  id?: string
  placeholder?: string
  defaultValue?: TValue
  value?: TValue
  items: OptionsSelectItem<TValue>[]
  onSelect: (item: OptionsSelectItem<TValue>) => void
  triggerClassName?: string
  contentClassName?: string
  size?: 'default' | 'sm'
  disabled?: boolean
}

export function OptionsSelect<TValue extends string = string>({
  id,
  placeholder = 'Select',
  defaultValue,
  value,
  items,
  onSelect,
  triggerClassName,
  contentClassName,
  size = 'default',
  disabled = false,
}: OptionsSelectProps<TValue>) {
  const selectProps: any = {}
  if (value !== undefined) selectProps.value = value
  else if (defaultValue !== undefined) selectProps.defaultValue = defaultValue
  return (
    <Select
      {...selectProps}
      disabled={disabled}
      onValueChange={(value) => {
        const selectedItem = items.find((item) => item.value === value)
        if (selectedItem) {
          onSelect(selectedItem)
        }
      }}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={cn(
          'w-full justify-between',
          triggerClassName
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn('max-h-[160px] w-[160px] overflow-y-auto', contentClassName)}>
        {items.map((item, index) => (
          <SelectItem key={`${item.value}#${index}`} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

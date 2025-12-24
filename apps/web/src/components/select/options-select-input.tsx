'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, XIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { OptionsSelectItem } from './options-select';

type OptionsSelectInputProps<TValue extends string = string> = {
  id?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  items: OptionsSelectItem<TValue>[];
  onSelect?: (item: OptionsSelectItem<TValue>) => void;
  onBlur?: () => void;
  className?: string;
  inputClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
  size?: 'default' | 'sm';
  onDeleteOption?: (item: OptionsSelectItem<TValue>) => void;
  disabled?: boolean;
};

export function OptionsSelectInput<TValue extends string = string>({
  id,
  placeholder,
  value,
  onChange,
  items,
  onSelect,
  onBlur,
  className,
  inputClassName,
  triggerClassName,
  contentClassName,
  size = 'default',
  onDeleteOption,
  disabled = false,
}: OptionsSelectInputProps<TValue>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputHeightClass = size === 'sm' ? 'h-8 pr-8' : 'h-9 pr-9';
  const triggerSizeClass = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        id={id}
        className={cn(inputHeightClass, 'w-full text-sm', inputClassName)}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
      />
      <button
        type="button"
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-center text-muted-foreground hover:text-foreground',
          triggerSizeClass,
          triggerClassName,
        )}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Toggle options"
      >
        <ChevronDownIcon className="h-4 w-4" />
      </button>
      {open && !disabled && items.length > 0 && (
        <div
          className={cn(
            'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md',
            contentClassName,
          )}
        >
          {items.map((item) => (
            <div
              key={item.value}
              className="group flex w-full items-center px-2 py-1.5 hover:bg-accent"
            >
              <button
                type="button"
                className="flex-1 truncate text-left"
                onClick={() => {
                  onChange(item.value);
                  onSelect?.(item);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
              {onDeleteOption && (
                <button
                  type="button"
                  className="ml-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`删除 ${item.label}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteOption(item);
                  }}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

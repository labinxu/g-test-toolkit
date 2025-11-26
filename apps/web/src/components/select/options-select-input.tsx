'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { OptionsSelectItem } from './options-select';

type OptionsSelectInputProps<TValue extends string = string> = {
  id?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  items: OptionsSelectItem<TValue>[];
  className?: string;
  inputClassName?: string;
  triggerClassName?: string;
};

export function OptionsSelectInput<TValue extends string = string>({
  id,
  placeholder,
  value,
  onChange,
  items,
  className,
  inputClassName,
  triggerClassName,
}: OptionsSelectInputProps<TValue>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        id={id}
        className={cn('h-9 w-full pr-9 text-sm', inputClassName)}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className={cn(
          'absolute inset-y-0 right-0 flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground',
          triggerClassName,
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Toggle options"
      >
        <ChevronDownIcon className="h-4 w-4" />
      </button>
      {open && items.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md">
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              className="flex w-full items-center px-2 py-1.5 text-left hover:bg-accent"
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

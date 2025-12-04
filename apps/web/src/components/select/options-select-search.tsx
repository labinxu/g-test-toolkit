'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { OptionsSelectItem } from './options-select';

type OptionsSelectSearchProps<TValue extends string = string> = {
  id?: string;
  placeholder?: string;
  value?: TValue | null;
  onChange: (value: TValue) => void;
  items: OptionsSelectItem<TValue>[];
  className?: string;
  inputClassName?: string;
  triggerClassName?: string;
  size?: 'default' | 'sm';
};

export function OptionsSelectSearch<TValue extends string = string>({
  id,
  placeholder,
  value,
  onChange,
  items,
  className,
  inputClassName,
  triggerClassName,
  size = 'default',
}: OptionsSelectSearchProps<TValue>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.value === value) || null,
    [items, value],
  );

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
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const label = String(item.label ?? item.value).toLowerCase();
      const val = String(item.value).toLowerCase();
      return label.includes(q) || val.includes(q);
    });
  }, [items, query]);

  const inputValue = open
    ? query
    : selected
      ? String(selected.label ?? selected.value)
      : '';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        id={id}
        className={cn(
          size === 'sm' ? 'h-8 pr-8' : 'h-9 pr-9',
          'w-full text-sm',
          inputClassName,
        )}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <button
        type="button"
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-center text-muted-foreground hover:text-foreground',
          size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
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
      {open && filteredItems.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md">
          {filteredItems.map((item) => (
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
      {open && filteredItems.length === 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-xs text-muted-foreground shadow-md">
          <div className="px-2 py-1.5">无匹配项</div>
        </div>
      )}
    </div>
  );
}

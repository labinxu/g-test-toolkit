'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { OptionsSelectItem } from './options-select';

type EmbedSelectSearchProps<TValue extends string = string> = {
  id?: string;
  placeholder?: string;
  value?: TValue | null;
  onChange: (value: TValue) => void;
  items: OptionsSelectItem<TValue>[];
  className?: string;
  inputClassName?: string;
  triggerClassName?: string;
  size?: 'default' | 'sm';
  disabled?: boolean;
};

export function EmbedSelectSearch<TValue extends string = string>({
  id,
  placeholder,
  value,
  onChange,
  items,
  className,
  inputClassName,
  triggerClassName,
  size = 'default',
  disabled = false,
}: EmbedSelectSearchProps<TValue>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [portalStyle, setPortalStyle] = useState<CSSProperties>({});

  const selected = useMemo(
    () => items.find((item) => item.value === value) || null,
    [items, value],
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = !!containerRef.current?.contains(target);
      const inDropdown = !!dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
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

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = inputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPortalStyle({
        position: 'fixed',
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
        zIndex: 1000,
        pointerEvents: 'auto',
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
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
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        id={id}
        ref={inputRef}
        className={cn(
          size === 'sm' ? 'h-8 pr-8' : 'h-9 pr-9',
          'w-full text-sm',
          inputClassName,
        )}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="search"
        placeholder={placeholder}
        value={inputValue}
        disabled={disabled}
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

      {open &&
        createPortal(
          filteredItems.length > 0 ? (
            <div
              ref={dropdownRef}
              className="max-h-60 overflow-auto rounded-md border bg-popover text-sm shadow-md"
              style={portalStyle}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {filteredItems.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="flex w-full items-center px-2 py-1.5 text-left hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : (
            <div
              ref={dropdownRef}
              className="rounded-md border bg-popover text-xs text-muted-foreground shadow-md"
              style={portalStyle}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 py-1.5">无匹配项</div>
            </div>
          ),
          document.body,
        )}
    </div>
  );
}


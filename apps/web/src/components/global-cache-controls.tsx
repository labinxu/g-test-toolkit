'use client'

import { useCallback, useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useLibsPageCache, useTestcasesPageCache } from '@/app/(pages)/page-cache'

export function GlobalCacheControls() {
  const tcCache = useTestcasesPageCache()
  const libsCache = useLibsPageCache()
  const [ttl, setTtl] = useState<number>(() => {
    if (typeof window === 'undefined') return 60000
    try {
      const v = parseInt(localStorage.getItem('gtt:dirTree:ttl') || '60000', 10)
      return Number.isFinite(v) ? v : 60000
    } catch {
      return 60000
    }
  })
  const [disabled, setDisabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('gtt:dirTree:disable') === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('gtt:dirTree:ttl', String(Math.max(0, ttl|0))) } catch {}
  }, [ttl])
  useEffect(() => {
    try { localStorage.setItem('gtt:dirTree:disable', disabled ? '1' : '0') } catch {}
  }, [disabled])

  const clearAllCaches = useCallback(() => {
    try {
      // Reset in-memory stores
      tcCache.reset();
      libsCache.reset();
      // Remove localStorage keys related to file caches, last files, cursors, and dir trees
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || ''
        if (
          k.startsWith('gtt:fileCache:testcases:') ||
          k.startsWith('gtt:fileCache:libs:') ||
          k.startsWith('gtt:cursor:') ||
          k.startsWith('gtt:dirTree:') ||
          k === 'gtt:testcases:lastFile' ||
          k === 'gtt:libs:lastFile'
        ) keys.push(k)
      }
      keys.forEach((k) => localStorage.removeItem(k))
    } catch {}
    // Optionally, broadcast a storage event for listeners
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'gtt:dirTree:cleared' })) } catch {}
  }, [tcCache, libsCache])

  return (
    <div className="flex items-center gap-2 mr-2">
      <Label htmlFor="global-dircache-ttl" className="text-xs text-muted-foreground">Cache TTL</Label>
      <Input id="global-dircache-ttl" type="number" className="h-7 w-24" min={0} value={ttl} onChange={(e) => setTtl(parseInt(e.target.value || '0', 10) || 0)} />
      <span className="text-xs text-muted-foreground">ms</span>
      <div className="flex items-center gap-2 ml-2">
        <Switch id="global-dircache-disable" checked={disabled} onCheckedChange={(v) => setDisabled(!!v)} />
        <Label htmlFor="global-dircache-disable" className="text-xs cursor-pointer select-none">Disable cache</Label>
      </div>
      <Button size="sm" variant="outline" onClick={clearAllCaches}>Clear Cache</Button>
    </div>
  )
}


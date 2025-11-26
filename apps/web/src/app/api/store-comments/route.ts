import { NextResponse } from 'next/server'

// Simple in-memory cache (per server instance)
const cache = new Map<string, { ts: number; data: any[] }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function toIsoDate(maybe: any): string | undefined {
  try {
    if (!maybe) return undefined
    if (maybe instanceof Date && isFinite(maybe.getTime())) return maybe.toISOString()
    if (typeof maybe === 'number' && isFinite(maybe)) return new Date(maybe).toISOString()
    if (typeof maybe === 'string') {
      const t = Date.parse(maybe)
      if (isFinite(t)) return new Date(t).toISOString()
    }
  } catch {}
  return undefined
}

function normalizeStr(s: any): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\n\r\t]+/g, ' ')
}

function makeKey(r: any): string {
  if (r?.id != null && String(r.id).trim() !== '') return `id:${String(r.id)}`
  const dateTs = (() => {
    const t = Date.parse(r?.date || '')
    return Number.isFinite(t) ? String(t) : ''
  })()
  return [
    'k',
    normalizeStr(r?.store),
    normalizeStr(r?.region),
    normalizeStr(r?.userName),
    normalizeStr(r?.title),
    normalizeStr(r?.text),
    dateTs,
  ].join('|')
}

function dedup<T = any>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of items) {
    const k = makeKey(it)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
  return out
}

type Input = {
  store: 'google' | 'apple'
  lang?: string // 'en' | 'zh' | 'other'
  region?: string // 'main' | 'us' | other
  regions?: string[] // optional multi-country for google
  packageId: string // for google: appId; for apple: bundle or id or term
  num?: number
  dateStart?: string // ISO string (optional)
  dateEnd?: string   // ISO string (optional)
  exhaustive?: boolean // When true, fetch as many as possible since dateStart (ignores num slicing)
  maxPages?: number    // Safety cap per-country pages (default 50)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Input
    const store = String(body?.store || 'google') as Input['store']
    const lang = String(body?.lang || '').toLowerCase()
    const region = String(body?.region || '').toLowerCase()
    const regions = Array.isArray((body as any)?.regions)
      ? ((body as any).regions as string[]).map((s) => String(s).toLowerCase())
      : undefined
    const packageId = String(body?.packageId || '').trim()
    const num = Math.max(1, Math.min(1000, Number(body?.num) || 100))
    if (!packageId) return NextResponse.json({ error: 'packageId required' }, { status: 400 })

    // simple in-memory cache with TTL
    const dateStartIso = body?.dateStart && typeof body.dateStart === 'string' ? body.dateStart : undefined
    const dateEndIso = body?.dateEnd && typeof body.dateEnd === 'string' ? body.dateEnd : undefined
    const startTs = dateStartIso ? Date.parse(dateStartIso) : NaN
    const endTs = dateEndIso ? Date.parse(dateEndIso) : NaN
    const key = JSON.stringify({ store, lang, region, regions, packageId, num, dateStartIso, dateEndIso })
    const now = Date.now()
    const hit = cache.get(key)
    if (hit && now - hit.ts < CACHE_TTL_MS) {
      return NextResponse.json({ items: hit.data })
    }

    const inRange = (iso?: string) => {
      if (!iso) return true
      const t = Date.parse(iso)
      if (!isFinite(t)) return true
      // Strictly greater than start, to avoid boundary duplicates
      if (isFinite(startTs) && t <= startTs) return false
      if (isFinite(endTs) && t > endTs) return false
      return true
    }

    if (store === 'google') {
      // Lazy import to avoid bundling in edge
      const gplayMod: any = await import('google-play-scraper').catch(() => null as any)
      const gplay: any = gplayMod && (gplayMod.default || gplayMod)
      if (!gplay) return NextResponse.json({ error: 'google-play-scraper not installed' }, { status: 500 })
      // Map language and country
      const mapLang = (l?: string) => (l === 'en' ? 'en' : l === 'zh' ? 'zh' : undefined)
      const mapCountry = (r?: string) => (r && r.length === 2 ? r : undefined)
      const l = mapLang(lang)
      const mainCountries = ['us', 'gb', 'de', 'fr', 'jp', 'in', 'br', 'au', 'ca']
      const targetCountries = regions && regions.length
        ? regions.map(mapCountry).filter(Boolean)
        : region === 'main'
        ? mainCountries
        : [mapCountry(region) || 'us']

      const perCountry = Math.max(1, Math.ceil(num / Math.max(1, targetCountries.length)))
      const bucket: any[] = []
      for (const c of targetCountries) {
        const target = body?.exhaustive ? Number.POSITIVE_INFINITY : perCountry
        let token: any = undefined
        let pages = 0
        const maxPages = Math.max(1, Math.min(200, Number(body?.maxPages) || 50))
        while (bucket.length < target && pages < maxPages) {
          const params: any = {
            appId: packageId,
            sort: gplay.sort.NEWEST,
            num: Math.min(200, target === Number.POSITIVE_INFINITY ? 200 : Math.max(1, target - bucket.length)),
          }
          if (l) params.lang = l
          if (c) params.country = c
          if (token) params.token = token
          try {
            const res: any = await gplay.reviews(params)
            const arr: any[] = Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res?.reviews)
              ? res.reviews
              : Array.isArray(res)
              ? res
              : []
            const mapped = arr.map((r: any) => ({
              id: r?.id,
              userName: r?.userName,
              date: toIsoDate(r?.date || r?.at || r?.timestamp),
              score: r?.score,
              title: r?.title,
              text: r?.text,
              version: r?.version,
              thumbsUp: r?.thumbsUp || r?.thumbsUpCount,
              store: 'google',
              lang: l || 'en',
              region: c || 'us',
              packageId,
            }))
            bucket.push(...mapped)
            // Stop early if we've crossed the dateStart boundary
            if (isFinite(startTs)) {
              const hitOlder = mapped.some((it) => {
                const t = Date.parse(it.date || '')
                return Number.isFinite(t) && t < startTs
              })
              if (hitOlder) break
            }
            token = (res?.nextPaginationToken || res?.token || null) as any
            pages += 1
            if (!token) break
          } catch {
            break
          }
        }
        if (!body?.exhaustive && bucket.length >= num) break
      }
      let items = dedup(bucket).filter((it) => inRange(it.date))
      if (!body?.exhaustive) items = items.slice(0, num)
      cache.set(key, { ts: now, data: items })
      return NextResponse.json({ items })
    }

    if (store === 'apple') {
      // Optional: try app-store-scraper if available
      const appStoreMod: any = await import('app-store-scraper').catch(() => null as any)
      const appStore: any = appStoreMod && (appStoreMod.default || appStoreMod)
      if (!appStore) {
        return NextResponse.json(
          { error: 'apple store not supported: please install app-store-scraper' },
          { status: 501 }
        )
      }
      // Decide storefront country from region/lang
      const country = region === 'us' ? 'us' : lang === 'zh' ? 'cn' : 'us'
      let appIdNum: number | null = null
      const numeric = /^\d+$/.test(packageId)
      if (numeric) appIdNum = Number(packageId)
      if (!appIdNum) {
        // try search
        const found = await appStore.search({ term: packageId, num: 1, country })
        if (Array.isArray(found) && found[0]?.id) appIdNum = Number(found[0].id)
      }
      if (!appIdNum) {
        return NextResponse.json({ error: 'cannot resolve apple app id' }, { status: 400 })
      }
      // Apple: support multi-country (main markets) similar to Google
      const mainCountriesApple = ['us', 'gb', 'de', 'fr', 'jp', 'cn', 'au', 'ca']
      const targetCountries = Array.isArray(regions) && regions.length
        ? regions
        : region === 'main'
        ? mainCountriesApple
        : [country]
      const perCountry = Math.max(1, Math.ceil(num / Math.max(1, targetCountries.length)))
      const bucket: any[] = []
      const SORT_RECENT = (appStore as any).sort?.RECENT ?? 0
      for (const ctry of targetCountries) {
        let page = 0
        const accOne: any[] = []
        const maxPages = Math.max(1, Math.min(200, Number(body?.maxPages) || 50))
        while (page < maxPages) {
          const reviews = await appStore.reviews({ id: appIdNum, sort: SORT_RECENT, page, country: ctry })
          const arr = Array.isArray(reviews) ? reviews : []
          if (!arr.length) break
          accOne.push(...arr)
          // Stop if we've crossed the dateStart boundary
          if (isFinite(startTs)) {
            const hitOlder = arr.some((r: any) => {
              const iso = toIsoDate(r?.date || r?.updated || r?.updated_at || r?.isoDate || r?.timestamp || r?.time)
              const t = iso ? Date.parse(iso) : NaN
              return Number.isFinite(t) && t < startTs
            })
            // Break as soon as we crossed the boundary; we only need data since start
            if (hitOlder) break
          }
          // Apple pages typically contain up to 50 reviews; a short page means no more
          if (arr.length < 50) break
          // For non-exhaustive mode, stop once enough per-country collected
          if (!body?.exhaustive && accOne.length >= perCountry) break
          page += 1
        }
        const mapped = accOne.map((r: any) => ({
          id: r?.id,
          userName: r?.userName || r?.user,
          date: toIsoDate(r?.date || r?.updated || r?.updated_at || r?.isoDate || r?.timestamp || r?.time),
          score: r?.score || r?.rating,
          title: r?.title,
          text: r?.text,
          version: r?.version,
          thumbsUp: r?.voteCount || undefined,
          store: 'apple',
          lang: lang || 'en',
          region: ctry,
          packageId,
        }))
        bucket.push(...mapped)
        if (!body?.exhaustive && bucket.length >= num) break
      }
      let items = dedup(bucket).filter((it) => inRange(it.date))
      if (!body?.exhaustive) items = items.slice(0, num)
      cache.set(key, { ts: now, data: items })
      return NextResponse.json({ items })
    }

    return NextResponse.json({ error: 'unsupported store' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal error' }, { status: 500 })
  }
}

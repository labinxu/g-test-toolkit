'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ArrowLeftRightIcon, CalendarArrowDownIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

const formatLocalTime = (date: Date) =>
  date
    .toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(/\//g, '-')

const formatUtcTime = (date: Date) => date.toISOString().split('.')[0].replace('T', ' ') + ' UTC'

const parseLocalTime = (value: string) => {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }
  const sanitized = normalized.replace(/\//g, '-')
  const isoCandidate = sanitized.includes('T') ? sanitized : sanitized.replace(' ', 'T')
  const parsed = new Date(isoCandidate)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const parseUtcTime = (value: string) => {
  const cleaned = value.trim().replace(/ UTC$/i, '')
  if (!cleaned) {
    return null
  }
  const parsed = new Date(cleaned.replace(' ', 'T') + 'Z')
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function Page() {
  const [timestamp, setTimestamp] = useState<number>(Date.now())
  const [transDate, setTransDate] = useState('')

  const [dateString, setDateString] = useState('')
  const [transdTimestamp, setTransdTimestamp] = useState('')
  const [currentLocalTime, setCurrentLocalTime] = useState('')
  const [currentUtcTime, setCurrentUtcTime] = useState('')
  const [transformLocal, setTransformLocal] = useState('')
  const [transformUtc, setTransformUtc] = useState('')

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date()
      const localDateTime = formatLocalTime(now)
      const utcDateTime = formatUtcTime(now)

      setCurrentLocalTime(localDateTime)
      setCurrentUtcTime(utcDateTime)
    }

    updateTimes()
    const timerId = window.setInterval(updateTimes, 1000)
    return () => window.clearInterval(timerId)
  }, [])

  const handleTransform = () => {
    const hasLocal = transformLocal.trim() !== ''
    const hasUtc = transformUtc.trim() !== ''

    if (hasLocal && !hasUtc) {
      const parsed = parseLocalTime(transformLocal)
      if (!parsed) {
        return
      }
      setTransformUtc(formatUtcTime(parsed))
      return
    }

    if (hasUtc && !hasLocal) {
      const parsed = parseUtcTime(transformUtc)
      if (!parsed) {
        return
      }
      setTransformLocal(formatLocalTime(parsed))
    }
  }
  const handleTransTimestamp2Date = () => {
    const hasDateStr = transDate.trim() !== ''
    console.log(`ts ${timestamp} hasDatestr ${hasDateStr}`)
    if (timestamp !== -1) {
      const date = new Date(timestamp)
      setTransDate(formatLocalTime(date))
    } else if (hasDateStr) {
      const timestamp = new Date(transDate.trim().replace(/\//g, '-')).getTime()
      setTimestamp(timestamp)
    }
  }
  return (
    <div className="flex w-full pt-8">
      <div className="flex w-full flex-1 flex-col gap-4 rounded-lg border-2 shadow-lg">
        <div className="flex flex-row items-start rounded-lg p-4 shadow-lg">
          <Label htmlFor="current-local" className="flex w-full flex-col gap-1 text-left">
            Current Date:
            <div className="relative w-[320px]">
              <Input id="current-local" readOnly value={currentLocalTime} className="w-full" />
            </div>
          </Label>
          <Button
            type="button"
            variant={'secondary'}
            size={'icon'}
            disabled
            className="pointer-events-none self-end opacity-0"
            aria-hidden="true"
          >
            <ArrowLeftRightIcon />
          </Button>
          <Label htmlFor="current-utc" className="flex w-full flex-col gap-1 text-left">
            UTC:
            <div className="relative w-[320px]">
              <Input id="current-utc" readOnly value={currentUtcTime} className="w-full" />
            </div>
          </Label>
        </div>
        <div className="flex flex-row items-start rounded-lg p-4 shadow-lg">
          <Label htmlFor="transform-local" className="flex w-full flex-col gap-1 text-left">
            Local Date:
            <div className="relative w-[320px]">
              <Input
                id="transform-local"
                value={transformLocal}
                onChange={(e) => setTransformLocal(e.target.value)}
                className="w-full pr-10"
              />
              <Button
                type="button"
                variant={'ghost'}
                size={'icon'}
                className="absolute top-1 right-1 h-8 w-8"
                onClick={() => setTransformLocal('')}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </Label>
          <Button
            type="button"
            variant={'secondary'}
            size={'icon'}
            onClick={handleTransform}
            className="self-end"
          >
            <ArrowLeftRightIcon />
          </Button>
          <Label htmlFor="transform-utc" className="flex w-full flex-col gap-1 text-left">
            UTC:
            <div className="relative w-[320px]">
              <Input
                id="transform-utc"
                value={transformUtc}
                onChange={(e) => setTransformUtc(e.target.value)}
                className="w-full pr-10"
              />
              <Button
                type="button"
                variant={'ghost'}
                size={'icon'}
                className="absolute top-1 right-1 h-8 w-8"
                onClick={() => setTransformUtc('')}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </Label>
        </div>
        {/* trans timestamp to date*/}
        <div className="flex flex-row items-start rounded-lg p-4 shadow-lg">
          <Label htmlFor="timestamp" className="flex w-full flex-col gap-1 text-left">
            Timestamp:
            <div className="w-[320px]">
              <Input
                value={timestamp}
                type="number"
                onChange={(e: any) => {
                  console.log(`timestamp: ${e.target.value}`)
                  const ts = e.target.value.trim()
                  if (ts !== '') {
                    setTimestamp(parseInt(e.target.value))
                  } else {
                    setTimestamp(-1)
                  }
                }}
                id="timestamp"
                className="w-full"
              />
            </div>
          </Label>
          <Button
            variant={'secondary'}
            size={'icon'}
            onClick={handleTransTimestamp2Date}
            className="self-end"
          >
            <ArrowLeftRightIcon />
          </Button>
          <Label htmlFor="localeDate" className="flex w-full flex-col gap-1 text-left">
            Local Date:
            <div className="relative w-[320px]">
              <Input
                id="localeDate"
                value={transDate}
                className="w-full"
                onChange={(e: any) => setTransDate(e.target.value)}
              />
              <Button
                type="button"
                variant={'ghost'}
                size={'icon'}
                className="absolute top-1 right-1 h-8 w-8"
                onClick={() => setTransDate('')}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </Label>
        </div>
      </div>
    </div>
  )
}

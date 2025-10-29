'use client'

import { create } from 'zustand'
import type { AndroidInspectorEmbedState } from '@/components/android-inspector-embed'

type FileCache = Record<string, { content: string; original: string }>

type LibsPageCache = {
  hasCache: boolean
  currentFile: string
  currentDir: string
  fileCache: FileCache
  openLog: boolean
  showAndroidInspector: boolean
  selectedDeviceId: string
  autoCenter: boolean
  autoRefreshInspector: boolean
  cachedInspectorState?: AndroidInspectorEmbedState
  save: (state: Partial<Omit<LibsPageCache, 'save'>>) => void
  reset: () => void
}

export const useLibsPageCache = create<LibsPageCache>((set) => ({
  hasCache: false,
  currentFile: '',
  currentDir: '',
  fileCache: {},
  openLog: false,
  showAndroidInspector: false,
  selectedDeviceId: '',
  autoCenter: true,
  autoRefreshInspector: false,
  cachedInspectorState: undefined,
  save: (state) => set((prev) => ({ ...prev, ...state, hasCache: true })),
  reset: () =>
    set({
      hasCache: false,
      currentFile: '',
      currentDir: '',
      fileCache: {},
      openLog: false,
      showAndroidInspector: false,
      selectedDeviceId: '',
      autoCenter: true,
      autoRefreshInspector: false,
      cachedInspectorState: undefined,
    }),
}))

type TestcasesPageCache = {
  hasCache: boolean
  currentFile: string
  currentDir: string
  fileCache: FileCache
  openLog: boolean
  save: (state: Partial<Omit<TestcasesPageCache, 'save'>>) => void
  reset: () => void
}

export const useTestcasesPageCache = create<TestcasesPageCache>((set) => ({
  hasCache: false,
  currentFile: '',
  currentDir: '',
  fileCache: {},
  openLog: false,
  save: (state) => set((prev) => ({ ...prev, ...state, hasCache: true })),
  reset: () =>
    set({
      hasCache: false,
      currentFile: '',
      currentDir: '',
      fileCache: {},
      openLog: false,
    }),
}))


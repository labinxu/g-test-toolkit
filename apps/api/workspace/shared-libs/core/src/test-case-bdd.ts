import { TestCase } from './test-case-base'
import type { ActorOptions, WithAndroidOptions } from './test-case-decorator'
import { withActors, withAndroid, withBrowser } from './test-case-decorator'

type HookType = 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach'

type BddFn = () => unknown | Promise<unknown>

export type BddHook = {
  fn: BddFn
}

export type BddTest = {
  title: string
  fn: BddFn
  skip?: boolean
  only?: boolean
}

export type UseBrowserOptions = {
  headless?: boolean
  debug?: boolean
  timeout?: number
  domain?: string
  retry?: number
}

export type UseAndroidOptions = WithAndroidOptions & {
  installBehavior?: 'install' | 'launch'
  bringToFront?: boolean
}

export type UseTestCaseOptions = {
  module?: string
  browser?: UseBrowserOptions | false
  android?: UseAndroidOptions | false
  /**
   * Multi-actor (multi-account) support for web tests.
   * Actors can be referenced via `tc.useActor('<name>')` / `tc.actor('<name>')`.
   */
  actors?: Record<string, ActorOptions>
  defaultActor?: string
  keepAppOpen?: boolean
  shareSession?: boolean
  sessionKey?: string
  userDir?: string
  tags?: string[]
}

type TestCaseHolder = {
  current: TestCase | null
}

export type BddTestCaseDescriptor = {
  holder: TestCaseHolder
  proxy: TestCase
  options?: UseTestCaseOptions
}

export type BddSuite = {
  title: string
  parent: BddSuite | null
  tests: BddTest[]
  suites: BddSuite[]
  hooks: Record<HookType, BddHook[]>
  testCaseDescriptors: BddTestCaseDescriptor[]
  skipped?: boolean
  only?: boolean
}

const suiteStack: BddSuite[] = []
const rootSuites: BddSuite[] = []

function getCurrentSuite(action: string): BddSuite {
  const current = suiteStack[suiteStack.length - 1]
  if (!current) {
    throw new Error(`${action} must be called within a describe()`)
  }
  return current
}

function createSuite(title: string, parent: BddSuite | null): BddSuite {
  return {
    title,
    parent,
    tests: [],
    suites: [],
    hooks: {
      beforeAll: [],
      afterAll: [],
      beforeEach: [],
      afterEach: [],
    },
    testCaseDescriptors: [],
  }
}

function createTestCaseProxy(holder: TestCaseHolder): TestCase {
  return new Proxy({} as TestCase, {
    get(_target, prop, _receiver) {
      const instance = holder.current
      if (!instance) {
        throw new Error(
          'TestCase instance is not available. Ensure you are accessing it inside a test or hook.'
        )
      }
      const value = (instance as any)[prop]
      if (typeof value === 'function') {
        return value.bind(instance)
      }
      return value
    },
    set(_target, prop, value) {
      const instance = holder.current
      if (!instance) {
        throw new Error(
          'TestCase instance is not available. Ensure you are accessing it inside a test or hook.'
        )
      }
      ;(instance as any)[prop] = value
      return true
    },
    has(_target, prop) {
      const instance = holder.current
      return instance ? prop in instance : false
    },
  })
}

export function describe(title: string, fn: () => void) {
  const parent = suiteStack[suiteStack.length - 1] ?? null
  const suite = createSuite(title, parent)
  if (!parent) {
    rootSuites.push(suite)
  } else {
    parent.suites.push(suite)
  }
  suiteStack.push(suite)
  try {
    fn()
  } finally {
    suiteStack.pop()
  }
}

describe.skip = function (title: string, fn: () => void) {
  const parent = suiteStack[suiteStack.length - 1] ?? null
  const suite = createSuite(title, parent)
  suite.skipped = true
  if (!parent) {
    rootSuites.push(suite)
  } else {
    parent.suites.push(suite)
  }
  suiteStack.push(suite)
  try {
    fn()
  } finally {
    suiteStack.pop()
  }
}

describe.only = function (title: string, fn: () => void) {
  const parent = suiteStack[suiteStack.length - 1] ?? null
  const suite = createSuite(title, parent)
  suite.only = true
  if (!parent) {
    rootSuites.push(suite)
  } else {
    parent.suites.push(suite)
  }
  suiteStack.push(suite)
  try {
    fn()
  } finally {
    suiteStack.pop()
  }
}

export function it(title: string, fn: BddFn) {
  const suite = getCurrentSuite('it()')
  suite.tests.push({ title, fn })
}

it.skip = function (title: string, _fn: BddFn) {
  const suite = getCurrentSuite('it.skip()')
  suite.tests.push({ title, fn: async () => {}, skip: true })
}

it.only = function (title: string, fn: BddFn) {
  const suite = getCurrentSuite('it.only()')
  suite.tests.push({ title, fn, only: true })
}

export const test = it
test.skip = it.skip
test.only = it.only

function registerHook(type: HookType, fn: BddFn) {
  const suite = getCurrentSuite(`${type}()`)
  suite.hooks[type].push({ fn })
}

export function beforeAll(fn: BddFn) {
  registerHook('beforeAll', fn)
}

export function afterAll(fn: BddFn) {
  registerHook('afterAll', fn)
}

export function beforeEach(fn: BddFn) {
  registerHook('beforeEach', fn)
}

export function afterEach(fn: BddFn) {
  registerHook('afterEach', fn)
}

export function useTestCase(options?: UseTestCaseOptions): TestCase {
  const suite = getCurrentSuite('useTestCase()')
  const holder: TestCaseHolder = { current: null }
  const proxy = createTestCaseProxy(holder)
  const effective = resolveUseTestCaseOptions(options)
  suite.testCaseDescriptors.push({ holder, proxy, options: effective })
  return proxy
}

export function resolveUseTestCaseOptions(
  base?: UseTestCaseOptions
): UseTestCaseOptions | undefined {
  if (!base) return base
  const g: any = globalThis as any
  const payload = g?.__gttEnvConfig || {}
  // 调试日志：记录传入的 envConfig 与原始 options（仅在有配置时输出，避免刷屏）
  try {
    const loggerService = g?.__gttLoggerService
    const clientId = g?.__gttClientId || 'unknown'
    const logger =
      (loggerService && loggerService.createLogger
        ? loggerService.createLogger('useTestCaseDebug', clientId)
        : null) || console
    const hasAndroid = !!payload.android
    const hasBrowser = !!payload.browser
    if (hasAndroid || hasBrowser) {
      const msg = `[useTestCaseDebug] envConfig.android=${JSON.stringify(
        payload.android ?? null
      )} envConfig.browser=${JSON.stringify(
        payload.browser ?? null
      )} base.android=${JSON.stringify(
        (base as any)?.android ?? null
      )} base.browser=${JSON.stringify((base as any)?.browser ?? null)}`
      ;(logger as any).info?.(msg)
    }
  } catch {
    // 日志失败不影响主流程
  }
  const merged: UseTestCaseOptions = { ...base }

  if (payload.browser && base.browser !== false) {
    const existing = merged.browser !== false && merged.browser ? (merged.browser as any) : {}
    merged.browser = { ...existing, ...(payload.browser as any) }
  }
  if (payload.android && base.android !== false) {
    const existing = merged.android !== false && merged.android ? (merged.android as any) : {}
    merged.android = { ...existing, ...(payload.android as any) }
  }

  return merged
}

export function clearBddSuites() {
  rootSuites.length = 0
  suiteStack.length = 0
}

export function getBddRootSuites(): BddSuite[] {
  return rootSuites
}

export function hasFocusedTests(): boolean {
  const walk = (suite: BddSuite): boolean => {
    if (suite.skipped) return false
    if (suite.only) return true
    if (suite.tests.some((t) => t.only)) return true
    return suite.suites.some((child) => walk(child))
  }
  return rootSuites.some((suite) => walk(suite))
}

export function filterOnlyTests() {
  if (!hasFocusedTests()) return
  const walk = (suite: BddSuite): boolean => {
    if (suite.skipped) {
      return false
    }
    if (suite.only) {
      suite.tests = suite.tests.filter((test) => !test.skip)
      suite.suites = suite.suites.filter((child) => walk(child))
      return suite.tests.length > 0 || suite.suites.length > 0
    }
    suite.tests = suite.tests.filter((test) => test.only)
    suite.suites = suite.suites.filter((child) => walk(child))
    return suite.tests.length > 0 || suite.suites.length > 0
  }
  for (let i = rootSuites.length - 1; i >= 0; i--) {
    if (!walk(rootSuites[i]!)) {
      rootSuites.splice(i, 1)
    }
  }
}

type AggregatedHooks = {
  beforeAll: BddTest['fn'][]
  afterAll: BddTest['fn'][]
  beforeEach: BddTest['fn'][]
  afterEach: BddTest['fn'][]
}

type LeafSuite = {
  titles: string[]
  tests: BddTest[]
  hooks: AggregatedHooks
  descriptors: BddTestCaseDescriptor[]
  skipped: boolean
}

const slugify = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || fallback
}

const extractMetadataFromOptions = (opts?: UseTestCaseOptions): Record<string, any> => {
  const meta: Record<string, any> = {}
  if (!opts) return meta
  if (opts.module) meta.module = opts.module
  if (opts.userDir) meta.userDir = opts.userDir
  if (Array.isArray(opts.tags) && opts.tags.length) meta.tags = opts.tags.slice()
  return meta
}

function collectLeafSuites(): LeafSuite[] {
  const roots = getBddRootSuites()
  if (!roots.length) return []
  filterOnlyTests()
  const leaves: LeafSuite[] = []
  const traverse = (suite: BddSuite, ancestors: BddSuite[]) => {
    const path = [...ancestors, suite]
    const skipped = path.some((s) => s.skipped)
    const activeTests = suite.tests.filter((test) => !test.skip)
    if (activeTests.length) {
      const hooks: AggregatedHooks = {
        beforeAll: [],
        afterAll: [],
        beforeEach: [],
        afterEach: [],
      }
      for (const s of path) {
        hooks.beforeAll.push(...s.hooks.beforeAll.map((h) => h.fn))
        hooks.beforeEach.push(...s.hooks.beforeEach.map((h) => h.fn))
      }
      for (const s of [...path].reverse()) {
        hooks.afterAll.push(...s.hooks.afterAll.map((h) => h.fn))
        hooks.afterEach.push(...s.hooks.afterEach.map((h) => h.fn))
      }
      const descriptorSource = [...path].reverse().find((s) => s.testCaseDescriptors.length > 0)
      const descriptors = descriptorSource ? descriptorSource.testCaseDescriptors.slice() : []
      leaves.push({
        titles: path.map((s) => s.title),
        tests: activeTests.slice(),
        hooks,
        descriptors,
        skipped,
      })
    }
    for (const child of suite.suites) {
      traverse(child, path)
    }
  }
  roots.forEach((suite) => traverse(suite, []))
  return leaves
}

function applyTestCaseOptions(ctor: any, options?: UseTestCaseOptions) {
  if (!options) {
    ctor.module = ctor.module ?? 'default'
    return
  }
  ctor.module = options.module ?? ctor.module ?? 'default'
  if (options.browser !== undefined && options.browser !== false) {
    withBrowser(options.browser)(ctor)
  }
  if (options.android !== undefined && options.android !== false) {
    const { installBehavior, bringToFront, ...androidOpts } = options.android
    withAndroid(androidOpts)(ctor)
    if (installBehavior) {
      ctor.__androidInstallBehavior = installBehavior
    }
    if (bringToFront !== undefined) {
      ctor.__androidBringToFront = !!bringToFront
    }
  }
  if (options.actors && typeof options.actors === 'object') {
    withActors({ actors: options.actors, defaultActor: options.defaultActor })(ctor)
  }
  if (options.keepAppOpen !== undefined) {
    ctor.__keepAppOpen = !!options.keepAppOpen
  }
}

export function createBddTestCaseClasses(): Array<
  new (logger: any, clientId: string, workspace: string) => TestCase
> {
  const leaves = collectLeafSuites()
  const classes: Array<new (logger: any, clientId: string, workspace: string) => TestCase> = []
  if (!leaves.length) return classes
  let counter = 0
  for (const leaf of leaves) {
    if (leaf.skipped || leaf.tests.length === 0) continue
    const className = `Bdd_${leaf.titles.map((t) => slugify(t, 'suite')).join('_')}_${counter++}`
    const totalTests = leaf.tests.length
    // Create dynamic subclass of TestCase
    const Dynamic = class extends TestCase {
      private __bddState: {
        beforeAllRun: boolean
        beforeAllError?: unknown
        afterAllRun: boolean
        completed: number
        total: number
      }
      constructor(logger: any, clientId: string, workspace: string) {
        super(logger, clientId, workspace)
        this.__bddState = {
          beforeAllRun: false,
          afterAllRun: false,
          completed: 0,
          total: totalTests,
        }
      }
    }
    Object.defineProperty(Dynamic, 'name', { value: className })
    ;(Dynamic as any).__isBddGenerated = true

    // Apply TestCase options (use closest descriptor options)
    const primaryOptions = leaf.descriptors[0]?.options
    applyTestCaseOptions(Dynamic, primaryOptions)
    const baseMetadata = extractMetadataFromOptions(primaryOptions)
    ;(Dynamic as any).__reportMetadata = baseMetadata

    const descriptors = leaf.descriptors
    const hooks = leaf.hooks

    const setHolders = (instance: any) => {
      for (const descriptor of descriptors) {
        descriptor.holder.current = instance
      }
    }
    const clearHolders = () => {
      for (const descriptor of descriptors) {
        descriptor.holder.current = null
      }
    }
    const runHooks = async (instance: any, fns: Array<BddTest['fn']>) => {
      for (const fn of fns) {
        await fn.call(instance)
      }
    }
    const runHooksSafe = async (instance: any, fns: Array<BddTest['fn']>) => {
      try {
        await runHooks(instance, fns)
        return null
      } catch (err) {
        return err
      }
    }

    leaf.tests.forEach((test, idx) => {
      const methodName = `test_${idx + 1}_${slugify(test.title, 'test')}`
      Object.defineProperty(Dynamic.prototype, methodName, {
        value: async function () {
          const state = (this as any).__bddState as {
            beforeAllRun: boolean
            beforeAllError?: unknown
            afterAllRun: boolean
            completed: number
            total: number
          }
          const suitePath = leaf.titles
          const caseName = [...suitePath, test.title].join(' › ')
          ;(this as any).__beginCase?.(caseName, {
            suitePath,
            testTitle: test.title,
            index: idx,
            ...baseMetadata,
          })
          try {
            await (this as any).__androidEnsureAlive?.()
          } catch (ensureErr) {
            const instLogger = (this as any)?.logger
            instLogger?.warn?.(`android driver ensure-alive failed: ${ensureErr}`)
            throw ensureErr
          }
          setHolders(this)
          let primaryError: unknown = null
          let thrown = false
          let afterEachError: unknown = null
          let afterAllError: unknown = null
          try {
            if (!state.beforeAllRun) {
              const beforeAllError = await runHooksSafe(this, hooks.beforeAll)
              state.beforeAllRun = true
              if (beforeAllError) {
                state.beforeAllError = beforeAllError
                throw beforeAllError
              }
            }
            if (state.beforeAllError) {
              throw state.beforeAllError
            }
            const beforeEachErr = await runHooksSafe(this, hooks.beforeEach)
            if (beforeEachErr) {
              throw beforeEachErr
            }
            await test.fn.call(this)
          } catch (err) {
            primaryError = err
            thrown = true
            throw err
          } finally {
            const afterEachErr = await runHooksSafe(this, hooks.afterEach)
            if (afterEachErr) {
              afterEachError = afterEachErr
            }
            state.completed += 1
            const isLast = state.completed >= state.total
            if (isLast) {
              if (!state.afterAllRun) {
                state.afterAllRun = true
                const afterAllErr = await runHooksSafe(this, hooks.afterAll)
                if (afterAllErr) {
                  afterAllError = afterAllErr
                }
              }
              clearHolders()
            }

            const logger = (this as any)?.logger
            const logHookError = (label: string, err: unknown) =>
              logger?.error?.(
                `${label} hook failed: ${err instanceof Error ? err.message : String(err)}`
              )

            if (afterEachError) {
              logHookError('afterEach', afterEachError)
            }
            if (afterAllError) {
              logHookError('afterAll', afterAllError)
            }

            const finalError = primaryError ?? afterEachError ?? afterAllError ?? undefined
            ;(this as any).__finishCase?.(finalError ? 'failed' : 'passed', finalError)

            if (!thrown && finalError) {
              throw finalError
            }
          }
        },
      })
    })

    classes.push(Dynamic)
  }
  return classes
}

export type ExpectMatcher = {
  toBe(expected: any): void
  toBeTruthy(): void
  toBeDefined(): void
  toHaveProperty(prop: string): void
  not: {
    toBeNull(): void
    toBeUndefined(): void
  }
}

export function expect(actual: any): ExpectMatcher {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`)
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected value to be truthy, got ${actual}`)
      }
    },
    toBeDefined() {
      if (typeof actual === 'undefined') {
        throw new Error('Expected value to be defined')
      }
    },
    toHaveProperty(prop: string) {
      if (actual == null || !(prop in (actual as any))) {
        throw new Error(`Expected object to have property ${String(prop)}`)
      }
    },
    not: {
      toBeNull() {
        if (actual === null) {
          throw new Error('Expected value not to be null')
        }
      },
      toBeUndefined() {
        if (typeof actual === 'undefined') {
          throw new Error('Expected value not to be undefined')
        }
      },
    },
  }
}

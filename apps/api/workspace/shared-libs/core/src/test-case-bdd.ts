import type { TestCase } from './test-case-base'
import type { WithAndroidOptions } from './test-case-decorator'

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
  return new Proxy(
    {} as TestCase,
    {
      get(_target, prop, _receiver) {
        const instance = holder.current
        if (!instance) {
          throw new Error(
            'TestCase instance is not available. Ensure you are accessing it inside a test or hook.',
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
            'TestCase instance is not available. Ensure you are accessing it inside a test or hook.',
          )
        }
        ;(instance as any)[prop] = value
        return true
      },
      has(_target, prop) {
        const instance = holder.current
        return instance ? prop in instance : false
      },
    },
  )
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
  suite.testCaseDescriptors.push({ holder, proxy, options })
  return proxy
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

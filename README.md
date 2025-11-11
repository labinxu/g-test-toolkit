# Turborepo starter

This is a community-maintained example. If you experience a problem, please submit a pull request with a fix. GitHub Issues will be closed.

## Using this example

Run the following command:

```bash
npx create-turbo@latest -e with-nestjs
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

    .
    ├── apps
    │   ├── api                       # NestJS app (https://nestjs.com).
    │   └── web                       # Next.js app (https://nextjs.org).
    └── packages
        ├── @repo/api                 # Shared `NestJS` resources.
        ├── @repo/eslint-config       # `eslint` configurations (includes `prettier`)
        ├── @repo/jest-config         # `jest` configurations
        ├── @repo/typescript-config   # `tsconfig.json`s used throughout the monorepo
        └── @repo/ui                  # Shareable stub React component library.

Each package and application are 100% [TypeScript](https://www.typescriptlang.org/) safe.

### Utilities

This `Turborepo` has some additional tools already set for you:

- [TypeScript](https://www.typescriptlang.org/) for static type-safety
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Jest](https://prettier.io) & [Playwright](https://playwright.dev/) for testing

### Commands

This `Turborepo` already configured useful commands for all your apps and packages.

#### Build

```bash
# Will build all the app & packages with the supported `build` script.
npm run build

# ℹ️ If you plan to only build apps individually,
# Please make sure you've built the packages first.
```

#### Develop

```bash
# Will run the development server for all the app & packages with the supported `dev` script.
npm run dev
```

#### test

```bash
# Will launch a test suites for all the app & packages with the supported `test` script.
npm run test

# You can launch e2e testes with `test:e2e`
npm run test:e2e

# See `@repo/jest-config` to customize the behavior.
```

#### Lint

```bash
# Will lint all the app & packages with the supported `lint` script.
# See `@repo/eslint-config` to customize the behavior.
npm run lint
```

#### Format

```bash
# Will format all the supported `.ts,.js,json,.tsx,.jsx` files.
# See `@repo/eslint-config/prettier-base.js` to customize the behavior.
npm run format
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```bash
npx turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```bash
npx turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
## WebSocket configuration

The Web app (Next.js) streams logs over Socket.IO to the API (NestJS). To avoid connection instability and ease local setup, configure these environment variables:

- Web (.env in `apps/web`)
  - `NEXT_PUBLIC_API_BASE_URL` — Base URL of the API (defaults to `http://localhost:3001`). Used by socket clients to connect to `${BASE}/log`.

- API (.env in `apps/api`)
  - `WS_CORS_ORIGIN` — Allowed origins for Socket.IO CORS.
    - Set to `true` (or `1`, `yes`, `on`, `*`) to allow all (recommended for local dev).
    - Or provide a comma‑separated list: `http://localhost:3000,http://127.0.0.1:3000`.
  - `WS_PING_TIMEOUT_MS` — Optional Socket.IO `pingTimeout` (ms).
  - `WS_PING_INTERVAL_MS` — Optional Socket.IO `pingInterval` (ms).

Examples:

```
# apps/web/.env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# apps/api/.env
WS_CORS_ORIGIN=true
# WS_PING_TIMEOUT_MS=30000
# WS_PING_INTERVAL_MS=25000
```

Notes:
- In development, React Strict Mode may cause double mounting of effects which can print duplicate connect/disconnect logs. This does not occur in production builds.
- The web socket client is configured to prefer `websocket` transport to reduce unnecessary polling/upgrade cycles.

## Android Automation

The backend exposes a core library to author and run Android UI tests via Appium. Use the `withAndroid` decorator to declare the device and app under test.

- Exposed types from `core-lib`:
  - `WithAndroidOptions` — parameters for `withAndroid`
  - `MainOptions` — options for `core.main` (no installMode override)

### Mode selection (auto)

`withAndroid` automatically selects run mode based on provided options:

- Provide `apk` → install mode (installs the APK, then launches)
- Provide `appPackage` (and `appActivity`) without `apk` → launch mode (starts already-installed app)
- Provide both `apk` and `appPackage` → install mode

There is no UI or API override for this behavior; it is derived from the decorator. If required data is missing for the chosen mode, a clear error is thrown.

### Examples

Install mode (APK install + launch):

```ts
import { TestCase, Test, withAndroid } from 'core-lib'

@Test({ module: 'appium' })
@withAndroid({
  deviceName: 'YOUR_DEVICE_NAME',
  udid: 'YOUR_DEVICE_UDID',
  apk: 'your-app.apk', // resolved from `workspace/app` or `APP_DIR`
  // keepAppOpen: true, // optional — app will be reinstalled/reset for this run and not uninstalled after
})
export class InstallSample extends TestCase {
  async test_login() {
    this.logger.info('running in install mode')
    // this.page is an Appium driver
  }
}
```

Launch mode (start an already-installed app):

```ts
import { TestCase, Test, withAndroid } from 'core-lib'

@Test({ module: 'appium' })
@withAndroid({
  deviceName: 'YOUR_DEVICE_NAME',
  udid: 'YOUR_DEVICE_UDID',
  appPackage: 'com.example.app',
  appActivity: '.MainActivity',
  // keepAppOpen: true, // optional
})
export class LaunchSample extends TestCase {
  async test_smoke() {
    this.logger.info('running in launch mode')
  }
}
```

Optional behaviors (WithAndroidOptions):

- `keepAppOpen?: boolean` — keep Appium session after run (default true)
- `bringToFront?: boolean` — bring app to foreground after session create/reuse (default true)

### Notes

- APK location: by default `workspace/app/<apk>`. You can set `APP_DIR` to point to a different directory if needed.
- Keep app open: set `keepAppOpen: true` in the decorator, or pass `keepAppOpen: true` to the `/api/testcase/runpath` body to retain the Appium session after run.
- Session reuse: `/api/testcase/runpath` also accepts `shareSession: true` and a `sessionKey` to reuse a driver across runs.
- Clear error messages: if launch mode is selected but `appPackage/appActivity` are missing, or install mode is selected without `apk`, the runner throws an explicit error.

### Find Package/Activity (ADB)

Common ADB commands to discover the Android package name and main Activity for use with `withAndroid({ appPackage, appActivity })`:

- Verify device connection

  ```bash
  adb devices
  ```

- Find installed packages (filter by keyword)

  ```bash
  adb shell pm list packages | grep gettr
  # -> e.g. package:com.gettr.gettr
  ```

- Get the current foreground app (package and activity) while the app is open

  ```bash
  # Works on most devices
  adb shell dumpsys window | grep -E "mCurrentFocus|mFocusedApp"

  # Alternative (some ROMs)
  adb shell dumpsys activity activities | grep mResumedActivity
  ```

- Resolve the launchable (MAIN/LAUNCHER) activity for a package

  ```bash
  adb shell cmd package resolve-activity \
    -a android.intent.action.MAIN \
    -c android.intent.category.LAUNCHER \
    com.gettr.gettr
  # -> com.gettr.gettr/.MainActivity
  ```

- From an APK file (if available), extract package and launchable activity

  ```bash
  # Requires Android build-tools 'aapt' to be available
  aapt dump badging ./apps/api/workspace/app/gettr-1.74.3.apk \
    | grep -E "^package: name=|^launchable-activity: name="
  # package: name='com.gettr.gettr' ...
  # launchable-activity: name='.MainActivity' ...
  ```

- Sanity check: trigger the app’s launcher activity (no-op if not installed)

  ```bash
  adb shell monkey -p com.gettr.gettr -c android.intent.category.LAUNCHER 1
  ```

### Allure 集成（报告）

- 适用范围
  - API（NestJS）内置的测试运行器会在每次执行后生成 HTML 与 JSON 报告；现已新增可选的 Allure 结果输出，不会影响现有功能。
  - 只在存在 `allure-js-commons` 时启用（可选依赖检测）。`apps/api` 已带有 `allure-mocha`（会带入 `allure-js-commons`），通常无需额外安装即可工作。

- 结果目录
  - 执行后会在对应用户目录生成 `allure-results`：
    - `apps/api/workspace/users/<user>/allure-results`
    - HTML/JSON 仍写入：`apps/api/workspace/users/<user>/reports`

- 本地查看 Allure 报告
  - 安装 Allure CLI（任选其一）：
    - Homebrew（macOS）：`brew install allure`
    - NPM（跨平台）：`npm i -D allure-commandline && npx allure --version`
  - 生成与打开：
    - 以本地用户 `labin` 为例：
      - 生成：`allure generate --clean apps/api/workspace/users/labin/allure-results -o apps/api/workspace/users/labin/allure-report`
      - 打开：`allure open apps/api/workspace/users/labin/allure-report`

- NPM 脚本（推荐）
  - 生成：`npm run allure:gen -- <user>` 例：`npm run allure:gen -- labin`
  - 打开：`npm run allure:open -- <user>` 例：`npm run allure:open -- labin`
  - 清理：`npm run allure:clean -- <user>`（仅删除生成的 `allure-report` 目录）

- 内容说明
  - 每个用例会写入 Allure 的测试结果（状态、耗时、错误信息）。
  - 截图等产物会作为附件写入（PNG/JPEG 自动识别，其它以文本写入）。
  - `suite` 标签根据 BDD 元数据（`suitePath`）自动设置，便于在 Allure UI 中分组浏览。

- 关闭/禁用
  - 若未安装 `allure-js-commons`，Allure 输出将自动跳过，不影响现有 HTML 报告。

## Traceability（需求 ⇄ 测试）

- 页面：`/traceability`（Web 应用内）支持录入需求、建立映射、自动建议与导出（TestRail/Xray）。
- 测试报告中的 `metadata.tags` 支持 `REQ:<SYSTEM>:<KEY>` 语法，可用于“建议映射”。
- 文档：
  - docs/traceability/feature-follow-notify.md
  - docs/traceability/feature-traceability-template.md

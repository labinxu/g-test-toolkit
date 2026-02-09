# Project Context

## Purpose
`g-test-toolkit` is a TypeScript monorepo for building a test-management + automation toolkit:
- A backend API that stores and orchestrates test cases, user scenarios, traceability mappings, reports, and test assets.
- A web dashboard (Next.js) for managing and running test-related workflows (e.g. route configs, scenarios, test cases).
- Supporting scripts that generate/normalize test artifacts (endpoints, web ids, page objects, reports).

## Tech Stack
- Language/runtime: TypeScript, Node.js (`>=18`), `npm` workspaces (root `packageManager`: `npm@11.5.1`)
- Monorepo tooling: Turborepo (`turbo run dev|build|test|test:e2e|lint`)
- Backend (`apps/api`):
  - NestJS (`@nestjs/*`) on Fastify (`@nestjs/platform-fastify`, `fastify@5`)
  - OpenAPI docs via Swagger (`@nestjs/swagger`) at `/api-docs`
  - WebSockets/log streaming via Socket.IO (`socket.io`, `@nestjs/platform-socket.io`)
  - Persistence: TypeORM + SQLite (`typeorm`, `sqlite3`), local DB file `database/auth_db.sqlite`
  - Auth: Passport + JWT (`passport`, `@nestjs/passport`, `@nestjs/jwt`)
  - Automation/tooling deps (used by backend features): Appium/WebdriverIO, Puppeteer(+extra/stealth), Allure/Mocha
  - Infra integrations (optional depending on env): Redis (`redis`, `ioredis`), email (`resend`)
- Frontend (`apps/web`):
  - Next.js (`next@^16`) + React (`react@^19`) with App Router (`apps/web/src/app`)
  - Tailwind CSS (`tailwindcss@^4`) + Radix UI components
  - State/data: TanStack React Query, Zustand
  - Validation/forms: Zod, react-hook-form
  - Editors: Monaco + CodeMirror

## Project Conventions

### Code Style
- Formatting: Prettier (root `.prettierrc.js` delegates to `@repo/eslint-config/prettier-base.js`; currently `singleQuote: true`)
- Linting: ESLint via shared configs in `packages/eslint-config/`
  - Root `.eslintrc.js` applies only to the package-manager root; app/package-specific lint configs live inside each workspace.
- TypeScript configs are shared from `packages/typescript-config/` and extended from root `tsconfig.json`.

### Architecture Patterns
- Monorepo layout:
  - `apps/api`: NestJS backend (Fastify) organized by domain modules (e.g. `auth/`, `test-cases/`, `user-scenarios/`, `traceability/`).
  - `apps/web`: Next.js dashboard (App Router) with server routes rewrites/proxying for backend APIs.
  - `packages/*`: shared configs and libraries (`@repo/api`, `@repo/ui`, eslint/jest/ts configs).
  - `routes-configs/*.json`: per-project route configuration artifacts managed by the web UI.
  - `scripts/*`: generators and helpers (endpoint generation, web id normalization, Allure helpers).
- Backend patterns:
  - NestJS modules + services + controllers per domain.
  - TypeORM entities for persisted objects; current dev DB is SQLite (`database/auth_db.sqlite`).
  - Swagger/OpenAPI for API discovery; validation via Nest `ValidationPipe` + `class-validator`.
- Frontend patterns:
  - Next.js rewrites proxy most `/api/*` calls to `BACK_SERVER_API_URL`, while keeping some routes handled in-app (see `apps/web/next.config.ts`).
  - UI uses Tailwind + Radix + small client-side state stores (Zustand) and server data caching (React Query).

### Testing Strategy
- Repo-level test entry point: `npm run test` / `npm run test:e2e` (delegates to Turborepo task graph).
- Backend (`apps/api`):
  - Unit/integration testing via Jest (`npm run test`)
  - E2E via Jest config `apps/api/test/jest-e2e.json` (`npm run test:e2e`)
- Automation/reporting tooling present in the backend includes: Mocha + Allure, Puppeteer, Appium/WebdriverIO (usage varies by feature).

### Git Workflow
- Not yet codified in-repo. If you want strict conventions (branch naming, PR requirements, commit format), add them here so assistants can follow them.

## Domain Context
Key concepts (based on backend module/entity naming):
- **Test Case**: a runnable test definition, stored and reported on by the backend.
- **User Scenario**: higher-level user journey described as steps; can be mapped to actions/pages/elements.
- **Traceability**: mapping from requirements → test coverage (`Requirement`, `ReqTestMap` entities).
- **Actors**: environment + identity data used when running scenarios/tests.
- **Route Configs**: JSON route inventories (e.g. exported from a legacy frontend) used to generate/manage page-object libraries and navigation maps.

## Important Constraints
- Node.js `>=18`
- Local dev database: SQLite file `database/auth_db.sqlite` (TypeORM `synchronize: true` in `apps/api/src/app.module.ts`)
- Backend CORS defaults to localhost origins; large request bodies are supported in API and Next proxying (see `apps/api/src/main.ts`, `apps/web/next.config.ts`)
- Network access from this repo may be restricted in some environments; prefer deterministic, local workflows (Turborepo tasks, generators).

## External Dependencies
- Redis (optional; `redis` / `ioredis`)
- Email (Resend, optional)
- Appium/WebdriverIO/Puppeteer (automation runtimes used by some features)
- Allure (report generation via `scripts/allure.js`)

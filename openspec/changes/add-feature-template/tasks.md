## 1. Proposal Checklist
- [ ] Confirm feature name, primary user, and success criteria
- [ ] Confirm affected capability id(s) under `openspec/specs/`
- [ ] Confirm whether any breaking changes exist

## 2. Implementation
- [ ] Backend: add/modify endpoints in `apps/api`
- [ ] Backend: update persistence (TypeORM entities / migrations approach)
- [ ] Frontend: add/modify UI in `apps/web`
- [ ] Shared: update any shared types/libs in `packages/*` if needed

## 3. Tests
- [ ] Add/update unit tests (Jest) for changed backend logic
- [ ] Add/update e2e tests (Jest e2e) if applicable
- [ ] Validate manual flows in the web UI if applicable

## 4. Docs / Ops
- [ ] Update `README.md` or in-app docs if needed
- [ ] Document required env vars (apps/web `.env`, apps/api `.env`)


---
name: wails-feature
description: Guide for adding new Wails-bound features across Go backend and React frontend, following the project's established data flow pattern
---

# Wails Feature Workflow

When adding a new feature that spans backend and frontend, follow these steps in order:

## 1. Go Models (`models.go`)
- Add or update structs for any new data types
- Use `json:"camelCase"` tags matching the frontend conventions

## 2. Go Backend Logic (`app.go`)
- Add methods to the `App` struct
- Methods must be exported (capitalized) to be available as Wails bindings
- Use `a.store` for persistence and `a.executor` for command execution
- Follow existing patterns: return `(Type, error)` for creates/updates, `error` for deletes

## 3. Regenerate TypeScript Bindings
Run:
```bash
wails generate module
```
This updates `frontend/wailsjs/go/main/App.ts` and `App.d.ts` with the new method signatures.

## 4. TypeScript Types (`frontend/src/types.ts`)
- Add or update interfaces to mirror the Go structs from step 1
- Keep field names in camelCase matching the JSON tags

## 5. React Components
- Import the generated binding: `import { MyMethod } from '../wailsjs/go/main/App'`
- If adding a modal, extend the `ModalState` discriminated union in `App.tsx`
- Add handler functions in `App.tsx` following existing patterns
- Create or update components in `frontend/src/components/`
- Use shadcn/ui components from `@/components/ui/` and Lucide icons
- Add any user-facing strings as i18n keys in `frontend/src/locales/en.json` and use `t('key')`

## Checklist
- [ ] Go struct added/updated in `models.go`
- [ ] App method added in `app.go`
- [ ] Bindings regenerated (`wails generate module`)
- [ ] TypeScript interface updated in `types.ts`
- [ ] React component created/updated
- [ ] i18n keys added to `locales/en.json`

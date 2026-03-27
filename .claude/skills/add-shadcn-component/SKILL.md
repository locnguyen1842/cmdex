---
name: add-shadcn-component
description: Add a new shadcn/ui component using the project's configured style and path aliases
disable-model-invocation: true
---

# Add shadcn/ui Component

Add a new shadcn/ui component to the project. Run from the `frontend/` directory:

```bash
cd frontend && pnpm dlx shadcn@latest add <component-name>
```

## Project Configuration
- **Style**: new-york
- **Base color**: neutral
- **Icon library**: lucide
- **CSS variables**: enabled
- **RSC**: disabled (not a Next.js project)
- **Components path**: `src/components/ui/`
- **Utils path**: `src/lib/utils.ts`

## Path Aliases
- `@/components` → `src/components`
- `@/components/ui` → `src/components/ui`
- `@/lib` → `src/lib`
- `@/hooks` → `src/hooks`

## After Adding
- Import using the alias: `import { Button } from '@/components/ui/button'`
- The component will use Tailwind CSS v4 with CSS variables for theming
- Customize colors via CSS variables in `src/style.css`, not by hardcoding values

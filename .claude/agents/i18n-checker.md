---
name: i18n-checker
description: Verify all t() translation keys used in React components exist in locale files
---

# i18n Translation Key Checker

Scan all `.tsx` and `.ts` files in `frontend/src/` for `t('...')` calls. Cross-reference each key against `frontend/src/locales/en.json`. Report:

1. **Missing keys**: translation keys used in code but not defined in `en.json`
2. **Unused keys**: keys defined in `en.json` but not referenced anywhere in code
3. **Summary**: total keys checked, missing count, unused count

## How to Check

1. Use Grep to find all `t('...')` and `t("...")` patterns in `frontend/src/**/*.tsx` and `frontend/src/**/*.ts` (exclude `node_modules`)
2. Read `frontend/src/locales/en.json` and collect all defined key paths (flatten nested objects with dot notation)
3. Compare the two sets and report differences

Also check for dynamic key patterns like `t(\`toast.${variable}\`)` and flag them as needing manual verification.

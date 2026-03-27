<!-- Resolved: 2026-03-27 | Plan: docs/superpowers/plans/2026-03-27-fix-preset-preview.md -->

- The copy on the preview (under preset selected) was break, and render not meet the requirements
  - example: command = `echo "Hello {{name}}"` | preset: name = `Loco`
  - The current preview block show only preset variables -> name=Loco
  - The expectation preview block should show: `echo "Hello Loco"` -> also the copy button should copy with preset filled too
- the command execution Output was broke, currently it show `bash <script> name=Loco` -> It should show the cli command `echo "Hello Loco"` instead (or can show command title)
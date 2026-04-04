<!-- Resolved: 2026-04-02 | Plan: docs/superpowers/plans/2026-04-01-ui-polish-fixes.md -->

- there are a bug, the preset preview command must replace the placeholder with actual values from current preset instead only hightlight
- Remove header (status-bar)
- Revampt the command tags visibility (currently it show same line with command title which is got stripped when title is long), should show in 2nd lines or something else
- in next to setting icon in left header panel, add info incon that show popup to show all shortcuts hint
- Revamp manager presets and preset selection section (currently it so difficult to use because the selection so small) - give me some options to revamp it for quicker action
- Make output section vertical resizable
- Remove feature that can run command directly in Command Palette - should show Command's command cli in attractive color/session, also show description of the command
- BIG CHANGE: i'm thinking about to revamp the create/udate command UI, i want to make it more like text editor so there are some dedicated sections which show specifiec fields: (so New Command now will create new tab with empty fields instead of showing popup form)
  - Title
  - tags
  - description 
  - Script/Command (can use same as current ui for the preview but can edit directly, something like html contenteditable)
  - Manage Presets 
    - Now remove select options items list, let show as a `box` (eg: [Preset 1]     [Preset 2]), when user click to the box then app will select that as current selected preset
    - when selected preset so the pattern and their values same as now (but can edit directly in value section when click on the value element)
    - the pattern can clickable and show the popup form to update their name or default values

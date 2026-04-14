import { GetEventNames } from '../../wailsjs/go/main/App';

export const events = {
    cmdOutput: 'cmd-output',
    openSettings: 'open-settings',
    settingsChanged: 'settings-changed',
    settingsWindowHiding: 'settings-window-hiding',
};

export async function initEventNames(): Promise<void> {
    const names = await GetEventNames();
    events.cmdOutput = names.cmdOutput;
    events.openSettings = names.openSettings;
    events.settingsChanged = names.settingsChanged;
    events.settingsWindowHiding = names.settingsWindowHiding;
}
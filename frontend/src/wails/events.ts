import { GetEventNames } from '../../wailsjs/go/main/App';

export const eventNames = {
    cmdOutput: 'cmd-output',
    openSettings: 'open-settings',
    settingsChanged: 'settings-changed',
    settingsWindowClosing: 'settings-window-closing',
};

export async function initEventNames(): Promise<void> {
    const names = await GetEventNames();
    eventNames.cmdOutput = names.cmdOutput;
    eventNames.openSettings = names.openSettings;
    eventNames.settingsChanged = names.settingsChanged;
    eventNames.settingsWindowClosing = names.settingsWindowClosing;
}
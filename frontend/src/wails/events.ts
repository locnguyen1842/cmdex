import { toast } from 'sonner';

export const eventNames = {
    cmdOutput: 'cmd-output',
    openSettings: 'open-settings',
    settingsChanged: 'settings-changed',
    settingsWindowClosing: 'settings-window-closing',
};

export async function initEventNames(): Promise<void> {
    try {
        const { GetEventNames } = await import('../../bindings/cmdex/eventservice');
        const names = await GetEventNames();
        eventNames.cmdOutput = names.cmdOutput;
        eventNames.openSettings = names.openSettings;
        eventNames.settingsChanged = names.settingsChanged;
        eventNames.settingsWindowClosing = names.settingsWindowClosing;
    } catch (err) {
        console.error('Failed to init event names:', err);
        toast.error('Failed to initialize events. Using fallback event names.');
    }
}
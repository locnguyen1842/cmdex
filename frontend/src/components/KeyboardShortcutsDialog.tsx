import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS, shortcutLabel } from '@/lib/shortcuts';

const SHORTCUT_GROUPS = [
  {
    label: 'Navigation',
    items: [
      { keys: [shortcutLabel('palette')], description: 'Command Palette' },
      { keys: [shortcutLabel('nextTab')], description: 'Next tab' },
      { keys: [shortcutLabel('prevTab')], description: 'Previous tab' },
      { keys: [shortcutLabel('prevOpenedTab')], description: 'Previous opened tab' },
      { keys: [shortcutLabel('closeTab')], description: 'Close tab' },
    ],
  },
  {
    label: 'Commands',
    items: [
      { keys: [shortcutLabel('execute')], description: 'Run command' },
      { keys: [shortcutLabel('save')], description: 'Save command' },
      { keys: [shortcutLabel('newCommand')], description: 'New command' },
    ],
  },
  {
    label: 'App',
    items: [
      { keys: [shortcutLabel('settings')], description: 'Settings' },
      { keys: [shortcutLabel('shortcuts')], description: 'Keyboard Shortcuts' },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('common.keyboardShortcuts')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </div>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.description} className="flex items-center justify-between py-1">
                    <span className="text-sm">{item.description}</span>
                    <span className="flex gap-1">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

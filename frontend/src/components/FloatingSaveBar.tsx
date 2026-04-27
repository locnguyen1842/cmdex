import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';

export interface FloatingSaveBarProps {
  visible: boolean;
  saveDisabled?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

const FloatingSaveBar: React.FC<FloatingSaveBarProps> = ({
  visible,
  saveDisabled,
  onSave,
  onDiscard,
}) => {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <div className="floating-save-bar" role="toolbar" aria-label={t('commandEditor.saveChanges')} data-testid="floating-save-bar">
      <div className="floating-save-group">
        <Button type="button" variant="ghost" size="sm" className="floating-save-btn-discard" onClick={onDiscard} data-testid="save-bar-discard">
          <X className="size-4" />
          {t('commandEditor.discard')}
        </Button>
        <div className="floating-save-separator" />
        <Button type="button" variant="ghost" size="sm" className="floating-save-btn-save" onClick={onSave} disabled={saveDisabled} data-testid="save-bar-save">
          <Save className="size-4" />
          {t('commandEditor.save')}
        </Button>
      </div>
    </div>
  );
};

export default FloatingSaveBar;

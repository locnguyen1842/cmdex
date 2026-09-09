import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

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
      <div className="save-bar-msg">
        <span className="save-bar-dot" />
        {t('commandDetail.unsavedChanges')}
      </div>
      <div className="save-bar-spacer" />
      <Button type="button" variant="ghost" size="sm" className="save-bar-btn-discard" onClick={onDiscard} data-testid="save-bar-discard">
        {t('commandEditor.discard')}
      </Button>
      <Button type="button" variant="default" size="sm" className="save-bar-btn-save" onClick={onSave} disabled={saveDisabled} data-testid="save-bar-save">
        <Save className="size-3.5" />
        {t('commandEditor.save')}
      </Button>
    </div>
  );
};

export default FloatingSaveBar;

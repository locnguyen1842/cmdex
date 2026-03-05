import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Category } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';

const COLORS = [
  '#7c6aef', '#f87272', '#36d399', '#fbbd23', '#66d9ef',
  '#ff79c6', '#f1fa8c', '#bd93f9', '#ff6e6e', '#50fa7b',
  '#8be9fd', '#ffb86c', '#6272a4', '#ff55a3', '#69ff94',
];

interface CategoryEditorProps {
  category?: Category;
  onSave: (data: { name: string; color: string }) => void;
  onCancel: () => void;
}

const CategoryEditor: React.FC<CategoryEditorProps> = ({
  category,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || COLORS[0]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? t('categoryEditor.editCategory') : t('categoryEditor.newCategory')}</DialogTitle>
          <DialogDescription className="sr-only">
            {category ? t('categoryEditor.editCategoryDesc') : t('categoryEditor.createCategoryDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">{t('categoryEditor.name')}</Label>
            <Input
              id="cat-name"
              placeholder={t('categoryEditor.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>{t('categoryEditor.color')}</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`size-7 rounded-full border-2 flex items-center justify-center transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  type="button"
                >
                  {color === c && <Check className="size-3.5 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>{t('categoryEditor.cancel')}</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {category ? t('categoryEditor.save') : t('categoryEditor.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryEditor;

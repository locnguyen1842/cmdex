import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface HoverActionButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

/** Shown inside a .hover-actions-host; visible when host is hovered */
export const HoverActionButton: React.FC<HoverActionButtonProps> = ({
  label,
  onClick,
  className = '',
}) => (
  <Button
    type="button"
    variant="outline"
    size="sm"
    className={`hover-action-btn ${className}`.trim()}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
  >
    <Plus className="size-3.5 shrink-0" />
    <span>{label}</span>
  </Button>
);

export default HoverActionButton;

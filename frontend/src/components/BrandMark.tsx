import React from 'react';
import { Terminal } from 'lucide-react';

interface BrandMarkProps {
  /** Outer square size in px; the glyph scales with it. */
  size?: number;
  className?: string;
}

/**
 * The Cmdex mark from the design: a rounded brand-gradient square with a
 * white terminal-prompt glyph. Used by the sidebar header, the collapsed
 * sidebar rail and the welcome tab so the app shows one logo everywhere.
 */
const BrandMark: React.FC<BrandMarkProps> = ({ size = 20, className }) => (
  <span
    className={`brand-mark${className ? ` ${className}` : ''}`}
    style={{ width: size, height: size, borderRadius: Math.max(5, Math.round(size * 0.28)) }}
    aria-hidden="true"
  >
    <Terminal className="brand-mark-icon" size={Math.round(size * 0.62)} strokeWidth={1.9} />
  </span>
);

export default BrandMark;

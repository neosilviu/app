/**
 * SEARCH DIALOG WRAPPER - Manages global search modal with keyboard shortcut
 * Enterprise Level 8: Cmd+K / Ctrl+K to open search
 */

import { useEffect, useState } from 'react';
import SearchPanel from './SearchPanel';

export default function SearchDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }

      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <SearchPanel
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    />
  );
}

import { useEffect, useCallback } from 'react';

type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description: string;
  enabled?: boolean;
}

const registeredShortcuts: Map<string, Shortcut> = new Map();

function shortcutId(s: Shortcut) {
  return `${s.ctrl || s.meta ? 'Cmd+' : ''}${s.shift ? 'Shift+' : ''}${s.alt ? 'Alt+' : ''}${s.key.toUpperCase()}`;
}

export function getRegisteredShortcuts(): { id: string; description: string }[] {
  return Array.from(registeredShortcuts.entries()).map(([id, s]) => ({ id, description: s.description }));
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const s of shortcuts) {
      if (s.enabled === false) continue;
      const mod = s.ctrl || s.meta;
      const modPressed = e.ctrlKey || e.metaKey;
      if (s.key === e.key.toLowerCase() && (!mod || modPressed) && (!s.shift || e.shiftKey) && (!s.alt || e.altKey)) {
        e.preventDefault();
        e.stopPropagation();
        s.handler();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    shortcuts.forEach(s => registeredShortcuts.set(shortcutId(s), s));
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      shortcuts.forEach(s => registeredShortcuts.delete(shortcutId(s)));
    };
  }, [handleKeyDown, shortcuts]);
}

export function useCommandPalette() {
  const toggle = useCallback(() => {
    window.dispatchEvent(new CustomEvent('command-palette:toggle'));
  }, []);

  return { open: toggle };
}

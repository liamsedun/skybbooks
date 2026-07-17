import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'skybooks-recent-activity';
const MAX_ITEMS = 10;

interface RecentActivityItem {
  id: string;
  path: string;
  label: string;
  timestamp: number;
}

function load(): RecentActivityItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useRecentActivity() {
  const [items, setItems] = useState<RecentActivityItem[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addActivity = useCallback((item: Omit<RecentActivityItem, 'timestamp'>) => {
    setItems(prev => {
      const filtered = prev.filter(i => i.id !== item.id);
      return [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
    });
  }, []);

  const clearActivity = useCallback(() => {
    setItems([]);
  }, []);

  return { items, addActivity, clearActivity };
}

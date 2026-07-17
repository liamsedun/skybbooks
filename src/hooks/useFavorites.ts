import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'skybooks-favorites';

export interface FavoriteItem {
  id: string;
  path: string;
  label: string;
  icon?: string;
}

function loadFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(loadFavorites);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const isFavorite = useCallback((id: string) => {
    return favorites.some(f => f.id === id);
  }, [favorites]);

  const toggleFavorite = useCallback((item: FavoriteItem) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.id === item.id);
      if (exists) return prev.filter(f => f.id !== item.id);
      return [...prev, item];
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  }, []);

  return { favorites, isFavorite, toggleFavorite, removeFavorite };
}

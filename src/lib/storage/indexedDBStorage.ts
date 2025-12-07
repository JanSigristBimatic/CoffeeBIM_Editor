/**
 * IndexedDB Storage Adapter für Zustand persist Middleware
 *
 * Verwendet idb-keyval für einfachen Key-Value Zugriff auf IndexedDB.
 * Unterstützt große Datenmengen (im Gegensatz zu LocalStorage's 5MB Limit).
 */

import { get, set, del, createStore } from 'idb-keyval';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

// Eigener Store für CoffeeBIM (separiert von anderen Apps)
const coffeeBimStore = createStore('coffeebim-db', 'coffeebim-store');

/**
 * Erstellt einen Zustand-kompatiblen Storage Adapter für IndexedDB
 */
export function createIndexedDBStorage<T>(): PersistStorage<T> {
  return {
    getItem: async (name: string): Promise<StorageValue<T> | null> => {
      try {
        const value = await get<StorageValue<T>>(name, coffeeBimStore);
        console.log(`[CoffeeBIM Storage] getItem(${name}):`, value ? 'Daten gefunden' : 'Keine Daten');
        return value ?? null;
      } catch (error) {
        console.error(`[CoffeeBIM Storage] getItem Fehler:`, error);
        return null;
      }
    },

    setItem: async (name: string, value: StorageValue<T>): Promise<void> => {
      try {
        await set(name, value, coffeeBimStore);
        console.log(`[CoffeeBIM Storage] setItem(${name}): Gespeichert`);
      } catch (error) {
        console.error(`[CoffeeBIM Storage] setItem Fehler:`, error);
      }
    },

    removeItem: async (name: string): Promise<void> => {
      await del(name, coffeeBimStore);
    },
  };
}

/**
 * Fordert persistenten Speicher an, um Storage Eviction zu verhindern.
 * Sollte beim App-Start aufgerufen werden.
 *
 * @returns true wenn persistenter Speicher gewährt wurde
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    if (isPersisted) {
      console.log('[CoffeeBIM] Persistenter Speicher aktiviert');
    } else {
      console.warn('[CoffeeBIM] Persistenter Speicher nicht gewährt - Daten könnten bei Speicherknappheit gelöscht werden');
    }
    return isPersisted;
  }
  console.warn('[CoffeeBIM] Storage API nicht verfügbar');
  return false;
};

/**
 * Prüft den aktuellen Speicherverbrauch
 */
export const getStorageEstimate = async (): Promise<{ used: number; quota: number } | null> => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    };
  }
  return null;
};

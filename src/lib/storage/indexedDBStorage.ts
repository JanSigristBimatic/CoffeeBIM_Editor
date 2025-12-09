/**
 * IndexedDB Storage Adapter für Zustand persist Middleware
 *
 * Verwendet idb-keyval für einfachen Key-Value Zugriff auf IndexedDB.
 * Unterstützt große Datenmengen (im Gegensatz zu LocalStorage's 5MB Limit).
 */

import { get, set, del, clear, createStore } from 'idb-keyval';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { storageLogger as logger } from '@/lib/utils/logger';

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
        logger.log(`getItem(${name}):`, value ? 'Daten gefunden' : 'Keine Daten');
        return value ?? null;
      } catch (error) {
        logger.error(`getItem Fehler:`, error);
        return null;
      }
    },

    setItem: async (name: string, value: StorageValue<T>): Promise<void> => {
      try {
        await set(name, value, coffeeBimStore);
        logger.log(`setItem(${name}): Gespeichert`);
      } catch (error) {
        logger.error(`setItem Fehler:`, error);
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
      logger.log('Persistenter Speicher aktiviert');
    } else {
      logger.warn('Persistenter Speicher nicht gewahrt - Daten konnten bei Speicherknappheit geloscht werden');
    }
    return isPersisted;
  }
  logger.warn('Storage API nicht verfugbar');
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

/**
 * Löscht alle Daten aus der CoffeeBIM IndexedDB
 * ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!
 */
export const clearDatabase = async (): Promise<void> => {
  try {
    await clear(coffeeBimStore);
    logger.log('IndexedDB gelöscht');
  } catch (error) {
    logger.error('clearDatabase Fehler:', error);
    throw error;
  }
};

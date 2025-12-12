/**
 * Hydration Tracker für Zustand Stores
 *
 * Dieses Modul trackt den Hydration-Status verschiedener Stores,
 * um Race Conditions bei der Initialisierung zu vermeiden.
 *
 * Separate Datei um zirkuläre Imports zu vermeiden.
 */

type HydrationCallback = () => void;

interface HydrationState {
  project: boolean;
  elements: boolean;
}

const state: HydrationState = {
  project: false,
  elements: false,
};

const callbacks: HydrationCallback[] = [];

function checkAllHydrated() {
  if (state.project && state.elements) {
    console.log('[CoffeeBIM] Alle Stores hydriert');
    callbacks.forEach((cb) => cb());
    // Clear callbacks after executing
    callbacks.length = 0;
  }
}

export function setProjectHydrated() {
  state.project = true;
  console.log('[CoffeeBIM] Project Store hydriert');
  checkAllHydrated();
}

export function setElementsHydrated() {
  state.elements = true;
  console.log('[CoffeeBIM] Element Store hydriert');
  checkAllHydrated();
}

export function isAllHydrated(): boolean {
  return state.project && state.elements;
}

export function onAllHydrated(callback: HydrationCallback) {
  if (isAllHydrated()) {
    callback();
  } else {
    callbacks.push(callback);
  }
}

/**
 * Reset für Tests
 */
export function resetHydrationState() {
  state.project = false;
  state.elements = false;
  callbacks.length = 0;
}

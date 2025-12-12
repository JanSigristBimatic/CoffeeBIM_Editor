/**
 * PRO Mode Types
 *
 * Type definitions for advanced PRO mode modules (Fire Safety, Cleaning/FM)
 */

export type ModuleId = 'fire-safety' | 'cleaning';

export interface ProModule {
  id: ModuleId;
  name: string;
  description: string;
  enabled: boolean;
  icon: string; // Lucide icon name
}

/**
 * Fire Safety Data (IFC Property Sets)
 *
 * Based on:
 * - Pset_SpaceFireSafetyRequirements (IFC 4.3)
 * - Pset_WallCommon.FireRating
 * - Pset_DoorCommon.FireRating
 */
export interface FireSafetyData {
  // Pset_SpaceFireSafetyRequirements
  fireRiskFactor?: 'Low' | 'Medium' | 'High';
  flammableStorage?: boolean;
  isFireExit?: boolean;
  hasSprinklers?: boolean;
  autoSprinklers?: boolean;
  airPressurized?: boolean;

  // Pset_WallCommon / Pset_DoorCommon
  fireRating?: 'REI30' | 'REI60' | 'REI90' | 'REI120' | 'REI180' | 'REI240';
  combustible?: boolean;
}

/**
 * Cleaning classification with performance rates
 * Based on LfL Bayern Plandaten and Gebäudereiniger-Handwerk standards
 */
export type CleaningClassification = 'High' | 'Medium' | 'Low' | 'Special';

export type CleaningFrequency = 'Mehrmals täglich' | 'Täglich' | 'Wöchentlich' | 'Monatlich';

/**
 * Performance rates in m²/h per classification
 * Source: LfL Bayern Plandaten, Gebäudereiniger-Handwerk
 */
export const CLEANING_PERFORMANCE_RATES: Record<CleaningClassification, number> = {
  High: 116,    // Küche/Gastronomie (HACCP-Standard)
  Medium: 140,  // Gastraum, Bar
  Low: 160,     // Lager, Technik
  Special: 65,  // Sanitär (höherer Aufwand)
};

/**
 * Frequency multiplier for monthly calculations
 * How many cleanings per month for each frequency
 */
export const CLEANING_FREQUENCY_PER_MONTH: Record<CleaningFrequency, number> = {
  'Mehrmals täglich': 90, // 3x täglich × 30 Tage
  'Täglich': 30,          // 1x täglich × 30 Tage
  'Wöchentlich': 4,       // 1x wöchentlich × 4 Wochen
  'Monatlich': 1,         // 1x monatlich
};

/**
 * Default hourly rates for cost calculation (CHF)
 */
export const DEFAULT_CLEANING_HOURLY_RATE = 35; // CHF/h

/**
 * Cleaning/Facility Management Data
 *
 * Custom property set: Pset_SpaceCleaningRequirements
 */
export interface CleaningData {
  classification: CleaningClassification;
  frequency: CleaningFrequency;
  /** Calculated or manually adjusted duration per cleaning (minutes) */
  durationMinutes: number;
  /** Whether duration was manually set (true) or auto-calculated (false) */
  manualDuration?: boolean;
  specialRequirements?: string;
  cleaningZone?: string;
  /** Hourly rate for cost calculation (CHF/h) */
  hourlyRate?: number;
}

/**
 * Calculate cleaning duration based on area and classification
 * Formula: (area in m² / performance rate in m²/h) × 60 = minutes
 */
export function calculateCleaningDuration(
  areaM2: number,
  classification: CleaningClassification
): number {
  const rate = CLEANING_PERFORMANCE_RATES[classification];
  const minutes = (areaM2 / rate) * 60;
  return Math.round(minutes * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate monthly cleaning cost
 * Formula: (duration/60) × hourlyRate × frequencyPerMonth
 */
export function calculateMonthlyCost(
  durationMinutes: number,
  frequency: CleaningFrequency,
  hourlyRate: number = DEFAULT_CLEANING_HOURLY_RATE
): number {
  const hours = durationMinutes / 60;
  const timesPerMonth = CLEANING_FREQUENCY_PER_MONTH[frequency];
  return Math.round(hours * hourlyRate * timesPerMonth * 100) / 100;
}

/**
 * Calculate total monthly time investment
 * Formula: duration × frequencyPerMonth
 */
export function calculateMonthlyTime(
  durationMinutes: number,
  frequency: CleaningFrequency
): number {
  return durationMinutes * CLEANING_FREQUENCY_PER_MONTH[frequency];
}

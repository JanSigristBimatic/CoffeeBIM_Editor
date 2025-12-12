/**
 * Cleaning Plan Overview
 *
 * Shows a comprehensive list of all spaces with their cleaning requirements,
 * estimated durations, and costs. Includes totals and export functionality.
 */

import React, { useMemo, useState } from 'react';
import {
  Brush,
  Clock,
  DollarSign,
  FileDown,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useElementStore, useProjectStore } from '@/store';
import type { BimElement, CleaningClassification, CleaningFrequency } from '@/types/bim';
import {
  calculateCleaningDuration,
  calculateMonthlyCost,
  calculateMonthlyTime,
  CLEANING_PERFORMANCE_RATES,
  DEFAULT_CLEANING_HOURLY_RATE,
} from '@/types/bim';
import { GASTRO_SPACE_LABELS, type GastroSpaceCategory } from '@/types/bim';

interface SpaceCleaningInfo {
  id: string;
  name: string;
  storeyName: string;
  gastroCategory: GastroSpaceCategory | undefined;
  area: number;
  classification: CleaningClassification;
  frequency: CleaningFrequency;
  durationMinutes: number;
  monthlyMinutes: number;
  monthlyCost: number;
  cleaningZone?: string;
  specialRequirements?: string;
}

type SortField = 'name' | 'area' | 'duration' | 'cost' | 'zone';
type SortDirection = 'asc' | 'desc';

export const CleaningPlanOverview: React.FC = () => {
  const { elements } = useElementStore();
  const { storeys } = useProjectStore();
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Collect all spaces with cleaning data
  const spacesInfo = useMemo((): SpaceCleaningInfo[] => {
    return Object.values(elements)
      .filter((el): el is BimElement & { spaceData: NonNullable<BimElement['spaceData']> } =>
        el.type === 'space' && el.spaceData != null
      )
      .map((space) => {
        const spaceData = space.spaceData;
        const storeyName = storeys.find((s) => s.id === space.parentId)?.name ?? 'Unbekannt';

        // Use existing cleaning data or defaults
        const cleaningData = spaceData.cleaningData ?? {
          classification: 'Medium' as CleaningClassification,
          frequency: 'Täglich' as CleaningFrequency,
          durationMinutes: calculateCleaningDuration(spaceData.area, 'Medium'),
        };

        const hourlyRate = cleaningData.hourlyRate ?? DEFAULT_CLEANING_HOURLY_RATE;
        const monthlyMinutes = calculateMonthlyTime(cleaningData.durationMinutes, cleaningData.frequency);
        const monthlyCost = calculateMonthlyCost(cleaningData.durationMinutes, cleaningData.frequency, hourlyRate);

        return {
          id: space.id,
          name: space.name,
          storeyName,
          gastroCategory: spaceData.gastroCategory,
          area: spaceData.area,
          classification: cleaningData.classification,
          frequency: cleaningData.frequency,
          durationMinutes: cleaningData.durationMinutes,
          monthlyMinutes,
          monthlyCost,
          cleaningZone: cleaningData.cleaningZone || 'Nicht zugewiesen',
          specialRequirements: cleaningData.specialRequirements,
        };
      });
  }, [elements, storeys]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalArea = spacesInfo.reduce((sum, s) => sum + s.area, 0);
    const totalMonthlyMinutes = spacesInfo.reduce((sum, s) => sum + s.monthlyMinutes, 0);
    const totalMonthlyCost = spacesInfo.reduce((sum, s) => sum + s.monthlyCost, 0);
    const totalDuration = spacesInfo.reduce((sum, s) => sum + s.durationMinutes, 0);

    return {
      spaceCount: spacesInfo.length,
      totalArea,
      totalDuration,
      totalMonthlyMinutes,
      totalMonthlyCost,
    };
  }, [spacesInfo]);

  // Sort spaces
  const sortedSpaces = useMemo(() => {
    return [...spacesInfo].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'area':
          comparison = a.area - b.area;
          break;
        case 'duration':
          comparison = a.durationMinutes - b.durationMinutes;
          break;
        case 'cost':
          comparison = a.monthlyCost - b.monthlyCost;
          break;
        case 'zone':
          comparison = (a.cleaningZone || '').localeCompare(b.cleaningZone || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [spacesInfo, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins} Min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const exportToCSV = () => {
    const headers = [
      'Raum',
      'Geschoss',
      'Kategorie',
      'Fläche (m²)',
      'Reinigungsklasse',
      'Häufigkeit',
      'Dauer/Reinigung (Min)',
      'Zeit/Monat (Min)',
      'Kosten/Monat (CHF)',
      'Zone',
      'Spez. Anforderungen',
    ];

    const rows = sortedSpaces.map((s) => [
      s.name,
      s.storeyName,
      s.gastroCategory ? GASTRO_SPACE_LABELS[s.gastroCategory] : 'Sonstiges',
      s.area.toFixed(2),
      s.classification,
      s.frequency,
      s.durationMinutes.toFixed(1),
      s.monthlyMinutes.toFixed(0),
      s.monthlyCost.toFixed(2),
      s.cleaningZone || '',
      s.specialRequirements?.replace(/\n/g, ' ') || '',
    ]);

    // Add totals row
    rows.push([
      'GESAMT',
      '',
      '',
      totals.totalArea.toFixed(2),
      '',
      '',
      totals.totalDuration.toFixed(1),
      totals.totalMonthlyMinutes.toFixed(0),
      totals.totalMonthlyCost.toFixed(2),
      '',
      '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(';')).join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Reinigungsplan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (spacesInfo.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Brush className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Keine Räume vorhanden.</p>
        <p className="text-sm">Erstellen Sie Räume, um den Reinigungsplan zu sehen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <div className="text-xs text-muted-foreground">Räume</div>
          <div className="text-xl font-bold">{totals.spaceCount}</div>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
          <div className="text-xs text-muted-foreground">Gesamtfläche</div>
          <div className="text-xl font-bold">{totals.totalArea.toFixed(1)} m²</div>
        </div>
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Zeit/Monat
          </div>
          <div className="text-xl font-bold">{formatTime(totals.totalMonthlyMinutes)}</div>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Kosten/Monat
          </div>
          <div className="text-xl font-bold text-green-700 dark:text-green-400">
            CHF {totals.totalMonthlyCost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportToCSV}>
          <FileDown className="w-4 h-4 mr-2" />
          CSV Export
        </Button>
      </div>

      {/* Cleaning Plan Table */}
      <div className="border rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 p-2 bg-muted/50 text-xs font-medium border-b">
          <button
            className="col-span-3 flex items-center gap-1 hover:text-primary text-left"
            onClick={() => toggleSort('name')}
          >
            Raum
            {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>
          <button
            className="col-span-2 flex items-center gap-1 hover:text-primary text-right justify-end"
            onClick={() => toggleSort('area')}
          >
            Fläche
            {sortField === 'area' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>
          <div className="col-span-2 text-center">Klasse</div>
          <div className="col-span-2 text-center">Häufigkeit</div>
          <button
            className="col-span-1 flex items-center gap-1 hover:text-primary text-right justify-end"
            onClick={() => toggleSort('duration')}
          >
            Zeit
            {sortField === 'duration' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>
          <button
            className="col-span-2 flex items-center gap-1 hover:text-primary text-right justify-end"
            onClick={() => toggleSort('cost')}
          >
            CHF/Monat
            {sortField === 'cost' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>
        </div>

        {/* Table Body */}
        <div className="divide-y max-h-96 overflow-y-auto">
          {sortedSpaces.map((space) => (
            <div
              key={space.id}
              className="grid grid-cols-12 gap-2 p-2 text-sm hover:bg-muted/30 items-center"
            >
              <div className="col-span-3">
                <div className="font-medium truncate" title={space.name}>
                  {space.name}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {space.storeyName}
                </div>
              </div>
              <div className="col-span-2 text-right">
                {space.area.toFixed(1)} m²
              </div>
              <div className="col-span-2 text-center">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    space.classification === 'High'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      : space.classification === 'Special'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      : space.classification === 'Medium'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  }`}
                >
                  {space.classification}
                </span>
              </div>
              <div className="col-span-2 text-center text-xs">
                {space.frequency}
              </div>
              <div className="col-span-1 text-right text-xs">
                {formatTime(space.durationMinutes)}
              </div>
              <div className="col-span-2 text-right font-medium text-green-700 dark:text-green-400">
                {space.monthlyCost.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Table Footer with Totals */}
        <div className="grid grid-cols-12 gap-2 p-2 bg-muted/50 text-sm font-bold border-t">
          <div className="col-span-3">GESAMT</div>
          <div className="col-span-2 text-right">{totals.totalArea.toFixed(1)} m²</div>
          <div className="col-span-2"></div>
          <div className="col-span-2"></div>
          <div className="col-span-1 text-right text-xs font-medium">
            {formatTime(totals.totalDuration)}
          </div>
          <div className="col-span-2 text-right text-green-700 dark:text-green-400">
            CHF {totals.totalMonthlyCost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="font-medium">Leistungskennzahlen:</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <span>High: {CLEANING_PERFORMANCE_RATES.High} m²/h</span>
          <span>Medium: {CLEANING_PERFORMANCE_RATES.Medium} m²/h</span>
          <span>Low: {CLEANING_PERFORMANCE_RATES.Low} m²/h</span>
          <span>Special: {CLEANING_PERFORMANCE_RATES.Special} m²/h</span>
        </div>
      </div>
    </div>
  );
};

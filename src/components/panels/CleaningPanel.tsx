/**
 * Cleaning & Facility Management Panel
 *
 * PRO Mode module for cleaning classification and FM data (spaces only)
 * Includes automatic duration calculation and cost estimation
 */

import React, { useMemo } from 'react';
import { Brush, Info, Calculator, Clock, DollarSign, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useSelectionStore, useElementStore } from '@/store';
import type { CleaningData, CleaningClassification, CleaningFrequency } from '@/types/bim';
import {
  calculateCleaningDuration,
  calculateMonthlyCost,
  calculateMonthlyTime,
  CLEANING_PERFORMANCE_RATES,
  DEFAULT_CLEANING_HOURLY_RATE,
} from '@/types/bim';

const CLEANING_CLASSIFICATIONS: CleaningClassification[] = ['High', 'Medium', 'Low', 'Special'];

const CLEANING_FREQUENCIES: CleaningFrequency[] = [
  'Mehrmals täglich',
  'Täglich',
  'Wöchentlich',
  'Monatlich',
];

const CLASSIFICATION_LABELS: Record<CleaningClassification, string> = {
  High: 'High - Küche/Hygiene (116 m²/h)',
  Medium: 'Medium - Gastraum (140 m²/h)',
  Low: 'Low - Lager (160 m²/h)',
  Special: 'Special - Sanitär (65 m²/h)',
};

export const CleaningPanel: React.FC = () => {
  const { getSelectedIds } = useSelectionStore();
  const { getElement, updateElement } = useElementStore();

  const selectedIds = getSelectedIds();
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const element = selectedId ? getElement(selectedId) : null;

  // Get area from space data
  const area = element?.spaceData?.area ?? 0;

  // Determine if we have a valid space element
  const isValidSpace = element && element.type === 'space' && element.spaceData;

  // Get cleaning data (or defaults if not a valid space)
  const cleaningData: CleaningData = isValidSpace && element.spaceData?.cleaningData
    ? element.spaceData.cleaningData
    : {
        classification: 'Medium',
        frequency: 'Täglich',
        durationMinutes: calculateCleaningDuration(area, 'Medium'),
      };

  // All hooks must be called before any early return
  // Auto-calculate duration when classification changes and not manually set
  const autoCalculatedDuration = useMemo(() => {
    return calculateCleaningDuration(area, cleaningData.classification);
  }, [area, cleaningData.classification]);

  // Calculate costs
  const hourlyRate = cleaningData.hourlyRate ?? DEFAULT_CLEANING_HOURLY_RATE;
  const monthlyCost = useMemo(() => {
    return calculateMonthlyCost(cleaningData.durationMinutes, cleaningData.frequency, hourlyRate);
  }, [cleaningData.durationMinutes, cleaningData.frequency, hourlyRate]);

  const monthlyMinutes = useMemo(() => {
    return calculateMonthlyTime(cleaningData.durationMinutes, cleaningData.frequency);
  }, [cleaningData.durationMinutes, cleaningData.frequency]);

  // Show info message if no space is selected (after all hooks)
  if (!isValidSpace) {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold flex items-center gap-2">
          <Brush className="w-4 h-4 text-blue-500" />
          Reinigung & FM
        </h3>
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            Wählen Sie einen <strong>Raum (Space)</strong> aus, um Reinigungsdaten zu bearbeiten.
            Reinigungsparameter gelten nur für Räume.
          </p>
        </div>
      </div>
    );
  }

  const updateCleaningData = (updates: Partial<CleaningData>) => {
    if (element.spaceData && selectedId) {
      const newData = { ...cleaningData, ...updates };

      // Auto-update duration when classification changes (if not manually set)
      if (updates.classification && !cleaningData.manualDuration) {
        newData.durationMinutes = calculateCleaningDuration(area, updates.classification);
      }

      updateElement(selectedId, {
        spaceData: {
          ...element.spaceData,
          cleaningData: newData,
        },
      });
    }
  };

  const resetToAutoCalculation = () => {
    updateCleaningData({
      durationMinutes: autoCalculatedDuration,
      manualDuration: false,
    });
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins} Min`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <h3 className="font-semibold flex items-center gap-2">
        <Brush className="w-4 h-4 text-blue-500" />
        Reinigung & FM
      </h3>

      {/* Area Info */}
      <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
        <Calculator className="w-4 h-4 text-muted-foreground" />
        <span>
          Fläche: <strong>{area.toFixed(2)} m²</strong>
        </span>
      </div>

      {/* Classification */}
      <div className="space-y-2">
        <Label htmlFor="cleaning-classification">Reinigungsklasse</Label>
        <Select
          value={cleaningData.classification}
          onValueChange={(value) =>
            updateCleaningData({ classification: value as CleaningClassification })
          }
        >
          <SelectTrigger id="cleaning-classification">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLEANING_CLASSIFICATIONS.map((cls) => (
              <SelectItem key={cls} value={cls}>
                {CLASSIFICATION_LABELS[cls]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Leistungskennzahl: {CLEANING_PERFORMANCE_RATES[cleaningData.classification]} m²/h
        </p>
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <Label htmlFor="cleaning-frequency">Reinigungshäufigkeit</Label>
        <Select
          value={cleaningData.frequency}
          onValueChange={(value) =>
            updateCleaningData({ frequency: value as CleaningFrequency })
          }
        >
          <SelectTrigger id="cleaning-frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLEANING_FREQUENCIES.map((freq) => (
              <SelectItem key={freq} value={freq}>
                {freq}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Duration with auto-calculation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="cleaning-duration">Reinigungsdauer pro Durchgang</Label>
          {cleaningData.manualDuration && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToAutoCalculation}
              className="h-6 px-2 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Auto
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="cleaning-duration"
            type="number"
            min={1}
            max={480}
            step={0.5}
            value={cleaningData.durationMinutes}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              updateCleaningData({
                durationMinutes: value,
                manualDuration: true,
              });
            }}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground">Min</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {cleaningData.manualDuration
            ? 'Manuell angepasst'
            : `Auto-berechnet: ${area.toFixed(1)} m² ÷ ${CLEANING_PERFORMANCE_RATES[cleaningData.classification]} m²/h × 60`}
        </p>
      </div>

      {/* Hourly Rate */}
      <div className="space-y-2">
        <Label htmlFor="hourly-rate">Stundensatz (CHF/h)</Label>
        <Input
          id="hourly-rate"
          type="number"
          min={1}
          max={200}
          value={hourlyRate}
          onChange={(e) =>
            updateCleaningData({ hourlyRate: parseFloat(e.target.value) || DEFAULT_CLEANING_HOURLY_RATE })
          }
        />
      </div>

      {/* Cost Summary Card */}
      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-md space-y-2">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          Monatliche Kosten
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Zeit:</span>
          </div>
          <span className="font-medium">{formatTime(monthlyMinutes)}</span>
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Kosten:</span>
          </div>
          <span className="font-medium text-green-700 dark:text-green-400">
            CHF {monthlyCost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Cleaning Zone */}
      <div className="space-y-2">
        <Label htmlFor="cleaning-zone">Reinigungszone</Label>
        <Input
          id="cleaning-zone"
          value={cleaningData.cleaningZone || ''}
          onChange={(e) => updateCleaningData({ cleaningZone: e.target.value })}
          placeholder="z.B. Zone A, Erdgeschoss"
        />
        <p className="text-xs text-muted-foreground">Gruppierung für Reinigungstouren</p>
      </div>

      {/* Special Requirements */}
      <div className="space-y-2">
        <Label htmlFor="cleaning-requirements">Spezielle Anforderungen</Label>
        <Textarea
          id="cleaning-requirements"
          value={cleaningData.specialRequirements || ''}
          onChange={(e) => updateCleaningData({ specialRequirements: e.target.value })}
          placeholder="z.B. HACCP-konform, Desinfektion erforderlich..."
          rows={3}
        />
      </div>
    </div>
  );
};

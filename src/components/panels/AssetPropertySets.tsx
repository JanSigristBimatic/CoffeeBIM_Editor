import { useState, useCallback } from 'react';
import type { BimElement, PropertySet, IfcElectricApplianceTypeEnum, CoffeeEquipmentType } from '@/types/bim';
import { useElementStore } from '@/store';

interface AssetPropertySetsProps {
  element: BimElement;
}

/**
 * Collapsible section for a property set
 */
function PsetSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        <span>{title}</span>
        <span className="text-xs text-muted-foreground">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

/**
 * Text input field for property
 */
function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-sm border rounded bg-background"
      />
    </div>
  );
}

/**
 * Number input field for property
 */
function NumberInput({
  label,
  value,
  onChange,
  step,
  min,
  max,
  unit,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">
        {label}
        {unit && <span className="ml-1">({unit})</span>}
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? null : parseFloat(val));
        }}
        step={step}
        min={min}
        max={max}
        className="w-full px-2 py-1.5 text-sm border rounded bg-background"
      />
    </div>
  );
}

/**
 * Date input field for property
 */
function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-2 py-1.5 text-sm border rounded bg-background"
      />
    </div>
  );
}

/**
 * Select input field for property
 */
function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border rounded bg-background"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Condition options for assets
 */
const ZUSTAND_OPTIONS = [
  { value: 'neu', label: 'Neu' },
  { value: 'gebraucht', label: 'Gebraucht' },
  { value: 'aufbereitet', label: 'Aufbereitet' },
];

/**
 * IFC Electric Appliance Type options
 */
const IFC_APPLIANCE_OPTIONS: { value: IfcElectricApplianceTypeEnum | ''; label: string }[] = [
  { value: '', label: '(kein elektrisches Gerät)' },
  // Coffee/Gastronomy relevant
  { value: 'USERDEFINED', label: 'Kaffee-/Gastro-Gerät' },
  { value: 'REFRIGERATOR', label: 'Kühlschrank' },
  { value: 'FREEZER', label: 'Tiefkühler' },
  { value: 'FRIDGE_FREEZER', label: 'Kühl-Gefrierkombination' },
  { value: 'MICROWAVE', label: 'Mikrowelle' },
  { value: 'ELECTRICCOOKER', label: 'Elektroherd' },
  { value: 'DISHWASHER', label: 'Geschirrspüler' },
  { value: 'VENDINGMACHINE', label: 'Verkaufsautomat' },
  { value: 'WATERCOOLER', label: 'Wasserkühler' },
  { value: 'WATERHEATER', label: 'Wassererhitzer' },
  // Office equipment
  { value: 'COMPUTER', label: 'Computer' },
  { value: 'PRINTER', label: 'Drucker' },
  { value: 'SCANNER', label: 'Scanner' },
  { value: 'PHOTOCOPIER', label: 'Kopierer' },
  { value: 'TELEPHONE', label: 'Telefon' },
  { value: 'FACSIMILE', label: 'Faxgerät' },
  { value: 'TV', label: 'Fernseher' },
  // Climate/Ventilation
  { value: 'ELECTRICHEATER', label: 'Elektroheizung' },
  { value: 'RADIANTHEATER', label: 'Strahlungsheizung' },
  { value: 'FREESTANDINGFAN', label: 'Standventilator' },
  // Sanitary
  { value: 'HANDDRYER', label: 'Händetrockner' },
  { value: 'DIRECTWATERHEATER', label: 'Durchlauferhitzer' },
  { value: 'INDIRECTWATERHEATER', label: 'Boiler' },
  // Laundry
  { value: 'WASHINGMACHINE', label: 'Waschmaschine' },
  { value: 'TUMBLEDRYER', label: 'Wäschetrockner' },
  // Other
  { value: 'NOTDEFINED', label: 'Nicht definiert' },
];

/**
 * Coffee/Gastronomy Equipment Type options (when USERDEFINED is selected)
 */
const COFFEE_EQUIPMENT_OPTIONS: { value: CoffeeEquipmentType | ''; label: string }[] = [
  { value: '', label: '(Typ wählen)' },
  { value: 'ESPRESSOMACHINE', label: 'Espressomaschine' },
  { value: 'COFFEEGRINDER', label: 'Kaffeemühle' },
  { value: 'COFFEEBREWER', label: 'Filterkaffeemaschine' },
  { value: 'MILKFROTHER', label: 'Milchaufschäumer' },
  { value: 'COFFEEROASTER', label: 'Kaffeeröster' },
  { value: 'WATERFILTRATION', label: 'Wasserfilteranlage' },
  { value: 'ICEMACHINE', label: 'Eismaschine' },
  { value: 'BLENDER', label: 'Mixer/Blender' },
  { value: 'TOASTER', label: 'Toaster' },
  { value: 'CONTACTGRILL', label: 'Kontaktgrill' },
  { value: 'DISPLAYCASE', label: 'Vitrine/Auslage' },
  { value: 'CASHREGISTER', label: 'Kasse/POS' },
];

/**
 * Energy efficiency options
 */
const ENERGIEEFFIZIENZ_OPTIONS = [
  { value: '', label: '(nicht angegeben)' },
  { value: 'A+++', label: 'A+++' },
  { value: 'A++', label: 'A++' },
  { value: 'A+', label: 'A+' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'G', label: 'G' },
];

/**
 * Asset Property Sets editor component
 * Displays and allows editing of the 4 standard property sets for assets:
 * - Grunddaten (Basic info)
 * - Kaufdaten & Garantie (Purchase & warranty)
 * - Technische Daten (Technical specs)
 * - Dimensionen (Dimensions)
 */
export function AssetPropertySets({ element }: AssetPropertySetsProps) {
  const { updateElement } = useElementStore();

  // Track which sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Pset_Grunddaten: true,
    Pset_KaufdatenGarantie: false,
    Pset_TechnischeDaten: false,
    Pset_Dimensionen: false,
  });

  const toggleSection = (name: string) => {
    setOpenSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // Helper to get a property set by name
  const getPset = useCallback(
    (name: string): PropertySet | undefined => {
      return element.properties.find((p) => p.name === name);
    },
    [element.properties]
  );

  // Helper to update a property in a property set
  const updatePsetProperty = useCallback(
    (psetName: string, propertyName: string, value: string | number | boolean | null) => {
      const updatedProperties = element.properties.map((pset) =>
        pset.name === psetName
          ? {
              ...pset,
              properties: {
                ...pset.properties,
                [propertyName]: value,
              },
            }
          : pset
      );

      updateElement(element.id, { properties: updatedProperties });
    },
    [element, updateElement]
  );

  // Helper to update multiple properties in a property set at once (avoids race conditions)
  const updatePsetProperties = useCallback(
    (psetName: string, updates: Record<string, string | number | boolean | null>) => {
      const updatedProperties = element.properties.map((pset) =>
        pset.name === psetName
          ? {
              ...pset,
              properties: {
                ...pset.properties,
                ...updates,
              },
            }
          : pset
      );

      updateElement(element.id, { properties: updatedProperties });
    },
    [element, updateElement]
  );

  // Get property sets
  const grunddaten = getPset('Pset_Grunddaten');
  const kaufdaten = getPset('Pset_KaufdatenGarantie');
  const technisch = getPset('Pset_TechnischeDaten');
  const dimensionen = getPset('Pset_Dimensionen');

  // If no property sets exist, show message
  if (!grunddaten && !kaufdaten && !technisch && !dimensionen) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Keine Asset-Eigenschaften verfügbar
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Asset-Eigenschaften</h3>

      {/* Pset_Grunddaten */}
      {grunddaten && (
        <PsetSection
          title="Grunddaten"
          isOpen={openSections['Pset_Grunddaten'] ?? true}
          onToggle={() => toggleSection('Pset_Grunddaten')}
        >
          <TextInput
            label="Hersteller"
            value={(grunddaten.properties.Hersteller as string) || ''}
            onChange={(v) => updatePsetProperty('Pset_Grunddaten', 'Hersteller', v)}
            placeholder="z.B. La Marzocco"
          />
          <TextInput
            label="Typ / Modell"
            value={(grunddaten.properties.Typ as string) || ''}
            onChange={(v) => updatePsetProperty('Pset_Grunddaten', 'Typ', v)}
            placeholder="z.B. Linea Mini"
          />
          <TextInput
            label="Seriennummer"
            value={(grunddaten.properties.Seriennummer as string) || ''}
            onChange={(v) => updatePsetProperty('Pset_Grunddaten', 'Seriennummer', v)}
            placeholder="z.B. LM-2024-001234"
          />
          <TextInput
            label="Kategorie"
            value={(grunddaten.properties.Kategorie as string) || ''}
            onChange={(v) => updatePsetProperty('Pset_Grunddaten', 'Kategorie', v)}
            placeholder="z.B. Kaffeemaschine"
          />
          <SelectInput
            label="IFC Gerätetyp"
            value={(grunddaten.properties.IfcElectricApplianceType as string) || ''}
            onChange={(v) => {
              // Update both properties at once to avoid race condition
              if (v !== 'USERDEFINED') {
                updatePsetProperties('Pset_Grunddaten', {
                  IfcElectricApplianceType: v,
                  CoffeeEquipmentType: '',
                });
              } else {
                updatePsetProperty('Pset_Grunddaten', 'IfcElectricApplianceType', v);
              }
            }}
            options={IFC_APPLIANCE_OPTIONS}
          />
          {grunddaten.properties.IfcElectricApplianceType === 'USERDEFINED' && (
            <SelectInput
              label="Kaffee-/Gastro-Gerätetyp"
              value={(grunddaten.properties.CoffeeEquipmentType as string) || ''}
              onChange={(v) => updatePsetProperty('Pset_Grunddaten', 'CoffeeEquipmentType', v)}
              options={COFFEE_EQUIPMENT_OPTIONS}
            />
          )}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Beschreibung</label>
            <textarea
              value={(grunddaten.properties.Beschreibung as string) || ''}
              onChange={(e) => updatePsetProperty('Pset_Grunddaten', 'Beschreibung', e.target.value)}
              placeholder="Optionale Beschreibung..."
              rows={2}
              className="w-full px-2 py-1.5 text-sm border rounded bg-background resize-none"
            />
          </div>
        </PsetSection>
      )}

      {/* Pset_KaufdatenGarantie */}
      {kaufdaten && (
        <PsetSection
          title="Kaufdaten & Garantie"
          isOpen={openSections['Pset_KaufdatenGarantie'] ?? false}
          onToggle={() => toggleSection('Pset_KaufdatenGarantie')}
        >
          <DateInput
            label="Kaufdatum"
            value={(kaufdaten.properties.Kaufdatum as string) || null}
            onChange={(v) => updatePsetProperty('Pset_KaufdatenGarantie', 'Kaufdatum', v)}
          />
          <NumberInput
            label="Kaufpreis"
            value={(kaufdaten.properties.Kaufpreis as number) ?? null}
            onChange={(v) => updatePsetProperty('Pset_KaufdatenGarantie', 'Kaufpreis', v)}
            step={100}
            min={0}
            unit="CHF"
          />
          <DateInput
            label="Garantie bis"
            value={(kaufdaten.properties.GarantieBis as string) || null}
            onChange={(v) => updatePsetProperty('Pset_KaufdatenGarantie', 'GarantieBis', v)}
          />
          <TextInput
            label="Lieferant"
            value={(kaufdaten.properties.Lieferant as string) || ''}
            onChange={(v) => updatePsetProperty('Pset_KaufdatenGarantie', 'Lieferant', v)}
            placeholder="z.B. Kaffeemacher GmbH"
          />
          <SelectInput
            label="Zustand"
            value={(kaufdaten.properties.Zustand as string) || 'neu'}
            onChange={(v) => updatePsetProperty('Pset_KaufdatenGarantie', 'Zustand', v)}
            options={ZUSTAND_OPTIONS}
          />
        </PsetSection>
      )}

      {/* Pset_TechnischeDaten */}
      {technisch && (
        <PsetSection
          title="Technische Daten"
          isOpen={openSections['Pset_TechnischeDaten'] ?? false}
          onToggle={() => toggleSection('Pset_TechnischeDaten')}
        >
          <NumberInput
            label="Stromverbrauch"
            value={(technisch.properties.Stromverbrauch as number) ?? null}
            onChange={(v) => updatePsetProperty('Pset_TechnischeDaten', 'Stromverbrauch', v)}
            step={100}
            min={0}
            unit="W"
          />
          <SelectInput
            label="Energieeffizienz"
            value={(technisch.properties.Energieeffizienz as string) || ''}
            onChange={(v) => updatePsetProperty('Pset_TechnischeDaten', 'Energieeffizienz', v)}
            options={ENERGIEEFFIZIENZ_OPTIONS}
          />
          <TextInput
            label="Betriebstemperatur"
            value={(technisch.properties.Betriebstemperatur as string) || ''}
            onChange={(v) => updatePsetProperty('Pset_TechnischeDaten', 'Betriebstemperatur', v)}
            placeholder="z.B. 5-35°C"
          />
          <TextInput
            label="Auslastung / Kapazität"
            value={(technisch.properties.Auslastung as string) || ''}
            onChange={(v) => updatePsetProperty('Pset_TechnischeDaten', 'Auslastung', v)}
            placeholder="z.B. 200 Tassen/Tag"
          />
        </PsetSection>
      )}

      {/* Pset_Dimensionen */}
      {dimensionen && (
        <PsetSection
          title="Dimensionen"
          isOpen={openSections['Pset_Dimensionen'] ?? false}
          onToggle={() => toggleSection('Pset_Dimensionen')}
        >
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="Breite"
              value={(dimensionen.properties.Breite as number) ?? null}
              onChange={(v) => updatePsetProperty('Pset_Dimensionen', 'Breite', v)}
              step={0.01}
              min={0}
              unit="m"
            />
            <NumberInput
              label="Tiefe"
              value={(dimensionen.properties.Tiefe as number) ?? null}
              onChange={(v) => updatePsetProperty('Pset_Dimensionen', 'Tiefe', v)}
              step={0.01}
              min={0}
              unit="m"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="Höhe"
              value={(dimensionen.properties.Hoehe as number) ?? null}
              onChange={(v) => updatePsetProperty('Pset_Dimensionen', 'Hoehe', v)}
              step={0.01}
              min={0}
              unit="m"
            />
            <NumberInput
              label="Gewicht"
              value={(dimensionen.properties.Gewicht as number) ?? null}
              onChange={(v) => updatePsetProperty('Pset_Dimensionen', 'Gewicht', v)}
              step={1}
              min={0}
              unit="kg"
            />
          </div>
        </PsetSection>
      )}
    </div>
  );
}

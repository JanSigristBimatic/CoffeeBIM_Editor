# Asset Library

Lege deine GLB-Dateien in den entsprechenden Unterordnern ab.

## Ordnerstruktur

```
assets/
├── coffee-machines/     # Kaffeemaschinen
│   ├── espresso-1group.glb
│   ├── espresso-2group.glb
│   └── espresso-3group.glb
├── grinders/            # Kaffeemühlen
│   ├── grinder-type-a.glb
│   └── grinder-type-b.glb
├── appliances/          # Geräte
│   ├── dishwasher.glb
│   ├── refrigerator.glb
│   ├── air-conditioning.glb
│   ├── payment-terminal.glb
│   ├── cash-register.glb
│   └── microwave.glb
├── furniture/           # Möbel
│   ├── table-round.glb
│   ├── table-square.glb
│   ├── chair.glb
│   ├── bar-stool.glb
│   ├── bench.glb
│   ├── sofa-2seat.glb
│   ├── sofa-3seat.glb
│   ├── armchair.glb
│   └── shelf.glb
└── lighting/            # Beleuchtung
    ├── ceiling-lamp.glb
    ├── pendant-light.glb
    ├── floor-lamp.glb
    ├── table-lamp.glb
    └── wall-sconce.glb
```

## GLB-Dateien erstellen

GLB (GL Binary) ist das empfohlene Format für 3D-Assets.

### Aus Blender exportieren:
1. File → Export → glTF 2.0 (.glb/.gltf)
2. Format: **glTF Binary (.glb)**
3. Empfohlene Einstellungen:
   - Include: Selected Objects
   - Transform: +Y Up
   - Geometry: Apply Modifiers
   - Materials: Export (wenn gewünscht)

### Einheiten
- Modelle sollten in **Metern** skaliert sein
- Eine Kaffeemaschine ist ca. 0.5-1.0m breit
- Ein Stuhl ist ca. 0.45m breit, 0.85m hoch

### Ursprung
- Der Ursprung (0,0,0) sollte am **Boden in der Mitte** des Objekts sein
- So wird das Asset korrekt auf dem Boden platziert

## Neue Assets hinzufügen

Um ein neues Asset zum Katalog hinzuzufügen:

1. Platziere die GLB-Datei im passenden Ordner
2. Bearbeite `src/lib/assets/assetCatalog.ts`
3. Füge einen neuen Eintrag zur entsprechenden Kategorie hinzu:

```typescript
{
  id: 'mein-asset',           // Eindeutige ID (kebab-case)
  name: 'Mein Asset',         // Anzeigename
  path: '/assets/furniture/mein-asset.glb',
  defaultScale: 1.0,
  dimensions: { width: 0.5, depth: 0.5, height: 0.8 },
}
```

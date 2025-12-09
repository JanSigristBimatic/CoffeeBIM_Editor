import { IfcImporter, type ImportResult, type ImportOptions } from './IfcImporter';

/**
 * Import an IFC file and return the parsed model
 *
 * @param file - The IFC file to import
 * @param options - Import options (which elements to import)
 * @returns ImportResult with project, storeys, elements, and warnings
 *
 * @example
 * ```typescript
 * const file = event.target.files[0];
 * const result = await importFromIfc(file);
 *
 * // Update stores
 * useProjectStore.getState().importProject(result);
 * useElementStore.getState().importElements(result.elements);
 * ```
 */
export async function importFromIfc(file: File, options?: ImportOptions): Promise<ImportResult> {
  const importer = new IfcImporter();
  await importer.init();

  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  return await importer.import(data, options);
}

/**
 * Import an IFC file from a Uint8Array
 *
 * @param data - The IFC file data as Uint8Array
 * @param options - Import options
 * @returns ImportResult
 */
export async function importFromIfcData(
  data: Uint8Array,
  options?: ImportOptions
): Promise<ImportResult> {
  const importer = new IfcImporter();
  await importer.init();

  return await importer.import(data, options);
}

/**
 * Import an IFC file from a URL
 *
 * @param url - URL to the IFC file
 * @param options - Import options
 * @returns ImportResult
 */
export async function importFromIfcUrl(
  url: string,
  options?: ImportOptions
): Promise<ImportResult> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch IFC file: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const data = new Uint8Array(buffer);

  const importer = new IfcImporter();
  await importer.init();

  return await importer.import(data, options);
}

export type { ImportResult, ImportOptions };

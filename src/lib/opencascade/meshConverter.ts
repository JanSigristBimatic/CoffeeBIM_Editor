/**
 * OCCT Mesh to Three.js Converter
 *
 * Converts MeshData from OpenCascade.js worker to Three.js BufferGeometry.
 * Handles both single meshes and composite shapes.
 */

import * as THREE from 'three';
import type { MeshData } from './types';

/**
 * Converts OCCT MeshData to Three.js BufferGeometry
 *
 * @param meshData - Triangulated mesh data from OCCT worker
 * @returns Three.js BufferGeometry ready for rendering
 *
 * @example
 * const result = await booleanOperation({ ... });
 * const geometry = meshDataToGeometry(result.mesh);
 * const mesh = new THREE.Mesh(geometry, material);
 */
export function meshDataToGeometry(meshData: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  // Set vertex positions
  geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));

  // Set indices
  geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

  // Set normals if available
  if (meshData.normals && meshData.normals.length > 0) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
  } else {
    // Compute normals if not provided
    geometry.computeVertexNormals();
  }

  // Compute bounding box and sphere for culling
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Creates a Three.js Mesh from OCCT MeshData with default material
 *
 * @param meshData - Triangulated mesh data from OCCT worker
 * @param material - Optional custom material (default: MeshStandardMaterial)
 * @returns Three.js Mesh ready for scene
 */
export function meshDataToMesh(
  meshData: MeshData,
  material?: THREE.Material
): THREE.Mesh {
  const geometry = meshDataToGeometry(meshData);

  const defaultMaterial =
    material ||
    new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });

  return new THREE.Mesh(geometry, defaultMaterial);
}

/**
 * Updates an existing Three.js Mesh with new OCCT MeshData
 * More efficient than creating a new mesh when updating geometry
 *
 * @param mesh - Existing Three.js Mesh to update
 * @param meshData - New mesh data from OCCT
 */
export function updateMeshGeometry(mesh: THREE.Mesh, meshData: MeshData): void {
  // Dispose old geometry
  mesh.geometry.dispose();

  // Create and assign new geometry
  mesh.geometry = meshDataToGeometry(meshData);
}

/**
 * Creates line segments from mesh edges (useful for wireframe visualization)
 *
 * @param meshData - Mesh data from OCCT
 * @param color - Line color (default: black)
 * @returns Three.js LineSegments for edge rendering
 */
export function meshDataToEdges(
  meshData: MeshData,
  color: THREE.ColorRepresentation = 0x000000
): THREE.LineSegments {
  const geometry = meshDataToGeometry(meshData);
  const edges = new THREE.EdgesGeometry(geometry, 15); // 15 degree threshold

  const material = new THREE.LineBasicMaterial({
    color,
    linewidth: 1,
  });

  return new THREE.LineSegments(edges, material);
}

/**
 * Validates mesh data integrity
 *
 * @param meshData - Mesh data to validate
 * @returns true if mesh data is valid
 */
export function validateMeshData(meshData: MeshData): boolean {
  if (!meshData) return false;

  // Check for required arrays
  if (!meshData.vertices || !meshData.indices) return false;

  // Vertices must be divisible by 3 (x, y, z)
  if (meshData.vertices.length % 3 !== 0) return false;

  // Indices must be divisible by 3 (triangles)
  if (meshData.indices.length % 3 !== 0) return false;

  // Must have at least one triangle
  if (meshData.indices.length < 3) return false;

  // If normals exist, they must match vertices count
  if (meshData.normals && meshData.normals.length !== meshData.vertices.length) {
    return false;
  }

  // Check index bounds
  const maxIndex = meshData.vertices.length / 3 - 1;
  for (let i = 0; i < meshData.indices.length; i++) {
    const idx = meshData.indices[i]!;
    if (idx > maxIndex || idx < 0) {
      return false;
    }
  }

  return true;
}

/**
 * Computes mesh statistics
 *
 * @param meshData - Mesh data to analyze
 * @returns Statistics about the mesh
 */
export function getMeshStats(meshData: MeshData): {
  vertexCount: number;
  triangleCount: number;
  hasNormals: boolean;
  boundingBox: { min: THREE.Vector3; max: THREE.Vector3 };
} {
  const geometry = meshDataToGeometry(meshData);
  geometry.computeBoundingBox();

  return {
    vertexCount: meshData.vertices.length / 3,
    triangleCount: meshData.indices.length / 3,
    hasNormals: meshData.normals !== undefined && meshData.normals.length > 0,
    boundingBox: {
      min: geometry.boundingBox?.min ?? new THREE.Vector3(),
      max: geometry.boundingBox?.max ?? new THREE.Vector3(),
    },
  };
}

/**
 * Merges multiple OCCT mesh data into a single BufferGeometry
 * Useful for combining multiple shapes into one mesh
 *
 * @param meshDataArray - Array of mesh data to merge
 * @returns Merged Three.js BufferGeometry
 */
export function mergeMeshData(meshDataArray: MeshData[]): THREE.BufferGeometry {
  if (meshDataArray.length === 0) {
    return new THREE.BufferGeometry();
  }

  if (meshDataArray.length === 1) {
    return meshDataToGeometry(meshDataArray[0]!);
  }

  // Calculate total sizes
  let totalVertices = 0;
  let totalIndices = 0;

  for (const mesh of meshDataArray) {
    totalVertices += mesh.vertices.length;
    totalIndices += mesh.indices.length;
  }

  // Create merged arrays
  const mergedVertices = new Float32Array(totalVertices);
  const mergedIndices = new Uint32Array(totalIndices);
  const mergedNormals = new Float32Array(totalVertices);

  let vertexOffset = 0;
  let indexOffset = 0;
  let vertexIndexOffset = 0;

  for (const mesh of meshDataArray) {
    // Copy vertices
    mergedVertices.set(mesh.vertices, vertexOffset);

    // Copy and offset indices
    for (let i = 0; i < mesh.indices.length; i++) {
      mergedIndices[indexOffset + i] = mesh.indices[i]! + vertexIndexOffset;
    }

    // Copy normals if available
    if (mesh.normals && mesh.normals.length > 0) {
      mergedNormals.set(mesh.normals, vertexOffset);
    }

    vertexOffset += mesh.vertices.length;
    indexOffset += mesh.indices.length;
    vertexIndexOffset += mesh.vertices.length / 3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mergedVertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
  geometry.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

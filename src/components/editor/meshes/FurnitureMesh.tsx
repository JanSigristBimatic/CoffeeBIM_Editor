import { Suspense, useMemo, useRef, useEffect, useState } from 'react';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  Group,
  Box3,
  Vector3,
  MeshStandardMaterial,
  Mesh,
  BufferGeometry,
} from 'three';
import { useElementStore } from '@/store';
import type { BimElement, MeshData } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';

/**
 * Extract triangulated mesh data from a Three.js object
 * Merges all meshes into a single vertex/index buffer for IFC export
 */
function extractMeshData(object: Group, scale: number): MeshData | null {
  const allVertices: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  object.traverse((child) => {
    if (child instanceof Mesh && child.geometry) {
      const geometry = child.geometry as BufferGeometry;

      // Get position attribute
      const positionAttr = geometry.getAttribute('position');
      if (!positionAttr) return;

      // Get world matrix for this mesh
      child.updateWorldMatrix(true, false);
      const matrix = child.matrixWorld;

      // Extract vertices and transform to world space
      for (let i = 0; i < positionAttr.count; i++) {
        const vertex = new Vector3(
          positionAttr.getX(i),
          positionAttr.getY(i),
          positionAttr.getZ(i)
        );
        vertex.applyMatrix4(matrix);
        // Apply scale and convert to meters
        allVertices.push(vertex.x * scale, vertex.y * scale, vertex.z * scale);
      }

      // Extract indices
      const indexAttr = geometry.getIndex();
      if (indexAttr) {
        // Indexed geometry
        for (let i = 0; i < indexAttr.count; i++) {
          allIndices.push(indexAttr.getX(i) + vertexOffset);
        }
      } else {
        // Non-indexed geometry - create indices
        for (let i = 0; i < positionAttr.count; i++) {
          allIndices.push(i + vertexOffset);
        }
      }

      vertexOffset += positionAttr.count;
    }
  });

  if (allVertices.length === 0 || allIndices.length === 0) {
    return null;
  }

  return {
    vertices: allVertices,
    indices: allIndices,
  };
}

interface FurnitureMeshProps {
  element: BimElement;
  selected: boolean;
  isGhost?: boolean;
  ghostOpacity?: number;
}

const GHOST_COLOR = '#9e9e9e';

// Fallback box when model is loading or fails (Z-up)
function FallbackBox({
  width,
  depth,
  height,
  selected,
  isGhost = false,
  ghostOpacity = 0.25,
}: {
  width: number;
  depth: number;
  height: number;
  selected: boolean;
  isGhost?: boolean;
  ghostOpacity?: number;
}) {
  return (
    <mesh position={[0, 0, height / 2]} castShadow={!isGhost} receiveShadow={!isGhost}>
      <boxGeometry args={[width, depth, height]} />
      <meshStandardMaterial
        color={isGhost ? GHOST_COLOR : selected ? '#90caf9' : '#888888'}
        transparent
        opacity={isGhost ? ghostOpacity : 0.5}
        wireframe={!isGhost}
        depthWrite={!isGhost}
      />
    </mesh>
  );
}

// GLB/glTF Model Loader Component
function GltfModel({
  url,
  scale,
  selected,
  onBoundsCalculated,
  onMeshExtracted,
  onError,
  onLoadingChange,
}: {
  url: string;
  scale: number;
  selected: boolean;
  onBoundsCalculated?: (bounds: { width: number; depth: number; height: number }) => void;
  onMeshExtracted?: (meshData: MeshData) => void;
  onError?: (error: Error) => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const [loadedScene, setLoadedScene] = useState<Group | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // Load GLTF with error handling
  useEffect(() => {
    let mounted = true;
    const gltfLoader = new GLTFLoader();

    // Signal loading started
    onLoadingChange?.(true);

    gltfLoader.load(
      url,
      (gltf: GLTF) => {
        if (mounted) {
          const scene = gltf.scene.clone();

          // Calculate bounding box immediately
          const box = new Box3().setFromObject(scene);
          const size = new Vector3();
          const center = new Vector3();
          box.getSize(size);
          box.getCenter(center);

          // Report RAW bounds (without scale) - auto-scale will be calculated in handleBoundsCalculated
          if (onBoundsCalculated) {
            onBoundsCalculated({
              width: size.x,
              depth: size.z,
              height: size.y,
            });
          }

          // Extract mesh data for IFC export
          if (onMeshExtracted) {
            const meshData = extractMeshData(scene, scale);
            if (meshData) {
              onMeshExtracted(meshData);
            }
          }

          // Calculate offset to center model and place on ground (in model's Y-up space)
          // After -90° X rotation: model Y becomes world Z, model Z becomes world -Y
          // So we offset in model space: center model and lift by half height (Y in model space)
          setOffset({
            x: -center.x,
            y: -center.y + size.y / 2, // Lift to ground in model's Y-up space
            z: -center.z,
          });

          // Apply selection highlight to materials
          scene.traverse((child) => {
            if (child instanceof Mesh) {
              if (Array.isArray(child.material)) {
                child.material = child.material.map((m) => {
                  if (m instanceof MeshStandardMaterial) {
                    const cloned = m.clone();
                    if (selected) {
                      cloned.emissive.setHex(0x4488ff);
                      cloned.emissiveIntensity = 0.3;
                    }
                    return cloned;
                  }
                  return m;
                });
              } else if (child.material instanceof MeshStandardMaterial) {
                child.material = child.material.clone();
                if (selected) {
                  child.material.emissive.setHex(0x4488ff);
                  child.material.emissiveIntensity = 0.3;
                }
              }
            }
          });

          setLoadedScene(scene);
          setLoadError(null);
          onLoadingChange?.(false);
        }
      },
      undefined,
      (error: unknown) => {
        if (mounted) {
          console.warn('GLTF load error:', error);
          const err = new Error(
            'Modell konnte nicht geladen werden. Bei .gltf Dateien verwende bitte .glb (binäres Format).'
          );
          setLoadError(err);
          onError?.(err);
          onLoadingChange?.(false);
        }
      }
    );

    return () => {
      mounted = false;
    };
  }, [url, scale, selected]); // Reload when these change

  // Show error state
  if (loadError) {
    return null; // Parent will show fallback
  }

  // Show loading state
  if (!loadedScene) {
    return null;
  }

  // GLTF models are Y-up, rotate +90° around X to convert to Z-up (Y → +Z)
  return (
    <group scale={[scale, scale, scale]} rotation={[Math.PI / 2, 0, 0]}>
      <group position={[offset.x, offset.y, offset.z]}>
        <primitive object={loadedScene} />
      </group>
    </group>
  );
}

// OBJ Model Loader Component with proper error handling
function ObjModel({
  url,
  scale,
  selected,
  onBoundsCalculated,
  onMeshExtracted,
  onError,
  onLoadingChange,
}: {
  url: string;
  scale: number;
  selected: boolean;
  onBoundsCalculated?: (bounds: { width: number; depth: number; height: number }) => void;
  onMeshExtracted?: (meshData: MeshData) => void;
  onError?: (error: Error) => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const [loadedObj, setLoadedObj] = useState<Group | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // Load OBJ with error handling
  useEffect(() => {
    let mounted = true;
    const objLoader = new OBJLoader();

    // Signal loading started
    onLoadingChange?.(true);

    objLoader.load(
      url,
      (obj: Group) => {
        if (mounted) {
          const clonedObj = obj.clone();

          // Calculate bounding box
          const box = new Box3().setFromObject(clonedObj);
          const size = new Vector3();
          const center = new Vector3();
          box.getSize(size);
          box.getCenter(center);

          // Report RAW bounds (without scale)
          if (onBoundsCalculated) {
            onBoundsCalculated({
              width: size.x,
              depth: size.z,
              height: size.y,
            });
          }

          // Extract mesh data for IFC export
          if (onMeshExtracted) {
            const meshData = extractMeshData(clonedObj, scale);
            if (meshData) {
              onMeshExtracted(meshData);
            }
          }

          // Calculate offset to center model and place on ground
          setOffset({
            x: -center.x,
            y: -center.y + size.y / 2,
            z: -center.z,
          });

          // Apply default material with selection highlight
          const material = new MeshStandardMaterial({
            color: selected ? '#90caf9' : '#aaaaaa',
            roughness: 0.7,
            metalness: 0.2,
          });

          if (selected) {
            material.emissive.setHex(0x4488ff);
            material.emissiveIntensity = 0.3;
          }

          clonedObj.traverse((child) => {
            if (child instanceof Mesh) {
              child.material = material;
            }
          });

          setLoadedObj(clonedObj);
          setLoadError(null);
          onLoadingChange?.(false);
        }
      },
      undefined,
      (error: unknown) => {
        if (mounted) {
          console.warn('OBJ load error:', error);
          const err = new Error(
            'OBJ-Modell konnte nicht geladen werden. Die Datei ist möglicherweise beschädigt oder die URL ungültig.'
          );
          setLoadError(err);
          onError?.(err);
          onLoadingChange?.(false);
        }
      }
    );

    return () => {
      mounted = false;
    };
  }, [url, scale, selected]);

  // Show error state
  if (loadError) {
    return null; // Parent will show fallback
  }

  // Show loading state
  if (!loadedObj) {
    return null;
  }

  // OBJ models are Y-up, rotate +90° around X to convert to Z-up (Y → +Z)
  return (
    <group scale={[scale, scale, scale]} rotation={[Math.PI / 2, 0, 0]}>
      <group position={[offset.x, offset.y, offset.z]}>
        <primitive object={loadedObj} />
      </group>
    </group>
  );
}

// Error boundary for model loading (Z-up)
function ModelErrorFallback({
  width,
  depth,
  height,
  selected,
}: {
  width: number;
  depth: number;
  height: number;
  selected: boolean;
}) {
  return (
    <group>
      <FallbackBox width={width} depth={depth} height={height} selected={selected} />
      {/* Error indicator (Z-up: above model at Z = height + 0.2) */}
      <mesh position={[0, 0, height + 0.2]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="red" />
      </mesh>
    </group>
  );
}

// Main Model Loader with error handling
function ModelLoader({
  url,
  format,
  scale,
  selected,
  width,
  depth,
  height,
  onBoundsCalculated,
  onMeshExtracted,
}: {
  url: string;
  format: 'glb' | 'gltf' | 'obj';
  scale: number;
  selected: boolean;
  width: number;
  depth: number;
  height: number;
  onBoundsCalculated?: (bounds: { width: number; depth: number; height: number }) => void;
  onMeshExtracted?: (meshData: MeshData) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  if (error) {
    return (
      <ModelErrorFallback
        width={width}
        depth={depth}
        height={height}
        selected={selected}
      />
    );
  }

  try {
    if (format === 'glb' || format === 'gltf') {
      return (
        <>
          {loading && (
            <FallbackBox width={width} depth={depth} height={height} selected={selected} />
          )}
          <GltfModel
            url={url}
            scale={scale}
            selected={selected}
            onBoundsCalculated={onBoundsCalculated}
            onMeshExtracted={onMeshExtracted}
            onError={(err) => setError(err.message)}
            onLoadingChange={setLoading}
          />
        </>
      );
    } else if (format === 'obj') {
      return (
        <>
          {loading && (
            <FallbackBox width={width} depth={depth} height={height} selected={selected} />
          )}
          <ObjModel
            url={url}
            scale={scale}
            selected={selected}
            onBoundsCalculated={onBoundsCalculated}
            onMeshExtracted={onMeshExtracted}
            onError={(err) => setError(err.message)}
            onLoadingChange={setLoading}
          />
        </>
      );
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Unknown error');
  }

  return <FallbackBox width={width} depth={depth} height={height} selected={selected} />;
}

export function FurnitureMesh({ element, selected, isGhost = false, ghostOpacity = 0.25 }: FurnitureMeshProps) {
  const groupRef = useRef<Group>(null);
  const { updateElement } = useElementStore();
  const { handlers } = useDragElement(element);
  const effectiveHandlers = isGhost ? {} : handlers;

  // Disable raycasting for ghost elements so they don't block clicks on active storey
  useEffect(() => {
    if (groupRef.current && isGhost) {
      groupRef.current.traverse((child) => {
        if (child instanceof Mesh) {
          child.raycast = () => {};
        }
      });
    }
  }, [isGhost]);

  const { furnitureData, placement } = element;

  // Calculate rotation from quaternion (Z-up: rotate around Z axis)
  const rotation = useMemo(() => {
    if (!furnitureData) return 0;
    const { rotation: q } = placement;
    if (!q || typeof q.w !== 'number') {
      return 0; // Default rotation
    }
    // Extract Z rotation from quaternion: 2 * atan2(z, w)
    const zRotation = 2 * Math.atan2(q.z || 0, q.w || 1);
    // Ensure we don't return NaN
    return isFinite(zRotation) ? zRotation : 0;
  }, [placement, furnitureData]);

  if (!furnitureData) {
    return null;
  }

  // Handle bounds update from loaded model
  const handleBoundsCalculated = (rawBounds: { width: number; depth: number; height: number }) => {
    if (!furnitureData) return;

    const { targetDimensions } = furnitureData;

    // If targetDimensions is set, keep them for 2D display (don't override with model bounds)
    // The 3D model will use its own scale from furnitureData.scale
    if (targetDimensions) {
      // Debug logging
      console.log('Model loaded with targetDimensions:', {
        rawBounds,
        targetDimensions,
        currentScale: furnitureData.scale,
        scaledModelSize: {
          width: rawBounds.width * furnitureData.scale,
          depth: rawBounds.depth * furnitureData.scale,
          height: rawBounds.height * furnitureData.scale,
        },
      });

      // Don't update dimensions - keep targetDimensions for 2D consistency
      // The 3D model renders at its natural size * scale
      return;
    }

    // No targetDimensions - legacy behavior: use raw bounds with current scale
    const scaledBounds = {
      width: rawBounds.width * furnitureData.scale,
      depth: rawBounds.depth * furnitureData.scale,
      height: rawBounds.height * furnitureData.scale,
    };

    // Only update if dimensions are significantly different
    const threshold = 0.01;
    if (
      Math.abs(scaledBounds.width - furnitureData.width) > threshold ||
      Math.abs(scaledBounds.depth - furnitureData.depth) > threshold ||
      Math.abs(scaledBounds.height - furnitureData.height) > threshold
    ) {
      updateElement(element.id, {
        furnitureData: {
          ...furnitureData,
          width: scaledBounds.width,
          depth: scaledBounds.depth,
          height: scaledBounds.height,
        },
        geometry: {
          ...element.geometry,
          height: scaledBounds.height,
        },
      });
    }
  };

  // Handle mesh extraction for IFC export
  // Re-extract when scale changes to ensure correct geometry in IFC export
  const handleMeshExtracted = (meshData: MeshData) => {
    if (!furnitureData) return;

    // Always update meshData - the scale is baked into the vertices
    // We need to update whenever extracted to ensure IFC export uses current scale
    updateElement(element.id, {
      furnitureData: {
        ...furnitureData,
        meshData,
      },
    });
  };

  const { modelUrl, modelFormat, width, depth, height, scale } = furnitureData;
  const { position } = placement;

  // Validate position values
  const posX = typeof position.x === 'number' && isFinite(position.x) ? position.x : 0;
  const posY = typeof position.y === 'number' && isFinite(position.y) ? position.y : 0;
  const posZ = typeof position.z === 'number' && isFinite(position.z) ? position.z : 0;

  // Z-up: rotate around Z axis instead of Y
  // For ghost elements, show a simple fallback box instead of loading complex models
  if (isGhost) {
    return (
      <group
        ref={groupRef}
        position={[posX, posY, posZ]}
        rotation={[0, 0, rotation]}
        renderOrder={-1}
      >
        <FallbackBox
          width={width}
          depth={depth}
          height={height}
          selected={false}
          isGhost={true}
          ghostOpacity={ghostOpacity}
        />
      </group>
    );
  }

  return (
    <group
      ref={groupRef}
      position={[posX, posY, posZ]}
      rotation={[0, 0, rotation]}
      {...effectiveHandlers}
    >
      {modelUrl && modelFormat ? (
        <Suspense
          fallback={
            <FallbackBox width={width} depth={depth} height={height} selected={selected} />
          }
        >
          <ModelLoader
            url={modelUrl}
            format={modelFormat}
            scale={scale}
            selected={selected}
            width={width}
            depth={depth}
            height={height}
            onBoundsCalculated={handleBoundsCalculated}
            onMeshExtracted={handleMeshExtracted}
          />
        </Suspense>
      ) : (
        <FallbackBox width={width} depth={depth} height={height} selected={selected} />
      )}
    </group>
  );
}

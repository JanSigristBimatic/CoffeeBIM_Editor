import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Stage, Layer, Line, Rect, Circle, Arc, Text, Group } from 'react-konva';
import type { Stage as StageType } from 'konva/lib/Stage';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useElementStore, useViewStore, useSelectionStore, useProjectStore, useToolStore } from '@/store';
import type { BimElement } from '@/types/bim';
import { DEFAULT_WALL_THICKNESS, DEFAULT_WALL_HEIGHT, DEFAULT_WALL_ALIGNMENT, DEFAULT_COUNTER_DEPTH, DEFAULT_COUNTER_HEIGHT } from '@/types/bim';
import { createColumn } from '@/bim/elements/Column';
import { createStair, calculateSteps } from '@/bim/elements/Stair';
import { createDoor, createOpeningFromDoor } from '@/bim/elements/Door';
import { createWindow, createOpeningFromWindow } from '@/bim/elements/Window';
import { getPositionOnWall, calculateWallLength } from '@/bim/elements/Wall';
import { createFurniture } from '@/bim/elements';
import { createSpace } from '@/bim/elements/Space';
import { detectSpaceAtPoint } from '@/bim/spaces';
import { getAssetById, getAssetCategoryForItem, mapAssetCategoryToFurnitureCategory } from '@/lib/assets';
import type { Point2D } from '@/types/geometry';
import { GASTRO_SPACE_COLORS, GASTRO_SPACE_LABELS } from '@/types/bim';
import type { GastroSpaceCategory } from '@/types/bim';
import { calculatePolygonArea } from '@/lib/geometry/dimensions';
import { distance2D } from '@/lib/geometry/math';
import {
  generateElementDimensions,
  calculateDimensionLinePoints,
  normalizeTextRotation,
  calculateWallCornerVertices,
} from '@/lib/geometry';
import { offsetPath, createCounterPolygon } from '@/lib/geometry/pathOffset';
import { DIMENSION_COLORS } from '@/types/dimensions';

// Constants for CAD rendering
const WALL_COLOR = '#333333';
const WALL_COLOR_SELECTED = '#0066ff';
const DOOR_COLOR = '#0066cc';
const WINDOW_COLOR = '#00cccc';
const COLUMN_COLOR = '#666666';
const SLAB_COLOR = '#999999';
const SLAB_FILL = '#f0f0f0';
const COUNTER_COLOR = '#8B4513'; // Saddle brown for counters
const COUNTER_FILL = '#DEB887'; // Burlywood fill
const FURNITURE_COLOR = '#4a4a4a';
const FURNITURE_FILL = '#e8e8e8';
const STAIR_COLOR = '#666666';
const STAIR_FILL = '#f5f5f5';
const STAIR_ARROW_COLOR = '#444444';
const SPACE_COLOR = '#666666';
const SPACE_COLOR_SELECTED = '#FF6600';
const SPACE_OPACITY = 0.35; // Transparency for space fills

/**
 * Convert hex color to rgba with specified opacity
 * Used for consistent space colors between 2D and 3D views
 */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get fill color for a space based on gastroCategory (priority) or spaceType (fallback)
 * Matches the color logic in SpaceMesh.tsx for 3D consistency
 */
function getSpaceFillColor(gastroCategory: GastroSpaceCategory | undefined, spaceType: string | undefined): string {
  // Priority: Use gastro category color if set (and not SONSTIGES)
  if (gastroCategory && gastroCategory !== 'SONSTIGES') {
    return hexToRgba(GASTRO_SPACE_COLORS[gastroCategory], SPACE_OPACITY);
  }

  // Fallback: Use IFC space type color
  switch (spaceType) {
    case 'EXTERNAL':
      return hexToRgba('#90EE90', SPACE_OPACITY); // Light green
    case 'INTERNAL':
      return hexToRgba('#87CEEB', SPACE_OPACITY); // Light blue
    default:
      return hexToRgba('#D3D3D3', SPACE_OPACITY); // Light gray
  }
}
const GRID_COLOR = '#e0e0e0';
const GRID_COLOR_MAJOR = '#cccccc';

interface Canvas2DProps {
  width?: number;
  height?: number;
}

export function Canvas2D({ width: propWidth, height: propHeight }: Canvas2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageType>(null);
  const [dimensions, setDimensions] = useState({ width: propWidth ?? 800, height: propHeight ?? 600 });

  // Store hooks
  const { cad2dZoom, cad2dPanX, cad2dPanY, setCad2dZoom, setCad2dPan, showGrid, gridSize, showDimensions, dimensionSettings, snapSettings, zoomToExtentsTrigger, showSpaces, showSpaceLabels } = useViewStore();
  const { getAllElements, getElementsByStorey, addElement, updateElement, getWallsForStorey } = useElementStore();
  const {
    selectedIds,
    select,
    clearSelection,
    toggleSelection,
    addToSelection,
    removeFromSelection,
    selectMultiple,
    boxSelect,
    startBoxSelect,
    updateBoxSelect,
    finishBoxSelect,
    getBoxSelectBounds,
  } = useSelectionStore();
  const { activeStoreyId, storeys } = useProjectStore();
  const {
    activeTool,
    wallPlacement,
    setWallStartPoint,
    setWallPreviewEndPoint,
    resetWallPlacement,
    setCursorPosition,
    // Slab placement
    slabPlacement,
    addSlabPoint,
    setSlabPreviewPoint,
    openSlabCompletionDialog,
    // Space placement
    spacePlacement,
    addSpacePoint,
    setSpacePreviewPoint,
    resetSpacePlacement,
    // Counter placement
    counterPlacement,
    addCounterPoint,
    setCounterPreviewPoint,
    resetCounterPlacement,
    // Column placement
    columnPlacement,
    setColumnPreview,
    resetColumnPlacement,
    // Stair placement
    stairPlacement,
    setStairStartPoint,
    setStairPreviewEndPoint,
    setStairRotation,
    resetStairPlacement,
    // Door placement
    doorPlacement,
    setDoorPreview,
    resetDoorPlacement,
    // Window placement
    windowPlacement,
    setWindowPreview,
    resetWindowPlacement,
    // Asset placement
    assetPlacement,
    setAssetPreview,
  } = useToolStore();

  // Local state for cursor position in world coordinates
  const [cursorWorldPos, setCursorWorldPos] = useState<Point2D | null>(null);

  // Get elements for current storey
  const elements = activeStoreyId ? getElementsByStorey(activeStoreyId) : getAllElements();

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Note: Escape key handling is done globally in useKeyboardShortcuts hook
  // which properly cancels operations AND switches back to select tool

  // Zoom to extents - calculate bounds of all elements and fit view
  const lastZoomTrigger = useRef(0);
  useEffect(() => {
    if (zoomToExtentsTrigger === 0 || zoomToExtentsTrigger === lastZoomTrigger.current) return;
    lastZoomTrigger.current = zoomToExtentsTrigger;

    if (elements.length === 0) {
      // No elements, reset to default view
      setCad2dZoom(50);
      setCad2dPan(0, 0);
      return;
    }

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const element of elements) {
      const pos = element.placement.position;

      if (element.type === 'wall' && element.wallData) {
        const { startPoint, endPoint, thickness } = element.wallData;
        minX = Math.min(minX, startPoint.x - thickness, endPoint.x - thickness);
        maxX = Math.max(maxX, startPoint.x + thickness, endPoint.x + thickness);
        minY = Math.min(minY, startPoint.y - thickness, endPoint.y - thickness);
        maxY = Math.max(maxY, startPoint.y + thickness, endPoint.y + thickness);
      } else if (element.type === 'slab' && element.slabData) {
        for (const p of element.slabData.outline) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      } else if (element.type === 'space' && element.spaceData) {
        for (const p of element.spaceData.boundaryPolygon) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      } else if (element.type === 'counter' && element.counterData) {
        for (const p of element.counterData.path) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      } else {
        // For other elements, use position with a default size
        minX = Math.min(minX, pos.x - 0.5);
        maxX = Math.max(maxX, pos.x + 0.5);
        minY = Math.min(minY, pos.y - 0.5);
        maxY = Math.max(maxY, pos.y + 0.5);
      }
    }

    // Add padding (20%)
    const padding = 0.2;
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    minX -= boundsWidth * padding;
    maxX += boundsWidth * padding;
    minY -= boundsHeight * padding;
    maxY += boundsHeight * padding;

    // Calculate center in world coordinates
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate zoom to fit
    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;
    const zoomX = dimensions.width / worldWidth;
    const zoomY = dimensions.height / worldHeight;
    const newZoom = Math.max(5, Math.min(zoomX, zoomY, 200)); // Clamp between 5 and 200

    // Calculate pan to center the content
    // worldToScreen: x * zoom + panX + width/2, -y * zoom + panY + height/2
    // To center (centerX, centerY) at screen center: panX = -centerX * zoom, panY = centerY * zoom
    const newPanX = -centerX * newZoom;
    const newPanY = centerY * newZoom;

    setCad2dZoom(newZoom);
    setCad2dPan(newPanX, newPanY);
  }, [zoomToExtentsTrigger, elements, dimensions, setCad2dZoom, setCad2dPan]);

  // World to screen coordinates
  const worldToScreen = useCallback(
    (x: number, y: number) => ({
      x: x * cad2dZoom + cad2dPanX + dimensions.width / 2,
      y: -y * cad2dZoom + cad2dPanY + dimensions.height / 2, // Flip Y for CAD convention
    }),
    [cad2dZoom, cad2dPanX, cad2dPanY, dimensions]
  );

  // Screen to world coordinates (inverse of worldToScreen)
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point2D => ({
      x: (screenX - cad2dPanX - dimensions.width / 2) / cad2dZoom,
      y: -(screenY - cad2dPanY - dimensions.height / 2) / cad2dZoom, // Flip Y back
    }),
    [cad2dZoom, cad2dPanX, cad2dPanY, dimensions]
  );

  // Snap tolerance in world units (meters)
  const SNAP_TOLERANCE = 0.3; // 30cm
  // Ortho snap angle tolerance in degrees
  const ORTHO_ANGLE_TOLERANCE = 5;

  // Apply orthogonal constraint (horizontal/vertical) relative to reference point
  const applyOrthoConstraint = useCallback(
    (point: Point2D, refPoint: Point2D): Point2D => {
      const dx = point.x - refPoint.x;
      const dy = point.y - refPoint.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Normalize angle to 0-360
      const normalizedAngle = ((angle % 360) + 360) % 360;

      // Check if close to horizontal (0° or 180°)
      if (normalizedAngle < ORTHO_ANGLE_TOLERANCE || normalizedAngle > 360 - ORTHO_ANGLE_TOLERANCE ||
          Math.abs(normalizedAngle - 180) < ORTHO_ANGLE_TOLERANCE) {
        // Snap to horizontal
        return { x: point.x, y: refPoint.y };
      }

      // Check if close to vertical (90° or 270°)
      if (Math.abs(normalizedAngle - 90) < ORTHO_ANGLE_TOLERANCE ||
          Math.abs(normalizedAngle - 270) < ORTHO_ANGLE_TOLERANCE) {
        // Snap to vertical
        return { x: refPoint.x, y: point.y };
      }

      // Not close to ortho angle, return original point
      return point;
    },
    []
  );

  /**
   * Calculate perpendicular foot point from a point to a line segment
   * Returns the point on the line segment that is closest to the given point
   * (which is the perpendicular projection if it falls within the segment)
   */
  const getPerpendicularPoint = useCallback(
    (point: Point2D, lineStart: Point2D, lineEnd: Point2D): { point: Point2D; isOnSegment: boolean } => {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const lengthSq = dx * dx + dy * dy;

      if (lengthSq === 0) {
        // Line segment is a point
        return { point: { ...lineStart }, isOnSegment: true };
      }

      // Parameter t for the projection point on the infinite line
      // t = dot(point - lineStart, lineEnd - lineStart) / |lineEnd - lineStart|^2
      const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;

      // Check if projection falls within the segment
      const isOnSegment = t >= 0 && t <= 1;

      // Clamp t to [0, 1] to get nearest point on segment
      const tClamped = Math.max(0, Math.min(1, t));

      return {
        point: {
          x: lineStart.x + tClamped * dx,
          y: lineStart.y + tClamped * dy,
        },
        isOnSegment,
      };
    },
    []
  );

  // Apply all snap modes (endpoint, midpoint, perpendicular, ortho, grid)
  // refPoint is optional - used for orthogonal and perpendicular snapping relative to last point
  const applySnap = useCallback(
    (point: Point2D, refPoint?: Point2D): Point2D => {
      if (!snapSettings.enabled) {
        return point;
      }

      let workingPoint = point;

      // Apply orthogonal constraint first if enabled and we have a reference point
      if (snapSettings.orthogonal && refPoint) {
        workingPoint = applyOrthoConstraint(point, refPoint);
      }

      let bestPoint = workingPoint;
      let bestDistance = Infinity;

      // Collect all walls
      const walls = elements.filter((e) => e.type === 'wall' && e.wallData);

      // Check endpoint snapping
      if (snapSettings.endpoint) {
        for (const wall of walls) {
          if (!wall.wallData) continue;
          const { startPoint, endPoint } = wall.wallData;

          // Check start point
          const distStart = distance2D(workingPoint, startPoint);
          if (distStart < SNAP_TOLERANCE && distStart < bestDistance) {
            bestDistance = distStart;
            bestPoint = { ...startPoint };
          }

          // Check end point
          const distEnd = distance2D(workingPoint, endPoint);
          if (distEnd < SNAP_TOLERANCE && distEnd < bestDistance) {
            bestDistance = distEnd;
            bestPoint = { ...endPoint };
          }
        }
      }

      // Check midpoint snapping
      if (snapSettings.midpoint) {
        for (const wall of walls) {
          if (!wall.wallData) continue;
          const { startPoint, endPoint } = wall.wallData;

          const midPoint = {
            x: (startPoint.x + endPoint.x) / 2,
            y: (startPoint.y + endPoint.y) / 2,
          };

          const distMid = distance2D(workingPoint, midPoint);
          if (distMid < SNAP_TOLERANCE && distMid < bestDistance) {
            bestDistance = distMid;
            bestPoint = midPoint;
          }
        }
      }

      // Check perpendicular snapping (Lot auf Linie)
      // Finds the point on a wall where a line from refPoint would be perpendicular
      if (snapSettings.perpendicular && refPoint) {
        for (const wall of walls) {
          if (!wall.wallData) continue;
          const { startPoint, endPoint } = wall.wallData;

          // Get the perpendicular foot point from refPoint to the wall line
          const { point: perpPoint, isOnSegment } = getPerpendicularPoint(refPoint, startPoint, endPoint);

          // Only consider if the perpendicular foot is actually on the wall segment
          if (isOnSegment) {
            // Check if cursor is close to this perpendicular point
            const distPerp = distance2D(workingPoint, perpPoint);
            if (distPerp < SNAP_TOLERANCE && distPerp < bestDistance) {
              bestDistance = distPerp;
              bestPoint = perpPoint;
            }
          }
        }
      }

      // If no endpoint/midpoint/perpendicular snap found, use grid snap (but preserve ortho constraint)
      if (bestDistance === Infinity && snapSettings.grid) {
        return {
          x: Math.round(workingPoint.x / gridSize) * gridSize,
          y: Math.round(workingPoint.y / gridSize) * gridSize,
        };
      }

      return bestPoint;
    },
    [snapSettings, gridSize, elements, applyOrthoConstraint, getPerpendicularPoint]
  );

  // CAD Navigation: Zoom with mouse wheel
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = cad2dZoom;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Zoom factor
      const scaleBy = 1.1;
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

      // Clamp zoom
      const clampedScale = Math.max(5, Math.min(500, newScale));

      // Calculate new pan to zoom toward mouse pointer
      const mousePointTo = {
        x: (pointer.x - cad2dPanX) / oldScale,
        y: (pointer.y - cad2dPanY) / oldScale,
      };

      const newPanX = pointer.x - mousePointTo.x * clampedScale;
      const newPanY = pointer.y - mousePointTo.y * clampedScale;

      setCad2dZoom(clampedScale);
      setCad2dPan(newPanX, newPanY);
    },
    [cad2dZoom, cad2dPanX, cad2dPanY, setCad2dZoom, setCad2dPan]
  );

  // Pan with middle mouse button or right mouse button
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Middle mouse button (1) or right mouse button (2) for panning
      if (e.evt.button === 1 || e.evt.button === 2) {
        e.evt.preventDefault();
        setIsPanning(true);
        setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
        return;
      }

      // Left click in select mode on empty space - start box selection
      if (e.evt.button === 0 && activeTool === 'select') {
        const stage = stageRef.current;
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const worldPos = screenToWorld(pointer.x, pointer.y);
        startBoxSelect(worldPos);
      }
    },
    [activeTool, screenToWorld, startBoxSelect]
  );

  // Get walls for current storey (used for door/window preview)
  const wallsForPreview = activeStoreyId ? getWallsForStorey(activeStoreyId) : [];

  // Find wall at point for preview (defined before handleMouseMove to avoid dependency issues)
  const findWallAtPointForPreview = useCallback(
    (point: Point2D): { wall: BimElement; position: number } | null => {
      for (const wall of wallsForPreview) {
        const position = getPositionOnWall(wall, point, 0.5);
        if (position !== null) {
          return { wall, position };
        }
      }
      return null;
    },
    [wallsForPreview]
  );

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (isPanning) {
        const dx = e.evt.clientX - lastPanPos.x;
        const dy = e.evt.clientY - lastPanPos.y;
        setCad2dPan(cad2dPanX + dx, cad2dPanY + dy);
        setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
        return;
      }

      // Update box selection if active
      if (boxSelect.isActive && activeTool === 'select') {
        const stage = stageRef.current;
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const worldPos = screenToWorld(pointer.x, pointer.y);
        updateBoxSelect(worldPos);
        return;
      }

      // Track cursor position for active drawing tools
      if (activeTool !== 'select' && activeTool !== 'pan' && activeTool !== 'orbit') {
        const stage = stageRef.current;
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        // Convert screen to world coordinates
        const worldPos = screenToWorld(pointer.x, pointer.y);

        // Determine reference point for ortho snapping based on active tool
        let refPoint: Point2D | undefined;
        if (activeTool === 'wall' && wallPlacement.isPlacing && wallPlacement.startPoint) {
          refPoint = wallPlacement.startPoint;
        } else if (activeTool === 'slab' && slabPlacement.points.length > 0) {
          refPoint = slabPlacement.points[slabPlacement.points.length - 1];
        } else if (activeTool === 'space-draw' && spacePlacement.points.length > 0) {
          refPoint = spacePlacement.points[spacePlacement.points.length - 1];
        } else if (activeTool === 'counter' && counterPlacement.points.length > 0) {
          refPoint = counterPlacement.points[counterPlacement.points.length - 1];
        } else if (activeTool === 'stair' && stairPlacement.startPoint) {
          refPoint = stairPlacement.startPoint;
        }

        const snappedPos = applySnap(worldPos, refPoint);

        // Update local cursor state
        setCursorWorldPos(snappedPos);

        // Update global cursor position for snap preview
        setCursorPosition(snappedPos);

        // Update preview points based on active tool
        if (activeTool === 'wall' && wallPlacement.isPlacing) {
          setWallPreviewEndPoint(snappedPos);
        } else if (activeTool === 'slab' && slabPlacement.points.length > 0) {
          setSlabPreviewPoint(snappedPos);
        } else if (activeTool === 'space-draw' && spacePlacement.points.length > 0) {
          setSpacePreviewPoint(snappedPos);
        } else if (activeTool === 'counter' && counterPlacement.points.length > 0) {
          setCounterPreviewPoint(snappedPos);
        } else if (activeTool === 'stair' && stairPlacement.startPoint) {
          // Update stair preview and calculate rotation
          setStairPreviewEndPoint(snappedPos);
          const dx = snappedPos.x - stairPlacement.startPoint.x;
          const dy = snappedPos.y - stairPlacement.startPoint.y;
          const rotation = Math.atan2(dy, dx);
          setStairRotation(rotation);
        } else if (activeTool === 'column') {
          setColumnPreview(snappedPos, true);
        } else if (activeTool === 'asset' && assetPlacement.params.assetId) {
          setAssetPreview(snappedPos, true);
        } else if (activeTool === 'door' || activeTool === 'window') {
          // Find wall at cursor position for door/window preview
          const wallAtPoint = findWallAtPointForPreview(snappedPos);
          if (wallAtPoint) {
            const { wall, position } = wallAtPoint;
            const wallLength = calculateWallLength(wall);
            const elementWidth = activeTool === 'door' ? doorPlacement.params.width : windowPlacement.params.width;
            const halfWidth = elementWidth / 2;
            const distFromLeft = position * wallLength;
            const distFromRight = wallLength - distFromLeft;

            // Check if position is valid (not too close to edges)
            const minEdgeDist = halfWidth + 0.02;
            const isValid = distFromLeft >= minEdgeDist && distFromRight >= minEdgeDist;

            if (activeTool === 'door') {
              setDoorPreview(wall.id, position, distFromLeft, distFromRight, isValid);
            } else {
              setWindowPreview(wall.id, position, distFromLeft, distFromRight, isValid);
            }
          } else {
            // No wall at cursor - clear preview
            if (activeTool === 'door') {
              setDoorPreview(null, null, null, null, false);
            } else {
              setWindowPreview(null, null, null, null, false);
            }
          }
        }
      }
    },
    [isPanning, lastPanPos, cad2dPanX, cad2dPanY, setCad2dPan, activeTool, screenToWorld, applySnap, setCursorPosition,
     wallPlacement.isPlacing, wallPlacement.startPoint, setWallPreviewEndPoint,
     slabPlacement.points, setSlabPreviewPoint,
     spacePlacement.points, setSpacePreviewPoint,
     counterPlacement.points, setCounterPreviewPoint,
     stairPlacement.startPoint, setStairPreviewEndPoint, setStairRotation,
     setColumnPreview, assetPlacement.params.assetId, setAssetPreview,
     findWallAtPointForPreview, doorPlacement.params.width, windowPlacement.params.width, setDoorPreview, setWindowPreview]
  );

  /**
   * Check if an element's bounding box intersects with a selection rectangle
   */
  const getElementBounds = useCallback((element: BimElement): { min: Point2D; max: Point2D } | null => {
    if (element.type === 'wall' && element.wallData) {
      const { startPoint, endPoint, thickness } = element.wallData;
      return {
        min: {
          x: Math.min(startPoint.x, endPoint.x) - thickness,
          y: Math.min(startPoint.y, endPoint.y) - thickness,
        },
        max: {
          x: Math.max(startPoint.x, endPoint.x) + thickness,
          y: Math.max(startPoint.y, endPoint.y) + thickness,
        },
      };
    }

    if (element.type === 'slab' && element.slabData) {
      const xs = element.slabData.outline.map((p) => p.x);
      const ys = element.slabData.outline.map((p) => p.y);
      return {
        min: { x: Math.min(...xs), y: Math.min(...ys) },
        max: { x: Math.max(...xs), y: Math.max(...ys) },
      };
    }

    if (element.type === 'space' && element.spaceData) {
      const xs = element.spaceData.boundaryPolygon.map((p) => p.x);
      const ys = element.spaceData.boundaryPolygon.map((p) => p.y);
      return {
        min: { x: Math.min(...xs), y: Math.min(...ys) },
        max: { x: Math.max(...xs), y: Math.max(...ys) },
      };
    }

    if (element.type === 'counter' && element.counterData) {
      const xs = element.counterData.path.map((p) => p.x);
      const ys = element.counterData.path.map((p) => p.y);
      const depth = element.counterData.depth;
      return {
        min: { x: Math.min(...xs) - depth, y: Math.min(...ys) - depth },
        max: { x: Math.max(...xs) + depth, y: Math.max(...ys) + depth },
      };
    }

    if (element.type === 'column' && element.columnData) {
      const pos = element.placement.position;
      const size = element.columnData.profileType === 'circular'
        ? element.columnData.width // For circular columns, width = diameter
        : Math.max(element.columnData.width, element.columnData.depth);
      const half = size / 2;
      return {
        min: { x: pos.x - half, y: pos.y - half },
        max: { x: pos.x + half, y: pos.y + half },
      };
    }

    if (element.type === 'stair' && element.stairData) {
      const { width, steps } = element.stairData;
      const pos = element.placement.position;
      // Simplified bounds - actual rotation would need more complex calculation
      const size = Math.max(width, steps.runLength);
      return {
        min: { x: pos.x - size / 2, y: pos.y - size / 2 },
        max: { x: pos.x + size / 2, y: pos.y + size / 2 },
      };
    }

    // Default: use placement position with a small bounding box
    const pos = element.placement.position;
    const defaultSize = 0.5;
    return {
      min: { x: pos.x - defaultSize, y: pos.y - defaultSize },
      max: { x: pos.x + defaultSize, y: pos.y + defaultSize },
    };
  }, []);

  /**
   * Check if two axis-aligned bounding boxes intersect
   */
  const boundsIntersect = useCallback(
    (a: { min: Point2D; max: Point2D }, b: { min: Point2D; max: Point2D }): boolean => {
      return a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y;
    },
    []
  );

  const handleMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      setIsPanning(false);

      // Finish box selection
      if (boxSelect.isActive && activeTool === 'select') {
        const bounds = getBoxSelectBounds();

        if (bounds) {
          // Check if box is large enough (not just a click)
          const boxWidth = Math.abs(bounds.max.x - bounds.min.x);
          const boxHeight = Math.abs(bounds.max.y - bounds.min.y);
          const minBoxSize = 0.1; // Minimum box size in world units

          if (boxWidth > minBoxSize || boxHeight > minBoxSize) {
            // Find elements that intersect with the selection box
            const intersectingIds: string[] = [];
            for (const element of elements) {
              const elementBounds = getElementBounds(element);
              if (elementBounds && boundsIntersect(bounds, elementBounds)) {
                intersectingIds.push(element.id);
              }
            }

            // Apply selection based on modifiers
            const isShift = e.evt.shiftKey;
            const isCtrl = e.evt.ctrlKey;

            if (isCtrl && intersectingIds.length > 0) {
              // Ctrl+Box: Remove from selection
              const currentIds = Array.from(selectedIds);
              const newIds = currentIds.filter((id) => !intersectingIds.includes(id));
              selectMultiple(newIds);
            } else if (isShift && intersectingIds.length > 0) {
              // Shift+Box: Add to selection
              addToSelection(intersectingIds);
            } else if (intersectingIds.length > 0) {
              // Normal box: Replace selection
              selectMultiple(intersectingIds);
            } else {
              // Empty box without modifiers: Clear selection
              clearSelection();
            }
          } else {
            // Small box (click) - clear selection if no modifiers
            if (!e.evt.shiftKey && !e.evt.ctrlKey) {
              clearSelection();
            }
          }
        }

        finishBoxSelect();
      }
    },
    [
      boxSelect.isActive,
      activeTool,
      getBoxSelectBounds,
      elements,
      getElementBounds,
      boundsIntersect,
      selectedIds,
      selectMultiple,
      addToSelection,
      clearSelection,
      finishBoxSelect,
    ]
  );

  // Prevent context menu
  const handleContextMenu = useCallback((e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
  }, []);

  // Handle element click for selection
  // Shift+Click: Toggle element in selection
  // Ctrl+Click: Remove element from selection
  const handleElementClick = useCallback(
    (elementId: string, e: KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;

      e.cancelBubble = true; // Prevent stage click

      const { shiftKey, ctrlKey } = e.evt;

      if (ctrlKey && !shiftKey) {
        // Ctrl+Click: Remove from selection
        removeFromSelection([elementId]);
      } else if (shiftKey) {
        // Shift+Click: Toggle in selection
        toggleSelection(elementId);
      } else {
        // Normal click: Replace selection
        select(elementId);
      }
    },
    [activeTool, select, toggleSelection, removeFromSelection]
  );

  // Check if point is close to first point (for closing polygon)
  const isCloseToFirstPoint = useCallback(
    (point: Point2D, points: Point2D[]): boolean => {
      if (points.length < 3) return false;
      const firstPoint = points[0];
      if (!firstPoint) return false;
      return distance2D(point, firstPoint) < SNAP_TOLERANCE;
    },
    []
  );

  // Handle slab tool click - polygon drawing
  const handleSlabClick = useCallback(
    (point: Point2D) => {
      // Check if we should close the polygon
      if (isCloseToFirstPoint(point, slabPlacement.points)) {
        if (slabPlacement.points.length >= 3) {
          openSlabCompletionDialog([...slabPlacement.points]);
        }
        return;
      }
      // Add point to polygon
      addSlabPoint(point);
    },
    [slabPlacement.points, isCloseToFirstPoint, addSlabPoint, openSlabCompletionDialog]
  );

  // Handle slab double-click - finish polygon
  const handleSlabDoubleClick = useCallback(() => {
    if (slabPlacement.points.length >= 3) {
      openSlabCompletionDialog([...slabPlacement.points]);
    }
  }, [slabPlacement.points, openSlabCompletionDialog]);

  // Handle space tool click - polygon drawing
  const handleSpaceClick = useCallback(
    (point: Point2D) => {
      // Check if we should close the polygon
      if (isCloseToFirstPoint(point, spacePlacement.points)) {
        if (spacePlacement.points.length >= 3) {
          // Create the space element
          const spaceId = crypto.randomUUID();
          const polygon = [...spacePlacement.points];
          const area = calculatePolygonArea(polygon);

          addElement({
            id: spaceId,
            type: 'space',
            name: `Space ${spaceId.slice(0, 4)}`,
            geometry: {
              profile: polygon,
              height: DEFAULT_WALL_HEIGHT,
              direction: { x: 0, y: 0, z: 1 },
            },
            placement: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
            },
            properties: [],
            parentId: activeStoreyId,
            spaceData: {
              boundaryPolygon: polygon,
              area: area,
              perimeter: 0,
              spaceType: 'INTERNAL',
              boundingWallIds: [],
              autoDetected: false,
            },
          });

          resetSpacePlacement();
        }
        return;
      }
      // Add point to polygon
      addSpacePoint(point);
    },
    [spacePlacement.points, isCloseToFirstPoint, addSpacePoint, addElement, activeStoreyId, resetSpacePlacement]
  );

  // Handle space double-click - finish polygon
  const handleSpaceDoubleClick = useCallback(() => {
    if (spacePlacement.points.length >= 3) {
      const spaceId = crypto.randomUUID();
      const polygon = [...spacePlacement.points];
      const area = calculatePolygonArea(polygon);

      addElement({
        id: spaceId,
        type: 'space',
        name: `Space ${spaceId.slice(0, 4)}`,
        geometry: {
          profile: polygon,
          height: DEFAULT_WALL_HEIGHT,
          direction: { x: 0, y: 0, z: 1 },
        },
        placement: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        },
        properties: [],
        parentId: activeStoreyId,
        spaceData: {
          boundaryPolygon: polygon,
          area: area,
          perimeter: 0,
          spaceType: 'INTERNAL',
          boundingWallIds: [],
          autoDetected: false,
        },
      });

      resetSpacePlacement();
    }
  }, [spacePlacement.points, addElement, activeStoreyId, resetSpacePlacement]);

  // Handle space-detect tool click - automatic room detection
  const handleSpaceDetectClick = useCallback(
    (point: Point2D) => {
      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return;
      }

      // Get walls for current storey
      const storeyWalls = getWallsForStorey(activeStoreyId);

      if (storeyWalls.length < 3) {
        console.warn('Need at least 3 walls to detect a space');
        return;
      }

      // Detect space at clicked point using ray casting
      const detectedSpace = detectSpaceAtPoint(point, storeyWalls);

      if (!detectedSpace) {
        console.log('No closed space found at this position');
        return;
      }

      // Check if a space already exists with the same bounding walls
      const existingSpaces = elements.filter(e => e.type === 'space');
      const sameWallsSpace = existingSpaces.find((s) => {
        if (!s.spaceData) return false;
        const existingWallIds = new Set(s.spaceData.boundingWallIds);
        const newWallIds = new Set(detectedSpace.boundingWallIds);
        if (existingWallIds.size !== newWallIds.size) return false;
        for (const id of existingWallIds) {
          if (!newWallIds.has(id)) return false;
        }
        return true;
      });

      if (sameWallsSpace) {
        console.log('This space already exists');
        return;
      }

      // Get storey info for elevation and height
      const storey = storeys.find(s => s.id === activeStoreyId);
      const storeyElevation = storey?.elevation ?? 0;
      const storeyHeight = storey?.height ?? DEFAULT_WALL_HEIGHT;

      // Create the space element
      const spaceElement = createSpace({
        detectedSpace,
        storeyId: activeStoreyId,
        elevation: storeyElevation,
        height: storeyHeight,
      });

      addElement(spaceElement);
      console.log('Space detected and created:', spaceElement.name);
    },
    [activeStoreyId, getWallsForStorey, elements, storeys, addElement]
  );

  // Handle counter tool click - path drawing
  const handleCounterClick = useCallback(
    (point: Point2D) => {
      // Add point to path
      addCounterPoint(point);
    },
    [addCounterPoint]
  );

  // Handle counter double-click - finish path and create counter
  const handleCounterDoubleClick = useCallback(() => {
    if (counterPlacement.points.length >= 2) {
      const counterId = crypto.randomUUID();
      const path = [...counterPlacement.points];

      addElement({
        id: counterId,
        type: 'counter',
        name: `Counter ${counterId.slice(0, 4)}`,
        geometry: {
          profile: path,
          height: DEFAULT_COUNTER_HEIGHT,
          direction: { x: 0, y: 0, z: 1 },
        },
        placement: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        },
        properties: [],
        parentId: activeStoreyId,
        counterData: {
          path: path,
          depth: DEFAULT_COUNTER_DEPTH,
          height: DEFAULT_COUNTER_HEIGHT,
          topThickness: 0.04,
          overhang: 0.1,
          kickHeight: 0.1,
          kickRecess: 0.05,
          counterType: 'standard',
          hasFootrest: false,
          footrestHeight: 0.2,
        },
      });

      resetCounterPlacement();
    }
  }, [counterPlacement.points, addElement, activeStoreyId, resetCounterPlacement]);

  // Get storey elevation for element placement
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;

  // Get walls for current storey (for door/window placement)
  const walls = activeStoreyId ? getWallsForStorey(activeStoreyId) : [];

  // Find wall at point (for door/window placement)
  const findWallAtPoint = useCallback(
    (point: Point2D): { wall: BimElement; position: number } | null => {
      for (const wall of walls) {
        const position = getPositionOnWall(wall, point, 0.5);
        if (position !== null) {
          return { wall, position };
        }
      }
      return null;
    },
    [walls]
  );

  // Handle column tool click - single click placement
  const handleColumnClick = useCallback(
    (point: Point2D) => {
      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return;
      }

      try {
        const column = createColumn({
          position: point,
          storeyId: activeStoreyId,
          elevation: storeyElevation,
          profileType: columnPlacement.params.profileType,
          width: columnPlacement.params.width,
          depth: columnPlacement.params.depth,
          height: columnPlacement.params.height,
        });

        addElement(column);
        console.log('Column placed at position', point);
        resetColumnPlacement();
      } catch (error) {
        console.error('Could not create column:', error);
      }
    },
    [activeStoreyId, storeyElevation, columnPlacement.params, addElement, resetColumnPlacement]
  );

  // Handle stair tool click - two-click placement (start + direction)
  const handleStairClick = useCallback(
    (point: Point2D) => {
      if (!stairPlacement.startPoint) {
        // First click - set start point
        setStairStartPoint(point);
        setStairPreviewEndPoint(point);
      } else {
        // Second click - create stair with current rotation
        if (!activeStoreyId || !activeStorey) {
          console.warn('No active storey selected');
          return;
        }

        // Find target storey if specified
        const targetStorey = stairPlacement.params.targetStoreyId
          ? storeys.find((s) => s.id === stairPlacement.params.targetStoreyId)
          : null;

        // Use storey difference if available, otherwise use manual totalRise from params
        const totalRise = targetStorey
          ? Math.abs(targetStorey.elevation - activeStorey.elevation)
          : stairPlacement.params.totalRise;

        const isGoingUp = targetStorey
          ? targetStorey.elevation > activeStorey.elevation
          : true; // Default to going up for manual height

        // Determine storey IDs
        const bottomStoreyId = isGoingUp ? activeStoreyId : (targetStorey?.id ?? activeStoreyId);
        const topStoreyId = isGoingUp ? (targetStorey?.id ?? activeStoreyId) : activeStoreyId;
        const bottomElevation = isGoingUp ? activeStorey.elevation : (targetStorey?.elevation ?? activeStorey.elevation);

        try {
          const stair = createStair({
            position: stairPlacement.startPoint,
            rotation: stairPlacement.rotation,
            width: stairPlacement.params.width,
            totalRise,
            bottomStoreyId,
            topStoreyId,
            bottomElevation,
            stairType: stairPlacement.params.stairType,
            createOpening: stairPlacement.params.createOpening,
          });

          addElement(stair);
          console.log('Stair placed with height:', totalRise, 'm');
          resetStairPlacement();
        } catch (error) {
          console.error('Could not create stair:', error);
          resetStairPlacement();
        }
      }
    },
    [stairPlacement, activeStoreyId, activeStorey, storeys, setStairStartPoint, setStairPreviewEndPoint, resetStairPlacement, addElement]
  );

  // Handle door tool click - click on wall to place door
  const handleDoorClick = useCallback(
    (point: Point2D) => {
      const result = findWallAtPoint(point);
      if (!result) {
        console.log('No wall found at click position');
        return;
      }

      const { wall, position } = result;
      if (!wall.wallData) return;

      const wallLength = calculateWallLength(wall);
      const doorWidth = doorPlacement.params.width;

      // Check if position is valid (not too close to edges, not overlapping)
      const halfDoorWidth = doorWidth / 2;
      const doorStartNorm = position - halfDoorWidth / wallLength;
      const doorEndNorm = position + halfDoorWidth / wallLength;

      if (doorStartNorm < 0.02 || doorEndNorm > 0.98) {
        console.log('Door too close to wall edge');
        return;
      }

      // Check for overlapping openings
      for (const opening of wall.wallData.openings) {
        const openingHalfWidth = opening.width / 2 / wallLength;
        const openingStart = opening.position - openingHalfWidth;
        const openingEnd = opening.position + openingHalfWidth;
        if (doorStartNorm < openingEnd + 0.02 / wallLength && doorEndNorm > openingStart - 0.02 / wallLength) {
          console.log('Door overlaps with existing opening');
          return;
        }
      }

      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return;
      }

      try {
        const door = createDoor({
          hostWallId: wall.id,
          positionOnWall: position,
          wallLength,
          storeyId: activeStoreyId,
          doorType: doorPlacement.params.doorType,
          width: doorPlacement.params.width,
          height: doorPlacement.params.height,
          swingDirection: doorPlacement.params.swingDirection,
          swingSide: doorPlacement.params.swingSide,
        });

        const opening = createOpeningFromDoor(door);

        if (opening && wall.wallData) {
          updateElement(wall.id, {
            wallData: {
              ...wall.wallData,
              openings: [...wall.wallData.openings, opening],
            },
          });
        }

        addElement(door);
        console.log('Door placed at position', position, 'on wall', wall.id);
        resetDoorPlacement();
      } catch (error) {
        console.error('Could not create door:', error);
      }
    },
    [findWallAtPoint, doorPlacement.params, activeStoreyId, addElement, updateElement, resetDoorPlacement]
  );

  // Handle window tool click - click on wall to place window
  const handleWindowClick = useCallback(
    (point: Point2D) => {
      const result = findWallAtPoint(point);
      if (!result) {
        console.log('No wall found at click position');
        return;
      }

      const { wall, position } = result;
      if (!wall.wallData) return;

      const wallLength = calculateWallLength(wall);
      const windowWidth = windowPlacement.params.width;

      // Check if position is valid (not too close to edges, not overlapping)
      const halfWindowWidth = windowWidth / 2;
      const windowStartNorm = position - halfWindowWidth / wallLength;
      const windowEndNorm = position + halfWindowWidth / wallLength;

      if (windowStartNorm < 0.02 || windowEndNorm > 0.98) {
        console.log('Window too close to wall edge');
        return;
      }

      // Check for overlapping openings
      for (const opening of wall.wallData.openings) {
        const openingHalfWidth = opening.width / 2 / wallLength;
        const openingStart = opening.position - openingHalfWidth;
        const openingEnd = opening.position + openingHalfWidth;
        if (windowStartNorm < openingEnd + 0.02 / wallLength && windowEndNorm > openingStart - 0.02 / wallLength) {
          console.log('Window overlaps with existing opening');
          return;
        }
      }

      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return;
      }

      try {
        const window = createWindow({
          hostWallId: wall.id,
          positionOnWall: position,
          wallLength,
          storeyId: activeStoreyId,
          windowType: windowPlacement.params.windowType,
          width: windowPlacement.params.width,
          height: windowPlacement.params.height,
          sillHeight: windowPlacement.params.sillHeight,
        });

        const opening = createOpeningFromWindow(window);

        if (opening && wall.wallData) {
          updateElement(wall.id, {
            wallData: {
              ...wall.wallData,
              openings: [...wall.wallData.openings, opening],
            },
          });
        }

        addElement(window);
        console.log('Window placed at position', position, 'on wall', wall.id);
        resetWindowPlacement();
      } catch (error) {
        console.error('Could not create window:', error);
      }
    },
    [findWallAtPoint, windowPlacement.params, activeStoreyId, addElement, updateElement, resetWindowPlacement]
  );

  // Handle asset tool click - single click placement
  const handleAssetClick = useCallback(
    (point: Point2D) => {
      const assetId = assetPlacement.params.assetId;
      if (!assetId) {
        console.log('No asset selected');
        return;
      }

      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return;
      }

      const asset = getAssetById(assetId);
      if (!asset) {
        console.warn('Asset not found:', assetId);
        return;
      }

      const category = getAssetCategoryForItem(assetId);
      const furnitureCategory = category
        ? mapAssetCategoryToFurnitureCategory(category.id)
        : 'other';

      const scale = assetPlacement.params.scale;
      const rotationRad = (assetPlacement.params.rotation * Math.PI) / 180;

      // Use catalog dimensions for 2D display, actual model scale for 3D
      const element = createFurniture({
        name: asset.name,
        category: furnitureCategory,
        modelUrl: asset.path,
        modelFormat: 'glb',
        originalFileName: asset.path.split('/').pop() || asset.id,
        position: {
          x: point.x,
          y: point.y,
          z: storeyElevation,
        },
        rotation: rotationRad,
        scale: scale * asset.defaultScale,
        width: asset.dimensions.width * scale,
        depth: asset.dimensions.depth * scale,
        height: asset.dimensions.height * scale,
        storeyId: activeStoreyId,
        // Store target dimensions for reference (2D uses these)
        targetDimensions: {
          width: asset.dimensions.width * scale,
          depth: asset.dimensions.depth * scale,
          height: asset.dimensions.height * scale,
        },
      });

      addElement(element);
      console.log('Asset placed at position', point);
    },
    [assetPlacement.params, activeStoreyId, storeyElevation, addElement]
  );

  // Handle wall tool click - two-click placement
  const handleWallClick = useCallback(
    (point: Point2D) => {
      if (!wallPlacement.isPlacing) {
        // First click - set start point
        setWallStartPoint(point);
        setWallPreviewEndPoint(point);
      } else {
        // Second click - create wall
        const startPoint = wallPlacement.startPoint;
        if (!startPoint) return;

        // Calculate wall length
        const dx = point.x - startPoint.x;
        const dy = point.y - startPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        // Only create wall if it has meaningful length
        if (length < 0.1) {
          resetWallPlacement();
          return;
        }

        // Create the wall element
        const wallId = crypto.randomUUID();
        const thickness = DEFAULT_WALL_THICKNESS;
        const height = DEFAULT_WALL_HEIGHT;

        // Calculate wall profile (rectangle in local coordinates)
        const halfThick = thickness / 2;
        const wallProfile: Point2D[] = [
          { x: 0, y: -halfThick },
          { x: length, y: -halfThick },
          { x: length, y: halfThick },
          { x: 0, y: halfThick },
        ];

        addElement({
          id: wallId,
          type: 'wall',
          name: `Wall ${wallId.slice(0, 4)}`,
          geometry: {
            profile: wallProfile,
            height: height,
            direction: { x: 0, y: 0, z: 1 }, // Z-up extrusion
          },
          placement: {
            position: { x: startPoint.x, y: startPoint.y, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
          properties: [],
          parentId: activeStoreyId,
          wallData: {
            startPoint: { x: startPoint.x, y: startPoint.y },
            endPoint: { x: point.x, y: point.y },
            height: height,
            thickness: thickness,
            openings: [],
            alignmentSide: DEFAULT_WALL_ALIGNMENT,
          },
        });

        // Continue drawing - use end point as new start point for chain drawing
        setWallStartPoint(point);
        setWallPreviewEndPoint(point);
      }
    },
    [wallPlacement, setWallStartPoint, setWallPreviewEndPoint, resetWallPlacement, addElement, activeStoreyId]
  );

  // Handle stage click for tool operations
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Only handle left clicks
      if (e.evt.button !== 0) return;

      // For select tool, only process clicks on the stage background (not elements)
      // For drawing tools, process clicks anywhere (click-through elements)
      const isDrawingTool = ['wall', 'slab', 'space-draw', 'space-detect', 'counter', 'column', 'stair', 'door', 'window', 'asset'].includes(activeTool);
      if (!isDrawingTool && e.target !== stageRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Convert to world coordinates
      const worldPos = screenToWorld(pointer.x, pointer.y);

      // Determine reference point for ortho snapping based on active tool
      let refPoint: Point2D | undefined;
      if (activeTool === 'wall' && wallPlacement.isPlacing && wallPlacement.startPoint) {
        refPoint = wallPlacement.startPoint;
      } else if (activeTool === 'slab' && slabPlacement.points.length > 0) {
        refPoint = slabPlacement.points[slabPlacement.points.length - 1];
      } else if (activeTool === 'space-draw' && spacePlacement.points.length > 0) {
        refPoint = spacePlacement.points[spacePlacement.points.length - 1];
      } else if (activeTool === 'counter' && counterPlacement.points.length > 0) {
        refPoint = counterPlacement.points[counterPlacement.points.length - 1];
      } else if (activeTool === 'stair' && stairPlacement.startPoint) {
        refPoint = stairPlacement.startPoint;
      }

      const snappedPos = applySnap(worldPos, refPoint);

      // Handle different tools
      switch (activeTool) {
        case 'select':
          // Selection is handled entirely in handleMouseDown/handleMouseUp for box selection
          // Don't clear selection here as it would override box selection results
          // Simple clicks are already handled in handleMouseUp (small box case)
          break;

        case 'wall':
          handleWallClick(snappedPos);
          break;

        case 'slab':
          handleSlabClick(snappedPos);
          break;

        case 'space-draw':
          handleSpaceClick(snappedPos);
          break;

        case 'space-detect':
          handleSpaceDetectClick(snappedPos);
          break;

        case 'counter':
          handleCounterClick(snappedPos);
          break;

        case 'column':
          handleColumnClick(snappedPos);
          break;

        case 'stair':
          handleStairClick(snappedPos);
          break;

        case 'door':
          handleDoorClick(snappedPos);
          break;

        case 'window':
          handleWindowClick(snappedPos);
          break;

        case 'asset':
          handleAssetClick(snappedPos);
          break;

        default:
          break;
      }
    },
    [activeTool, clearSelection, screenToWorld, applySnap, handleWallClick, handleSlabClick, handleSpaceClick, handleSpaceDetectClick, handleCounterClick,
     handleColumnClick, handleStairClick, handleDoorClick, handleWindowClick, handleAssetClick,
     wallPlacement.isPlacing, wallPlacement.startPoint, slabPlacement.points, spacePlacement.points, counterPlacement.points,
     stairPlacement.startPoint]
  );

  // Handle double-click for polygon completion
  const handleStageDoubleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return;

      switch (activeTool) {
        case 'slab':
          handleSlabDoubleClick();
          break;

        case 'space-draw':
          handleSpaceDoubleClick();
          break;

        case 'counter':
          handleCounterDoubleClick();
          break;

        default:
          break;
      }
    },
    [activeTool, handleSlabDoubleClick, handleSpaceDoubleClick, handleCounterDoubleClick]
  );

  // Render grid
  const renderGrid = () => {
    if (!showGrid) return null;

    const lines: JSX.Element[] = [];
    const gridSpacing = gridSize; // meters
    const majorGridEvery = 5; // Every 5th line is major

    // Calculate visible area in world coordinates
    const topLeft = {
      x: (-cad2dPanX - dimensions.width / 2) / cad2dZoom,
      y: (cad2dPanY + dimensions.height / 2) / cad2dZoom,
    };
    const bottomRight = {
      x: (-cad2dPanX + dimensions.width / 2) / cad2dZoom,
      y: (cad2dPanY - dimensions.height / 2) / cad2dZoom,
    };

    // Grid lines
    const startX = Math.floor(topLeft.x / gridSpacing) * gridSpacing;
    const endX = Math.ceil(bottomRight.x / gridSpacing) * gridSpacing;
    const startY = Math.floor(bottomRight.y / gridSpacing) * gridSpacing;
    const endY = Math.ceil(topLeft.y / gridSpacing) * gridSpacing;

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSpacing) {
      const isMajor = Math.abs(x) % (gridSpacing * majorGridEvery) < 0.001;
      const screenX = worldToScreen(x, 0).x;
      lines.push(
        <Line
          key={`v-${x}`}
          points={[screenX, 0, screenX, dimensions.height]}
          stroke={isMajor ? GRID_COLOR_MAJOR : GRID_COLOR}
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSpacing) {
      const isMajor = Math.abs(y) % (gridSpacing * majorGridEvery) < 0.001;
      const screenY = worldToScreen(0, y).y;
      lines.push(
        <Line
          key={`h-${y}`}
          points={[0, screenY, dimensions.width, screenY]}
          stroke={isMajor ? GRID_COLOR_MAJOR : GRID_COLOR}
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
    }

    return <>{lines}</>;
  };

  // Get all walls for corner calculation
  const allWallsForCorners = useMemo(() => {
    return activeStoreyId ? getWallsForStorey(activeStoreyId) : [];
  }, [activeStoreyId, getWallsForStorey]);

  // Render a wall as CAD lines with proper mitered corners
  const renderWall = (element: BimElement) => {
    if (!element.wallData) return null;

    const { startPoint, endPoint } = element.wallData;
    const isSelected = selectedIds.has(element.id);

    // Calculate mitered corner vertices using the new true miter algorithm
    const cornerVertices = calculateWallCornerVertices(element, allWallsForCorners);

    if (!cornerVertices) {
      // Fallback to simple rectangle if corner calculation fails
      const { thickness } = element.wallData;
      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length === 0) return null;

      const nx = -dy / length;
      const ny = dx / length;
      const halfThick = thickness / 2;

      const corners = [
        { x: startPoint.x + nx * halfThick, y: startPoint.y + ny * halfThick },
        { x: endPoint.x + nx * halfThick, y: endPoint.y + ny * halfThick },
        { x: endPoint.x - nx * halfThick, y: endPoint.y - ny * halfThick },
        { x: startPoint.x - nx * halfThick, y: startPoint.y - ny * halfThick },
      ];
      const screenCorners = corners.map((c) => worldToScreen(c.x, c.y));
      const points = screenCorners.flatMap((c) => [c.x, c.y]);

      return (
        <Group key={element.id} onClick={(e) => handleElementClick(element.id, e)}>
          <Line
            points={points}
            closed
            fill={isSelected ? '#cce0ff' : '#e8e8e8'}
            stroke={isSelected ? WALL_COLOR_SELECTED : WALL_COLOR}
            strokeWidth={isSelected ? 2 : 1}
          />
        </Group>
      );
    }

    // Use mitered corner vertices for clean corner joints
    // Order: startLeft -> endLeft -> endRight -> startRight (clockwise)
    const corners = [
      cornerVertices.startLeft,
      cornerVertices.endLeft,
      cornerVertices.endRight,
      cornerVertices.startRight,
    ];

    // Convert to screen coordinates
    const screenCorners = corners.map((c) => worldToScreen(c.x, c.y));
    const points = screenCorners.flatMap((c) => [c.x, c.y]);

    return (
      <Group key={element.id} onClick={(e) => handleElementClick(element.id, e)}>
        {/* Wall fill with mitered corners */}
        <Line
          points={points}
          closed
          fill={isSelected ? '#cce0ff' : '#e8e8e8'}
          stroke={isSelected ? WALL_COLOR_SELECTED : WALL_COLOR}
          strokeWidth={isSelected ? 2 : 1}
        />
        {/* Wall center line (dashed) */}
        <Line
          points={[
            worldToScreen(startPoint.x, startPoint.y).x,
            worldToScreen(startPoint.x, startPoint.y).y,
            worldToScreen(endPoint.x, endPoint.y).x,
            worldToScreen(endPoint.x, endPoint.y).y,
          ]}
          stroke={isSelected ? WALL_COLOR_SELECTED : '#999999'}
          strokeWidth={0.5}
          dash={[4, 4]}
        />
      </Group>
    );
  };

  // Render a door with CAD symbol (opening arc)
  const renderDoor = (element: BimElement) => {
    if (!element.doorData) return null;

    const { width, height, positionOnWall, hostWallId, swingDirection, swingSide } = element.doorData;
    const isSelected = selectedIds.has(element.id);

    // Get host wall to calculate door position
    const hostWall = elements.find((e) => e.id === hostWallId);
    if (!hostWall?.wallData) return null;

    const { startPoint, endPoint, thickness: wallThickness } = hostWall.wallData;
    const wallDx = endPoint.x - startPoint.x;
    const wallDy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
    if (wallLength === 0) return null;

    // Door position along wall
    const doorX = startPoint.x + wallDx * positionOnWall;
    const doorY = startPoint.y + wallDy * positionOnWall;

    // Direction along wall (normalized)
    const dirX = wallDx / wallLength;
    const dirY = wallDy / wallLength;

    // Door endpoints
    const halfWidth = width / 2;
    const doorStart = {
      x: doorX - dirX * halfWidth,
      y: doorY - dirY * halfWidth,
    };
    const doorEnd = {
      x: doorX + dirX * halfWidth,
      y: doorY + dirY * halfWidth,
    };

    const screenStart = worldToScreen(doorStart.x, doorStart.y);
    const screenEnd = worldToScreen(doorEnd.x, doorEnd.y);

    // Hinge position depends on swing direction
    // 'right' = hinge at right end of opening (doorEnd)
    // 'left' = hinge at left end of opening (doorStart)
    const hingeScreen = swingDirection === 'right' ? screenStart : screenEnd;
    const arcRadius = width * cad2dZoom;

    // Calculate wall angle in screen coordinates (Y is inverted)
    const screenWallAngleDeg = -Math.atan2(wallDy, wallDx) * (180 / Math.PI);

    // Open position is always perpendicular to wall:
    // 'outward' = towards positive normal (screenWallAngle + 90°)
    // 'inward' = towards negative normal (screenWallAngle - 90°)
    const openAngle = swingSide === 'outward'
      ? screenWallAngleDeg + 90
      : screenWallAngleDeg - 90;

    // Closed position depends on hinge side:
    // 'right' hinge: door points along +wall direction (towards doorEnd)
    // 'left' hinge: door points along -wall direction (towards doorStart)
    const closedAngle = swingDirection === 'right'
      ? screenWallAngleDeg
      : screenWallAngleDeg + 180;

    // Calculate sweep from closed to open
    let sweepAngle = openAngle - closedAngle;
    // Normalize to -180 to +180 range
    while (sweepAngle > 180) sweepAngle -= 360;
    while (sweepAngle < -180) sweepAngle += 360;

    // Arc rotation and angle - Konva Arc sweeps clockwise from rotation
    // If sweep is negative, we need to start from open and sweep positive
    const arcRotation = sweepAngle >= 0 ? closedAngle : openAngle;
    const arcSweep = Math.abs(sweepAngle);

    // Door leaf endpoint (open position)
    const leafEndX = hingeScreen.x + Math.cos(openAngle * Math.PI / 180) * arcRadius;
    const leafEndY = hingeScreen.y + Math.sin(openAngle * Math.PI / 180) * arcRadius;

    return (
      <Group key={element.id} onClick={(e) => handleElementClick(element.id, e)}>
        {/* Door opening (line in wall) */}
        <Line
          points={[screenStart.x, screenStart.y, screenEnd.x, screenEnd.y]}
          stroke={isSelected ? WALL_COLOR_SELECTED : DOOR_COLOR}
          strokeWidth={isSelected ? 3 : 2}
        />
        {/* Door swing arc */}
        <Arc
          x={hingeScreen.x}
          y={hingeScreen.y}
          innerRadius={arcRadius - 0.5}
          outerRadius={arcRadius}
          angle={arcSweep}
          rotation={arcRotation}
          stroke={isSelected ? WALL_COLOR_SELECTED : DOOR_COLOR}
          strokeWidth={1}
        />
        {/* Door leaf line (shows open position) */}
        <Line
          points={[hingeScreen.x, hingeScreen.y, leafEndX, leafEndY]}
          stroke={isSelected ? WALL_COLOR_SELECTED : DOOR_COLOR}
          strokeWidth={isSelected ? 2 : 1}
        />
        {/* Door dimensions label */}
        {(() => {
          const screenCenter = worldToScreen(doorX, doorY);
          // World-space normal direction (perpendicular to wall)
          const normX = -dirY;
          const normY = dirX;
          // Offset based on wall thickness (screen coords) + padding
          const screenWallHalfThickness = (wallThickness / 2) * cad2dZoom;
          const labelPadding = 14; // Minimum padding in pixels
          const labelOffset = screenWallHalfThickness + labelPadding;
          // Position label on the side opposite to door swing
          const labelSide = swingSide === 'outward' ? -1 : 1;
          // Apply offset in screen coords (Y is flipped, so negate normY)
          const labelX = screenCenter.x + normX * labelOffset * labelSide;
          const labelY = screenCenter.y - normY * labelOffset * labelSide;
          const dimensionText = `${Math.round(width * 100)}×${Math.round(height * 100)}`;

          // Calculate rotation to align with wall (screen coords have flipped Y)
          const wallAngleRad = Math.atan2(wallDy, wallDx);
          let rotationDeg = -wallAngleRad * (180 / Math.PI);
          // Keep text readable (not upside down)
          if (rotationDeg > 90 || rotationDeg < -90) {
            rotationDeg += 180;
          }

          const textWidth = 50;
          const textHeight = 12;

          return (
            <Text
              x={labelX}
              y={labelY}
              offsetX={textWidth / 2}
              offsetY={textHeight / 2}
              rotation={rotationDeg}
              width={textWidth}
              text={dimensionText}
              fontSize={10}
              fill={isSelected ? WALL_COLOR_SELECTED : DOOR_COLOR}
              align="center"
              fontStyle="bold"
            />
          );
        })()}
      </Group>
    );
  };

  // Render a window with CAD symbol
  const renderWindow = (element: BimElement) => {
    if (!element.windowData) return null;

    const { width, height, sillHeight, positionOnWall, hostWallId } = element.windowData;
    const isSelected = selectedIds.has(element.id);

    // Get host wall
    const hostWall = elements.find((e) => e.id === hostWallId);
    if (!hostWall?.wallData) return null;

    const { startPoint, endPoint, thickness } = hostWall.wallData;
    const wallDx = endPoint.x - startPoint.x;
    const wallDy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
    if (wallLength === 0) return null;

    // Window position along wall
    const winX = startPoint.x + wallDx * positionOnWall;
    const winY = startPoint.y + wallDy * positionOnWall;

    // Direction along wall
    const dirX = wallDx / wallLength;
    const dirY = wallDy / wallLength;

    // Normal
    const normX = -dirY;
    const normY = dirX;

    // Window endpoints
    const halfWidth = width / 2;
    const winStart = { x: winX - dirX * halfWidth, y: winY - dirY * halfWidth };
    const winEnd = { x: winX + dirX * halfWidth, y: winY + dirY * halfWidth };

    const screenStart = worldToScreen(winStart.x, winStart.y);
    const screenEnd = worldToScreen(winEnd.x, winEnd.y);

    // Glass line offset
    const glassOffset = thickness * 0.3 * cad2dZoom;

    return (
      <Group key={element.id} onClick={(e) => handleElementClick(element.id, e)}>
        {/* Window frame lines */}
        <Line
          points={[screenStart.x, screenStart.y, screenEnd.x, screenEnd.y]}
          stroke={isSelected ? WALL_COLOR_SELECTED : WINDOW_COLOR}
          strokeWidth={isSelected ? 3 : 2}
        />
        {/* Glass line (center) */}
        <Line
          points={[
            screenStart.x + normX * glassOffset,
            screenStart.y - normY * glassOffset,
            screenEnd.x + normX * glassOffset,
            screenEnd.y - normY * glassOffset,
          ]}
          stroke={isSelected ? WALL_COLOR_SELECTED : WINDOW_COLOR}
          strokeWidth={1}
        />
        {/* End caps */}
        <Line
          points={[
            screenStart.x - normX * glassOffset,
            screenStart.y + normY * glassOffset,
            screenStart.x + normX * glassOffset,
            screenStart.y - normY * glassOffset,
          ]}
          stroke={isSelected ? WALL_COLOR_SELECTED : WINDOW_COLOR}
          strokeWidth={1}
        />
        <Line
          points={[
            screenEnd.x - normX * glassOffset,
            screenEnd.y + normY * glassOffset,
            screenEnd.x + normX * glassOffset,
            screenEnd.y - normY * glassOffset,
          ]}
          stroke={isSelected ? WALL_COLOR_SELECTED : WINDOW_COLOR}
          strokeWidth={1}
        />
        {/* Window dimensions label */}
        {(() => {
          const screenCenter = worldToScreen(winX, winY);
          // Offset based on wall thickness (screen coords) + padding
          const screenWallHalfThickness = (thickness / 2) * cad2dZoom;
          const labelPadding = 14; // Minimum padding in pixels
          const labelOffset = screenWallHalfThickness + labelPadding;
          // Apply offset in screen coords (Y is flipped, so negate normY)
          const labelX = screenCenter.x + normX * labelOffset;
          const labelY = screenCenter.y - normY * labelOffset;
          const dimensionText = `${Math.round(width * 100)}×${Math.round(height * 100)} @${Math.round(sillHeight * 100)}`;

          // Calculate rotation to align with wall (screen coords have flipped Y)
          const wallAngleRad = Math.atan2(wallDy, wallDx);
          let rotationDeg = -wallAngleRad * (180 / Math.PI);
          // Keep text readable (not upside down)
          if (rotationDeg > 90 || rotationDeg < -90) {
            rotationDeg += 180;
          }

          const textWidth = 90;
          const textHeight = 12;

          return (
            <Text
              x={labelX}
              y={labelY}
              offsetX={textWidth / 2}
              offsetY={textHeight / 2}
              rotation={rotationDeg}
              width={textWidth}
              text={dimensionText}
              fontSize={10}
              fill={isSelected ? WALL_COLOR_SELECTED : WINDOW_COLOR}
              align="center"
              fontStyle="bold"
            />
          );
        })()}
      </Group>
    );
  };

  // Render a column
  const renderColumn = (element: BimElement) => {
    if (!element.columnData) return null;

    const { width, depth, profileType } = element.columnData;
    const { position } = element.placement;
    const isSelected = selectedIds.has(element.id);

    const screenPos = worldToScreen(position.x, position.y);

    if (profileType === 'circular') {
      const radius = (width / 2) * cad2dZoom;
      return (
        <Circle
          key={element.id}
          x={screenPos.x}
          y={screenPos.y}
          radius={radius}
          fill={isSelected ? '#cce0ff' : '#d0d0d0'}
          stroke={isSelected ? WALL_COLOR_SELECTED : COLUMN_COLOR}
          strokeWidth={isSelected ? 2 : 1}
          onClick={(e) => handleElementClick(element.id, e)}
        />
      );
    }

    // Rectangular column
    const screenWidth = width * cad2dZoom;
    const screenDepth = depth * cad2dZoom;

    return (
      <Rect
        key={element.id}
        x={screenPos.x - screenWidth / 2}
        y={screenPos.y - screenDepth / 2}
        width={screenWidth}
        height={screenDepth}
        fill={isSelected ? '#cce0ff' : '#d0d0d0'}
        stroke={isSelected ? WALL_COLOR_SELECTED : COLUMN_COLOR}
        strokeWidth={isSelected ? 2 : 1}
        onClick={(e) => handleElementClick(element.id, e)}
      />
    );
  };

  // Render a slab (floor/ceiling) as filled polygon
  const renderSlab = (element: BimElement) => {
    if (!element.slabData) return null;

    const { outline } = element.slabData;
    if (outline.length < 3) return null;

    const isSelected = selectedIds.has(element.id);

    // Convert outline to screen coordinates
    const screenPoints = outline.flatMap((p) => {
      const screen = worldToScreen(p.x, p.y);
      return [screen.x, screen.y];
    });

    return (
      <Group key={element.id} onClick={(e) => handleElementClick(element.id, e)}>
        <Line
          points={screenPoints}
          closed
          fill={isSelected ? '#cce0ff' : SLAB_FILL}
          stroke={isSelected ? WALL_COLOR_SELECTED : SLAB_COLOR}
          strokeWidth={isSelected ? 2 : 1}
          dash={[8, 4]}
        />
      </Group>
    );
  };

  // Render a space (room) as filled polygon with name label
  // Uses same color scheme as SpaceMesh.tsx (3D) and SpaceProperties.tsx for consistency
  // Render space fill only (labels rendered separately on top)
  const renderSpace = (element: BimElement) => {
    if (!element.spaceData) return null;

    const { boundaryPolygon, spaceType, gastroCategory } = element.spaceData;
    if (!boundaryPolygon || boundaryPolygon.length < 3) return null;

    const isSelected = selectedIds.has(element.id);

    // Get fill color based on gastro category (priority) or space type (fallback)
    // This matches the logic in SpaceMesh.tsx for 2D/3D consistency
    const fillColor = getSpaceFillColor(gastroCategory, spaceType);

    // Convert polygon to screen coordinates
    const screenPoints = boundaryPolygon.flatMap((p) => {
      const screen = worldToScreen(p.x, p.y);
      return [screen.x, screen.y];
    });

    return (
      <Group key={element.id} onClick={(e) => handleElementClick(element.id, e)}>
        {/* Space fill polygon */}
        <Line
          points={screenPoints}
          closed
          fill={isSelected ? 'rgba(255, 165, 0, 0.3)' : fillColor}
          stroke={isSelected ? SPACE_COLOR_SELECTED : SPACE_COLOR}
          strokeWidth={isSelected ? 2 : 1}
          dash={[4, 2]}
        />
      </Group>
    );
  };

  // Render space labels only (rendered on top of all other elements)
  const renderSpaceLabel = (element: BimElement) => {
    if (!element.spaceData) return null;

    const { boundaryPolygon, area, gastroCategory } = element.spaceData;
    if (!boundaryPolygon || boundaryPolygon.length < 3) return null;

    const isSelected = selectedIds.has(element.id);

    // Calculate centroid for label positioning
    let cx = 0;
    let cy = 0;
    for (const p of boundaryPolygon) {
      cx += p.x;
      cy += p.y;
    }
    cx /= boundaryPolygon.length;
    cy /= boundaryPolygon.length;
    const labelPos = worldToScreen(cx, cy);

    // Format area text
    const areaText = area ? `${area.toFixed(1)} m²` : '';

    // Get gastro category label (if set and not SONSTIGES)
    const categoryLabel = gastroCategory && gastroCategory !== 'SONSTIGES'
      ? GASTRO_SPACE_LABELS[gastroCategory]
      : null;

    // Calculate label box height based on content
    const labelHeight = categoryLabel ? 48 : 36;
    const labelOffsetY = categoryLabel ? -24 : -18;

    return (
      <Group key={`${element.id}-label`}>
        {/* Space name label */}
        <Rect
          x={labelPos.x - 50}
          y={labelPos.y + labelOffsetY}
          width={100}
          height={labelHeight}
          fill="rgba(255, 255, 255, 0.9)"
          cornerRadius={4}
          stroke={isSelected ? SPACE_COLOR_SELECTED : '#999'}
          strokeWidth={1}
        />
        <Text
          x={labelPos.x}
          y={labelPos.y + labelOffsetY + 6}
          text={element.name}
          fontSize={12}
          fontStyle="bold"
          fill={isSelected ? SPACE_COLOR_SELECTED : '#333'}
          align="center"
          verticalAlign="middle"
          offsetX={50}
          width={100}
        />
        {categoryLabel && (
          <Text
            x={labelPos.x}
            y={labelPos.y + labelOffsetY + 20}
            text={categoryLabel}
            fontSize={9}
            fill="#666"
            align="center"
            verticalAlign="middle"
            offsetX={50}
            width={100}
          />
        )}
        {areaText && (
          <Text
            x={labelPos.x}
            y={labelPos.y + labelOffsetY + (categoryLabel ? 32 : 20)}
            text={areaText}
            fontSize={10}
            fill="#555"
            align="center"
            verticalAlign="middle"
            offsetX={50}
            width={100}
          />
        )}
      </Group>
    );
  };

  // Render a counter as thick polyline with offset
  // Uses the same offsetPath algorithm as the 3D rendering for consistency
  const renderCounter = (element: BimElement) => {
    if (!element.counterData) return null;

    const { path, depth } = element.counterData;
    if (path.length < 2) return null;

    const isSelected = selectedIds.has(element.id);

    // Use the same offset algorithm as 3D rendering (proper miter joins)
    const backPath = offsetPath(path, depth);
    const polygon = createCounterPolygon(path, backPath);

    if (polygon.length < 3) return null;

    // Convert polygon to screen coordinates
    const screenPoints = polygon.flatMap((p) => {
      const screen = worldToScreen(p.x, p.y);
      return [screen.x, screen.y];
    });

    // Front line for emphasis (customer side)
    const frontScreenPoints = path.flatMap((p) => {
      const screen = worldToScreen(p.x, p.y);
      return [screen.x, screen.y];
    });

    return (
      <Group key={element.id} onClick={(e) => handleElementClick(element.id, e)}>
        {/* Counter body */}
        <Line
          points={screenPoints}
          closed
          fill={isSelected ? '#ffe4c4' : COUNTER_FILL}
          stroke={isSelected ? WALL_COLOR_SELECTED : COUNTER_COLOR}
          strokeWidth={isSelected ? 2 : 1}
        />
        {/* Front edge (customer side) - thicker */}
        <Line
          points={frontScreenPoints}
          stroke={isSelected ? WALL_COLOR_SELECTED : COUNTER_COLOR}
          strokeWidth={isSelected ? 3 : 2}
        />
      </Group>
    );
  };

  // Render a stair with CAD symbol (steps and direction arrow)
  const renderStair = (element: BimElement) => {
    if (!element.stairData) return null;

    const { width, steps, rotation: stairRotation } = element.stairData;
    const { position } = element.placement;
    const isSelected = selectedIds.has(element.id);

    const { runLength, count, treadDepth } = steps;
    const halfWidth = width / 2;

    // Transform local to world coordinates
    const cos = Math.cos(stairRotation);
    const sin = Math.sin(stairRotation);

    const localToWorld = (lx: number, ly: number) => ({
      x: position.x + lx * cos - ly * sin,
      y: position.y + lx * sin + ly * cos,
    });

    // Stair outline corners (local coords)
    const corners = [
      localToWorld(0, -halfWidth),
      localToWorld(runLength, -halfWidth),
      localToWorld(runLength, halfWidth),
      localToWorld(0, halfWidth),
    ];

    const screenCorners = corners.map((c) => worldToScreen(c.x, c.y));
    const outlinePoints = screenCorners.flatMap((c) => [c.x, c.y]);

    // Step lines
    const stepLines: JSX.Element[] = [];
    for (let i = 1; i < count; i++) {
      const stepX = i * treadDepth;
      const stepStart = localToWorld(stepX, -halfWidth);
      const stepEnd = localToWorld(stepX, halfWidth);
      const screenStart = worldToScreen(stepStart.x, stepStart.y);
      const screenEnd = worldToScreen(stepEnd.x, stepEnd.y);

      stepLines.push(
        <Line
          key={`step-${i}`}
          points={[screenStart.x, screenStart.y, screenEnd.x, screenEnd.y]}
          stroke={isSelected ? WALL_COLOR_SELECTED : STAIR_COLOR}
          strokeWidth={0.5}
        />
      );
    }

    // Direction arrow (shows upward direction)
    const arrowBaseX = runLength * 0.3;
    const arrowTipX = runLength * 0.7;
    const arrowBase = localToWorld(arrowBaseX, 0);
    const arrowTip = localToWorld(arrowTipX, 0);
    const arrowLeft = localToWorld(arrowTipX - width * 0.15, -width * 0.12);
    const arrowRight = localToWorld(arrowTipX - width * 0.15, width * 0.12);

    const screenArrowBase = worldToScreen(arrowBase.x, arrowBase.y);
    const screenArrowTip = worldToScreen(arrowTip.x, arrowTip.y);
    const screenArrowLeft = worldToScreen(arrowLeft.x, arrowLeft.y);
    const screenArrowRight = worldToScreen(arrowRight.x, arrowRight.y);

    return (
      <Group key={element.id} onClick={(e) => handleElementClick(element.id, e)}>
        {/* Stair outline */}
        <Line
          points={outlinePoints}
          closed
          fill={isSelected ? '#cce0ff' : STAIR_FILL}
          stroke={isSelected ? WALL_COLOR_SELECTED : STAIR_COLOR}
          strokeWidth={isSelected ? 2 : 1}
        />
        {/* Step lines */}
        {stepLines}
        {/* Direction arrow shaft */}
        <Line
          points={[screenArrowBase.x, screenArrowBase.y, screenArrowTip.x, screenArrowTip.y]}
          stroke={isSelected ? WALL_COLOR_SELECTED : STAIR_ARROW_COLOR}
          strokeWidth={1.5}
        />
        {/* Arrow head */}
        <Line
          points={[
            screenArrowLeft.x, screenArrowLeft.y,
            screenArrowTip.x, screenArrowTip.y,
            screenArrowRight.x, screenArrowRight.y,
          ]}
          stroke={isSelected ? WALL_COLOR_SELECTED : STAIR_ARROW_COLOR}
          strokeWidth={1.5}
        />
      </Group>
    );
  };

  // Render furniture/asset as rectangle with optional label
  const renderFurniture = (element: BimElement) => {
    if (!element.furnitureData) return null;

    const { width, depth } = element.furnitureData;
    const { position } = element.placement;
    const isSelected = selectedIds.has(element.id);

    const screenPos = worldToScreen(position.x, position.y);
    const screenWidth = width * cad2dZoom;
    const screenDepth = depth * cad2dZoom;

    // Get rotation from placement (convert quaternion to angle)
    const { rotation } = element.placement;
    // Simple conversion assuming rotation around Z axis
    const angle = Math.atan2(2 * (rotation.w * rotation.z + rotation.x * rotation.y),
                            1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z));
    const angleDeg = -angle * (180 / Math.PI); // Negative for screen coords

    return (
      <Group
        key={element.id}
        x={screenPos.x}
        y={screenPos.y}
        rotation={angleDeg}
        onClick={(e) => handleElementClick(element.id, e)}
      >
        {/* Furniture rectangle */}
        <Rect
          x={-screenWidth / 2}
          y={-screenDepth / 2}
          width={screenWidth}
          height={screenDepth}
          fill={isSelected ? '#cce0ff' : FURNITURE_FILL}
          stroke={isSelected ? WALL_COLOR_SELECTED : FURNITURE_COLOR}
          strokeWidth={isSelected ? 2 : 1}
        />
        {/* Diagonal cross to indicate furniture */}
        <Line
          points={[-screenWidth / 2, -screenDepth / 2, screenWidth / 2, screenDepth / 2]}
          stroke={isSelected ? WALL_COLOR_SELECTED : FURNITURE_COLOR}
          strokeWidth={0.5}
          opacity={0.5}
        />
        <Line
          points={[screenWidth / 2, -screenDepth / 2, -screenWidth / 2, screenDepth / 2]}
          stroke={isSelected ? WALL_COLOR_SELECTED : FURNITURE_COLOR}
          strokeWidth={0.5}
          opacity={0.5}
        />
        {/* Name label if zoomed in enough */}
        {cad2dZoom > 30 && (
          <Text
            x={-screenWidth / 2 + 2}
            y={-screenDepth / 2 + 2}
            text={element.name}
            fontSize={Math.min(10, screenDepth * 0.3)}
            fill={isSelected ? WALL_COLOR_SELECTED : FURNITURE_COLOR}
          />
        )}
      </Group>
    );
  };

  // Render wall length dimension
  const renderWallDimension = (wall: BimElement) => {
    if (!wall.wallData) return null;

    const dims = generateElementDimensions(wall, dimensionSettings);
    if (dims.length === 0) return null;

    const dim = dims[0]; // Wall length dimension
    if (!dim || !dim.measureLine) return null;

    const { measureLine, position2D, displayText } = dim;

    // Calculate offset line points
    const offsetLine = calculateDimensionLinePoints(measureLine, position2D.offset);

    // Screen coordinates
    const screenStart = worldToScreen(measureLine.start.x, measureLine.start.y);
    const screenEnd = worldToScreen(measureLine.end.x, measureLine.end.y);
    const offsetStart = worldToScreen(offsetLine.start.x, offsetLine.start.y);
    const offsetEnd = worldToScreen(offsetLine.end.x, offsetLine.end.y);
    const textPos = worldToScreen(position2D.x, position2D.y);

    // Normalize text rotation for readability
    const angleDeg = normalizeTextRotation(-position2D.rotation * (180 / Math.PI));

    // Extension line length
    const extLen = 6;

    return (
      <Group key={`dim-${wall.id}`}>
        {/* Extension lines */}
        <Line
          points={[screenStart.x, screenStart.y, offsetStart.x, offsetStart.y]}
          stroke={DIMENSION_COLORS.line}
          strokeWidth={0.5}
        />
        <Line
          points={[screenEnd.x, screenEnd.y, offsetEnd.x, offsetEnd.y]}
          stroke={DIMENSION_COLORS.line}
          strokeWidth={0.5}
        />

        {/* Dimension line */}
        <Line
          points={[offsetStart.x, offsetStart.y, offsetEnd.x, offsetEnd.y]}
          stroke={DIMENSION_COLORS.primary}
          strokeWidth={1}
        />

        {/* Tick marks at ends (45-degree slashes) */}
        <Line
          points={[
            offsetStart.x - extLen / 2,
            offsetStart.y - extLen / 2,
            offsetStart.x + extLen / 2,
            offsetStart.y + extLen / 2,
          ]}
          stroke={DIMENSION_COLORS.primary}
          strokeWidth={1.5}
        />
        <Line
          points={[
            offsetEnd.x - extLen / 2,
            offsetEnd.y - extLen / 2,
            offsetEnd.x + extLen / 2,
            offsetEnd.y + extLen / 2,
          ]}
          stroke={DIMENSION_COLORS.primary}
          strokeWidth={1.5}
        />

        {/* Dimension text with background - wrapped in Group for correct rotation */}
        <Group
          x={textPos.x}
          y={textPos.y}
          rotation={angleDeg}
        >
          <Rect
            x={-20}
            y={-8}
            width={40}
            height={16}
            fill={DIMENSION_COLORS.background}
            cornerRadius={2}
          />
          <Text
            x={-20}
            y={-8}
            width={40}
            height={16}
            text={displayText}
            fontSize={dimensionSettings.fontSize2D}
            fill={DIMENSION_COLORS.primary}
            align="center"
            verticalAlign="middle"
            fontFamily="Arial, sans-serif"
          />
        </Group>
      </Group>
    );
  };

  // Render space area dimension
  const renderSpaceDimension = (space: BimElement) => {
    if (!space.spaceData) return null;

    const dims = generateElementDimensions(space, dimensionSettings);
    if (dims.length === 0) return null;

    const dim = dims[0]; // Space area dimension
    if (!dim) return null;

    const { position2D, displayText } = dim;
    const screenPos = worldToScreen(position2D.x, position2D.y);

    return (
      <Group key={`dim-${space.id}`}>
        {/* Background for readability */}
        <Rect
          x={screenPos.x - 30}
          y={screenPos.y - 12}
          width={60}
          height={24}
          fill={DIMENSION_COLORS.background}
          cornerRadius={3}
        />
        {/* Area text */}
        <Text
          x={screenPos.x}
          y={screenPos.y}
          text={displayText}
          fontSize={14}
          fill={DIMENSION_COLORS.primary}
          fontStyle="bold"
          align="center"
          verticalAlign="middle"
          offsetX={25}
          offsetY={6}
          fontFamily="Arial, sans-serif"
        />
      </Group>
    );
  };

  // Render all dimensions
  const renderDimensions = () => {
    if (!showDimensions) return null;

    const dimensionElements: JSX.Element[] = [];

    // Wall dimensions
    elements
      .filter((e) => e.type === 'wall' && e.wallData)
      .forEach((wall) => {
        const dim = renderWallDimension(wall);
        if (dim) dimensionElements.push(dim);
      });

    // Space dimensions
    elements
      .filter((e) => e.type === 'space' && e.spaceData)
      .forEach((space) => {
        const dim = renderSpaceDimension(space);
        if (dim) dimensionElements.push(dim);
      });

    return <>{dimensionElements}</>;
  };

  // Render all elements
  const renderElements = () => {
    const rendered: JSX.Element[] = [];

    // 0. Render spaces first (bottom-most layer - room fills with labels)
    if (showSpaces) {
      elements
        .filter((e) => e.type === 'space')
        .forEach((element) => {
          const space = renderSpace(element);
          if (space) rendered.push(space);
        });
    }

    // 1. Render slabs (above spaces)
    elements
      .filter((e) => e.type === 'slab')
      .forEach((element) => {
        const slab = renderSlab(element);
        if (slab) rendered.push(slab);
      });

    // 2. Render walls (main structure)
    elements
      .filter((e) => e.type === 'wall')
      .forEach((element) => {
        const wall = renderWall(element);
        if (wall) rendered.push(wall);
      });

    // 3. Render openings (doors, windows)
    elements
      .filter((e) => e.type === 'door')
      .forEach((element) => {
        const door = renderDoor(element);
        if (door) rendered.push(door);
      });

    elements
      .filter((e) => e.type === 'window')
      .forEach((element) => {
        const win = renderWindow(element);
        if (win) rendered.push(win);
      });

    // 4. Render columns
    elements
      .filter((e) => e.type === 'column')
      .forEach((element) => {
        const column = renderColumn(element);
        if (column) rendered.push(column);
      });

    // 5. Render counters
    elements
      .filter((e) => e.type === 'counter')
      .forEach((element) => {
        const counter = renderCounter(element);
        if (counter) rendered.push(counter);
      });

    // 6. Render stairs
    elements
      .filter((e) => e.type === 'stair')
      .forEach((element) => {
        const stair = renderStair(element);
        if (stair) rendered.push(stair);
      });

    // 7. Render furniture/assets
    elements
      .filter((e) => e.type === 'furniture')
      .forEach((element) => {
        const furniture = renderFurniture(element);
        if (furniture) rendered.push(furniture);
      });

    // 8. Render space labels last (top layer - above slabs and other elements)
    if (showSpaceLabels) {
      elements
        .filter((e) => e.type === 'space')
        .forEach((element) => {
          const label = renderSpaceLabel(element);
          if (label) rendered.push(label);
        });
    }

    return rendered;
  };

  // Render origin indicator
  const renderOrigin = () => {
    const origin = worldToScreen(0, 0);
    const axisLength = 50;

    return (
      <Group>
        {/* X axis (red) */}
        <Line points={[origin.x, origin.y, origin.x + axisLength, origin.y]} stroke="#ff0000" strokeWidth={2} />
        <Text x={origin.x + axisLength + 5} y={origin.y - 6} text="X" fill="#ff0000" fontSize={12} />
        {/* Y axis (green) */}
        <Line points={[origin.x, origin.y, origin.x, origin.y - axisLength]} stroke="#00ff00" strokeWidth={2} />
        <Text x={origin.x + 5} y={origin.y - axisLength - 15} text="Y" fill="#00ff00" fontSize={12} />
        {/* Origin circle */}
        <Circle x={origin.x} y={origin.y} radius={4} fill="#ffffff" stroke="#333333" strokeWidth={1} />
      </Group>
    );
  };

  // Render wall preview during placement
  const renderWallPreview = () => {
    if (activeTool !== 'wall' || !wallPlacement.isPlacing) return null;
    if (!wallPlacement.startPoint || !wallPlacement.previewEndPoint) return null;

    const { startPoint, previewEndPoint } = wallPlacement;
    const thickness = DEFAULT_WALL_THICKNESS;

    // Calculate wall direction and length
    const dx = previewEndPoint.x - startPoint.x;
    const dy = previewEndPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 0.01) return null;

    // Normal direction (perpendicular to wall)
    const nx = -dy / length;
    const ny = dx / length;
    const halfThick = thickness / 2;

    // Four corners of the preview wall
    const corners = [
      { x: startPoint.x + nx * halfThick, y: startPoint.y + ny * halfThick },
      { x: previewEndPoint.x + nx * halfThick, y: previewEndPoint.y + ny * halfThick },
      { x: previewEndPoint.x - nx * halfThick, y: previewEndPoint.y - ny * halfThick },
      { x: startPoint.x - nx * halfThick, y: startPoint.y - ny * halfThick },
    ];

    // Convert to screen coordinates
    const screenCorners = corners.map((c) => worldToScreen(c.x, c.y));
    const points = screenCorners.flatMap((c) => [c.x, c.y]);

    // Center line
    const screenStart = worldToScreen(startPoint.x, startPoint.y);
    const screenEnd = worldToScreen(previewEndPoint.x, previewEndPoint.y);

    // Dimension text position (midpoint with offset)
    const midX = (startPoint.x + previewEndPoint.x) / 2;
    const midY = (startPoint.y + previewEndPoint.y) / 2;
    const textOffset = 0.4;
    const textPos = worldToScreen(midX + nx * textOffset, midY + ny * textOffset);

    // Calculate text rotation for readability
    let angleDeg = -Math.atan2(dy, dx) * (180 / Math.PI);
    if (angleDeg > 90) angleDeg -= 180;
    if (angleDeg < -90) angleDeg += 180;

    return (
      <Group>
        {/* Preview wall fill - semi-transparent */}
        <Line
          points={points}
          closed
          fill="rgba(0, 102, 255, 0.2)"
          stroke="#0066ff"
          strokeWidth={2}
          dash={[8, 4]}
        />
        {/* Center line */}
        <Line
          points={[screenStart.x, screenStart.y, screenEnd.x, screenEnd.y]}
          stroke="#0066ff"
          strokeWidth={1}
          dash={[4, 4]}
        />
        {/* Start point indicator */}
        <Circle
          x={screenStart.x}
          y={screenStart.y}
          radius={5}
          fill="#0066ff"
          stroke="#ffffff"
          strokeWidth={1}
        />
        {/* End point indicator */}
        <Circle
          x={screenEnd.x}
          y={screenEnd.y}
          radius={4}
          fill="#ffffff"
          stroke="#0066ff"
          strokeWidth={2}
        />
        {/* Length dimension text */}
        <Group x={textPos.x} y={textPos.y} rotation={angleDeg}>
          <Rect
            x={-25}
            y={-10}
            width={50}
            height={20}
            fill="rgba(255, 255, 255, 0.9)"
            cornerRadius={3}
          />
          <Text
            x={-25}
            y={-10}
            width={50}
            height={20}
            text={`${length.toFixed(2)}m`}
            fontSize={12}
            fill="#0066ff"
            fontStyle="bold"
            align="center"
            verticalAlign="middle"
          />
        </Group>
      </Group>
    );
  };

  // Render polygon preview (for slab and space tools)
  const renderPolygonPreview = (
    points: Point2D[],
    previewPoint: Point2D | null,
    color: string,
    fillColor: string,
    label: string
  ) => {
    if (points.length === 0) return null;

    // Build preview polygon including preview point
    const allPoints = [...points];
    if (previewPoint) {
      allPoints.push(previewPoint);
    }

    // Convert to screen coordinates
    const screenPoints = allPoints.flatMap((p) => {
      const screen = worldToScreen(p.x, p.y);
      return [screen.x, screen.y];
    });

    // First point marker (for close detection)
    const firstPoint = points[0];
    if (!firstPoint) return null;
    const firstScreen = worldToScreen(firstPoint.x, firstPoint.y);

    // Calculate area for display
    const area = allPoints.length >= 3 ? calculatePolygonArea(allPoints) : 0;

    // Centroid for label
    let cx = 0, cy = 0;
    for (const p of allPoints) {
      cx += p.x;
      cy += p.y;
    }
    cx /= allPoints.length;
    cy /= allPoints.length;
    const labelPos = worldToScreen(cx, cy);

    return (
      <Group>
        {/* Polygon outline and fill */}
        {allPoints.length >= 3 && (
          <Line
            points={screenPoints}
            closed
            fill={fillColor}
            stroke={color}
            strokeWidth={2}
            dash={[8, 4]}
          />
        )}
        {/* Line segments if less than 3 points */}
        {allPoints.length < 3 && allPoints.length >= 2 && (
          <Line
            points={screenPoints}
            stroke={color}
            strokeWidth={2}
            dash={[8, 4]}
          />
        )}
        {/* Point markers */}
        {points.map((p, i) => {
          const screen = worldToScreen(p.x, p.y);
          return (
            <Circle
              key={i}
              x={screen.x}
              y={screen.y}
              radius={i === 0 ? 6 : 4}
              fill={i === 0 ? color : '#ffffff'}
              stroke={i === 0 ? '#ffffff' : color}
              strokeWidth={2}
            />
          );
        })}
        {/* Preview point marker */}
        {previewPoint && (
          <Circle
            x={worldToScreen(previewPoint.x, previewPoint.y).x}
            y={worldToScreen(previewPoint.x, previewPoint.y).y}
            radius={4}
            fill="#ffffff"
            stroke={color}
            strokeWidth={2}
            dash={[2, 2]}
          />
        )}
        {/* Close indicator when near first point */}
        {previewPoint && points.length >= 3 && firstPoint && distance2D(previewPoint, firstPoint) < SNAP_TOLERANCE && (
          <Circle
            x={firstScreen.x}
            y={firstScreen.y}
            radius={12}
            stroke={color}
            strokeWidth={2}
            dash={[4, 4]}
          />
        )}
        {/* Area label */}
        {allPoints.length >= 3 && (
          <Group x={labelPos.x} y={labelPos.y}>
            <Rect
              x={-40}
              y={-20}
              width={80}
              height={40}
              fill="rgba(255, 255, 255, 0.9)"
              cornerRadius={4}
            />
            <Text
              x={-40}
              y={-15}
              width={80}
              height={20}
              text={label}
              fontSize={10}
              fill="#666"
              align="center"
            />
            <Text
              x={-40}
              y={0}
              width={80}
              height={20}
              text={`${area.toFixed(2)} m²`}
              fontSize={12}
              fill={color}
              fontStyle="bold"
              align="center"
            />
          </Group>
        )}
      </Group>
    );
  };

  // Render slab preview
  const renderSlabPreview = () => {
    if (activeTool !== 'slab') return null;
    return renderPolygonPreview(
      slabPlacement.points,
      slabPlacement.previewPoint,
      '#9933ff', // Purple for slab
      'rgba(153, 51, 255, 0.15)',
      'Slab'
    );
  };

  // Render space preview
  const renderSpacePreview = () => {
    if (activeTool !== 'space-draw') return null;
    return renderPolygonPreview(
      spacePlacement.points,
      spacePlacement.previewPoint,
      '#00aa66', // Green for space
      'rgba(0, 170, 102, 0.15)',
      'Space'
    );
  };

  // Render counter path preview
  const renderCounterPreview = () => {
    if (activeTool !== 'counter') return null;
    if (counterPlacement.points.length === 0) return null;

    const points = counterPlacement.points;
    const previewPoint = counterPlacement.previewPoint;

    // Build preview path including preview point
    const allPoints = [...points];
    if (previewPoint) {
      allPoints.push(previewPoint);
    }

    // Convert to screen coordinates for the path line
    const screenPoints = allPoints.flatMap((p) => {
      const screen = worldToScreen(p.x, p.y);
      return [screen.x, screen.y];
    });

    // Calculate total length
    let totalLength = 0;
    for (let i = 1; i < allPoints.length; i++) {
      const prevPt = allPoints[i - 1];
      const currPt = allPoints[i];
      if (prevPt && currPt) {
        totalLength += distance2D(prevPt, currPt);
      }
    }

    return (
      <Group>
        {/* Path line */}
        <Line
          points={screenPoints}
          stroke="#8B4513"
          strokeWidth={3}
          lineCap="round"
          lineJoin="round"
        />
        {/* Depth indicator (offset line) */}
        {allPoints.length >= 2 && (() => {
          const depth = DEFAULT_COUNTER_DEPTH;
          const offsetPoints: number[] = [];

          for (let i = 0; i < allPoints.length; i++) {
            const p = allPoints[i];
            if (!p) continue;
            let nx = 0, ny = 0;

            if (i === 0 && allPoints.length > 1) {
              const next = allPoints[1];
              if (next) {
                const dx = next.x - p.x;
                const dy = next.y - p.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                  nx = -dy / len;
                  ny = dx / len;
                }
              }
            } else if (i === allPoints.length - 1 && allPoints.length > 1) {
              const prev = allPoints[i - 1];
              if (prev) {
                const dx = p.x - prev.x;
                const dy = p.y - prev.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                  nx = -dy / len;
                  ny = dx / len;
                }
              }
            } else if (allPoints.length > 2) {
              const prev = allPoints[i - 1];
              const next = allPoints[i + 1];
              if (prev && next) {
                const dx1 = p.x - prev.x;
                const dy1 = p.y - prev.y;
                const dx2 = next.x - p.x;
                const dy2 = next.y - p.y;
                const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (len1 > 0 && len2 > 0) {
                  const nx1 = -dy1 / len1;
                  const ny1 = dx1 / len1;
                  const nx2 = -dy2 / len2;
                  const ny2 = dx2 / len2;
                  nx = (nx1 + nx2) / 2;
                  ny = (ny1 + ny2) / 2;
                  const normalLen = Math.sqrt(nx * nx + ny * ny);
                  if (normalLen > 0) {
                    nx /= normalLen;
                    ny /= normalLen;
                  }
                }
              }
            }

            const offsetP = worldToScreen(p.x + nx * depth, p.y + ny * depth);
            offsetPoints.push(offsetP.x, offsetP.y);
          }

          return (
            <Line
              points={offsetPoints}
              stroke="#8B4513"
              strokeWidth={1}
              dash={[4, 4]}
              opacity={0.6}
            />
          );
        })()}
        {/* Point markers */}
        {points.map((p, i) => {
          const screen = worldToScreen(p.x, p.y);
          return (
            <Circle
              key={i}
              x={screen.x}
              y={screen.y}
              radius={i === 0 ? 5 : 4}
              fill={i === 0 ? '#8B4513' : '#ffffff'}
              stroke={i === 0 ? '#ffffff' : '#8B4513'}
              strokeWidth={2}
            />
          );
        })}
        {/* Preview point */}
        {previewPoint && (
          <Circle
            x={worldToScreen(previewPoint.x, previewPoint.y).x}
            y={worldToScreen(previewPoint.x, previewPoint.y).y}
            radius={4}
            fill="#ffffff"
            stroke="#8B4513"
            strokeWidth={2}
          />
        )}
        {/* Length label */}
        {allPoints.length >= 2 && (() => {
          const lastPt = allPoints[allPoints.length - 1];
          if (!lastPt) return null;
          const lastScreen = worldToScreen(lastPt.x, lastPt.y);
          return (
          <Group x={lastScreen.x + 15} y={lastScreen.y - 15}>
            <Rect
              x={0}
              y={0}
              width={60}
              height={20}
              fill="rgba(255, 255, 255, 0.9)"
              cornerRadius={3}
            />
            <Text
              x={0}
              y={0}
              width={60}
              height={20}
              text={`${totalLength.toFixed(2)}m`}
              fontSize={11}
              fill="#8B4513"
              fontStyle="bold"
              align="center"
              verticalAlign="middle"
            />
          </Group>
          );
        })()}
      </Group>
    );
  };

  // Render column preview
  const renderColumnPreview = () => {
    if (activeTool !== 'column') return null;
    if (!columnPlacement.previewPosition) return null;

    const pos = columnPlacement.previewPosition;
    const screenPos = worldToScreen(pos.x, pos.y);
    const { width, depth, profileType } = columnPlacement.params;

    // Scale dimensions to screen
    const screenWidth = width * cad2dZoom;
    const screenDepth = depth * cad2dZoom;

    if (profileType === 'circular') {
      const radius = screenWidth / 2;
      return (
        <Circle
          x={screenPos.x}
          y={screenPos.y}
          radius={radius}
          fill="rgba(102, 102, 102, 0.3)"
          stroke={COLUMN_COLOR}
          strokeWidth={2}
          dash={[4, 4]}
        />
      );
    }

    return (
      <Rect
        x={screenPos.x - screenWidth / 2}
        y={screenPos.y - screenDepth / 2}
        width={screenWidth}
        height={screenDepth}
        fill="rgba(102, 102, 102, 0.3)"
        stroke={COLUMN_COLOR}
        strokeWidth={2}
        dash={[4, 4]}
      />
    );
  };

  // Render stair preview
  const renderStairPreview = () => {
    if (activeTool !== 'stair') return null;
    if (!stairPlacement.startPoint) return null;

    const { startPoint, previewEndPoint, rotation, params } = stairPlacement;
    const screenStart = worldToScreen(startPoint.x, startPoint.y);

    // Calculate stair run length based on storey height or manual input
    const targetStorey = params.targetStoreyId
      ? storeys.find((s) => s.id === params.targetStoreyId)
      : null;

    // Use storey difference if available, otherwise use manual totalRise from params
    const totalRise = targetStorey && activeStorey
      ? Math.abs(targetStorey.elevation - activeStorey.elevation)
      : params.totalRise;

    const steps = calculateSteps(totalRise);
    const runLength = steps.runLength;
    const stairWidth = params.width;

    // Screen dimensions
    const screenRunLength = runLength * cad2dZoom;
    const screenWidth = stairWidth * cad2dZoom;

    // If no preview end point yet, show stair outline at start
    if (!previewEndPoint || (previewEndPoint.x === startPoint.x && previewEndPoint.y === startPoint.y)) {
      return (
        <Group x={screenStart.x} y={screenStart.y}>
          <Rect
            x={0}
            y={-screenWidth / 2}
            width={screenRunLength}
            height={screenWidth}
            fill="rgba(102, 102, 102, 0.2)"
            stroke={STAIR_COLOR}
            strokeWidth={2}
            dash={[6, 4]}
          />
          <Circle
            x={0}
            y={0}
            radius={5}
            fill={STAIR_COLOR}
          />
        </Group>
      );
    }

    // Show rotated stair preview
    // Negate rotation for screen coordinates (Y-axis is flipped)
    const rotationDeg = -rotation * (180 / Math.PI);

    return (
      <Group x={screenStart.x} y={screenStart.y} rotation={rotationDeg}>
        {/* Stair outline */}
        <Rect
          x={0}
          y={-screenWidth / 2}
          width={screenRunLength}
          height={screenWidth}
          fill="rgba(102, 102, 102, 0.3)"
          stroke={STAIR_COLOR}
          strokeWidth={2}
        />
        {/* Step lines */}
        {(() => {
          const stepLines: JSX.Element[] = [];
          const stepCount = steps.count;
          const screenStepDepth = screenRunLength / stepCount;
          for (let i = 1; i < stepCount; i++) {
            const x = i * screenStepDepth;
            stepLines.push(
              <Line
                key={i}
                points={[x, -screenWidth / 2, x, screenWidth / 2]}
                stroke={STAIR_COLOR}
                strokeWidth={1}
                opacity={0.5}
              />
            );
          }
          return stepLines;
        })()}
        {/* Direction arrow */}
        <Line
          points={[screenRunLength * 0.3, 0, screenRunLength * 0.7, 0]}
          stroke={STAIR_ARROW_COLOR}
          strokeWidth={2}
        />
        <Line
          points={[screenRunLength * 0.6, -screenWidth * 0.15, screenRunLength * 0.7, 0, screenRunLength * 0.6, screenWidth * 0.15]}
          stroke={STAIR_ARROW_COLOR}
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
        />
        {/* Start point marker */}
        <Circle
          x={0}
          y={0}
          radius={4}
          fill="#ffffff"
          stroke={STAIR_COLOR}
          strokeWidth={2}
        />
      </Group>
    );
  };

  // Render asset preview
  const renderAssetPreview = () => {
    if (activeTool !== 'asset') return null;
    if (!assetPlacement.params.assetId || !assetPlacement.previewPosition) return null;

    const pos = assetPlacement.previewPosition;
    const screenPos = worldToScreen(pos.x, pos.y);
    const asset = getAssetById(assetPlacement.params.assetId);
    if (!asset) return null;

    const scale = assetPlacement.params.scale;
    const rotation = assetPlacement.params.rotation;
    const screenWidth = asset.dimensions.width * scale * cad2dZoom;
    const screenDepth = asset.dimensions.depth * scale * cad2dZoom;

    return (
      <Group x={screenPos.x} y={screenPos.y} rotation={rotation}>
        <Rect
          x={-screenWidth / 2}
          y={-screenDepth / 2}
          width={screenWidth}
          height={screenDepth}
          fill="rgba(74, 74, 74, 0.3)"
          stroke={FURNITURE_COLOR}
          strokeWidth={2}
          dash={[4, 4]}
        />
        <Text
          x={-screenWidth / 2}
          y={screenDepth / 2 + 5}
          width={screenWidth}
          text={asset.name}
          fontSize={10}
          fill={FURNITURE_COLOR}
          align="center"
        />
      </Group>
    );
  };

  // Render door preview on wall (matches final door rendering logic)
  const renderDoorPreview = () => {
    if (activeTool !== 'door') return null;
    if (!doorPlacement.hostWallId || doorPlacement.previewPosition === null) return null;

    const wall = wallsForPreview.find((w) => w.id === doorPlacement.hostWallId);
    if (!wall || !wall.wallData) return null;

    const { startPoint, endPoint, thickness } = wall.wallData;
    const position = doorPlacement.previewPosition;
    const doorWidth = doorPlacement.params.width;
    const doorHeight = doorPlacement.params.height;
    const swingDirection = doorPlacement.params.swingDirection;
    const swingSide = doorPlacement.params.swingSide;

    const wallDx = endPoint.x - startPoint.x;
    const wallDy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
    if (wallLength === 0) return null;

    // Door position along wall
    const doorX = startPoint.x + wallDx * position;
    const doorY = startPoint.y + wallDy * position;

    // Direction along wall (normalized)
    const dirX = wallDx / wallLength;
    const dirY = wallDy / wallLength;

    // Door endpoints
    const halfWidth = doorWidth / 2;
    const doorStart = {
      x: doorX - dirX * halfWidth,
      y: doorY - dirY * halfWidth,
    };
    const doorEnd = {
      x: doorX + dirX * halfWidth,
      y: doorY + dirY * halfWidth,
    };

    const screenStart = worldToScreen(doorStart.x, doorStart.y);
    const screenEnd = worldToScreen(doorEnd.x, doorEnd.y);
    const screenCenter = worldToScreen(doorX, doorY);

    // Hinge position depends on swing direction (same as renderDoor)
    // 'right' = hinge at right end of opening (doorEnd -> screenStart in screen coords)
    // 'left' = hinge at left end of opening (doorStart -> screenEnd in screen coords)
    const hingeScreen = swingDirection === 'right' ? screenStart : screenEnd;
    const arcRadius = doorWidth * cad2dZoom;

    // Calculate wall angle in screen coordinates (Y is inverted)
    const screenWallAngleDeg = -Math.atan2(wallDy, wallDx) * (180 / Math.PI);

    // Open position is always perpendicular to wall (same as renderDoor)
    const openAngle = swingSide === 'outward'
      ? screenWallAngleDeg + 90
      : screenWallAngleDeg - 90;

    // Closed position depends on hinge side
    const closedAngle = swingDirection === 'right'
      ? screenWallAngleDeg
      : screenWallAngleDeg + 180;

    // Calculate sweep from closed to open
    let sweepAngle = openAngle - closedAngle;
    while (sweepAngle > 180) sweepAngle -= 360;
    while (sweepAngle < -180) sweepAngle += 360;

    const arcRotation = sweepAngle >= 0 ? closedAngle : openAngle;
    const arcSweep = Math.abs(sweepAngle);

    // Door leaf endpoint (open position)
    const leafEndX = hingeScreen.x + Math.cos(openAngle * Math.PI / 180) * arcRadius;
    const leafEndY = hingeScreen.y + Math.sin(openAngle * Math.PI / 180) * arcRadius;

    const isValid = doorPlacement.isValidPosition;
    const strokeColor = isValid ? DOOR_COLOR : '#ff0000';
    const fillColor = isValid ? 'rgba(0, 102, 204, 0.15)' : 'rgba(255, 0, 0, 0.15)';

    return (
      <Group>
        {/* Door opening (line in wall) - dashed for preview */}
        <Line
          points={[screenStart.x, screenStart.y, screenEnd.x, screenEnd.y]}
          stroke={strokeColor}
          strokeWidth={2}
          dash={[4, 4]}
        />
        {/* Door swing arc */}
        <Arc
          x={hingeScreen.x}
          y={hingeScreen.y}
          innerRadius={0}
          outerRadius={arcRadius}
          angle={arcSweep}
          rotation={arcRotation}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={1}
          dash={[2, 2]}
        />
        {/* Door leaf line (shows open position) */}
        <Line
          points={[hingeScreen.x, hingeScreen.y, leafEndX, leafEndY]}
          stroke={strokeColor}
          strokeWidth={1}
          dash={[2, 2]}
        />
        {/* Door dimensions label */}
        {(() => {
          const screenNormX = -dirY;
          const screenNormY = dirX;
          const screenWallHalfThickness = (thickness / 2) * cad2dZoom;
          const labelPadding = 12;
          const labelOffset = screenWallHalfThickness + labelPadding;
          const labelSide = swingSide === 'outward' ? -1 : 1;
          const labelX = screenCenter.x + screenNormX * labelOffset * labelSide;
          const labelY = screenCenter.y + screenNormY * labelOffset * labelSide;
          const dimensionText = `${Math.round(doorWidth * 100)}×${Math.round(doorHeight * 100)}`;

          const wallAngleRad = Math.atan2(wallDy, wallDx);
          let rotationDeg = -wallAngleRad * (180 / Math.PI);
          if (rotationDeg > 90 || rotationDeg < -90) {
            rotationDeg += 180;
          }

          return (
            <Text
              x={labelX}
              y={labelY}
              offsetX={25}
              offsetY={6}
              rotation={rotationDeg}
              width={50}
              text={dimensionText}
              fontSize={10}
              fill={strokeColor}
              align="center"
              fontStyle="bold"
            />
          );
        })()}
      </Group>
    );
  };

  // Render window preview on wall
  const renderWindowPreview = () => {
    if (activeTool !== 'window') return null;
    if (!windowPlacement.hostWallId || windowPlacement.previewPosition === null) return null;

    const wall = wallsForPreview.find((w) => w.id === windowPlacement.hostWallId);
    if (!wall || !wall.wallData) return null;

    const { startPoint, endPoint, thickness } = wall.wallData;
    const position = windowPlacement.previewPosition;
    const windowWidth = windowPlacement.params.width;
    const windowHeight = windowPlacement.params.height;
    const sillHeight = windowPlacement.params.sillHeight;

    // Calculate window center position on wall
    const centerX = startPoint.x + (endPoint.x - startPoint.x) * position;
    const centerY = startPoint.y + (endPoint.y - startPoint.y) * position;
    const screenCenter = worldToScreen(centerX, centerY);

    // Calculate wall angle for rotation
    const wallAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
    const rotationDeg = -wallAngle * (180 / Math.PI); // Negative because screen Y is flipped

    // Screen dimensions
    const screenWindowWidth = windowWidth * cad2dZoom;
    const screenThickness = thickness * cad2dZoom;

    const isValid = windowPlacement.isValidPosition;
    const fillColor = isValid ? 'rgba(0, 204, 204, 0.4)' : 'rgba(255, 0, 0, 0.3)';
    const strokeColor = isValid ? WINDOW_COLOR : '#ff0000';

    return (
      <Group x={screenCenter.x} y={screenCenter.y} rotation={rotationDeg}>
        {/* Window opening rectangle */}
        <Rect
          x={-screenWindowWidth / 2}
          y={-screenThickness / 2}
          width={screenWindowWidth}
          height={screenThickness}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={2}
          dash={[4, 4]}
        />
        {/* Window cross lines (glass pattern) */}
        <Line
          points={[0, -screenThickness / 2, 0, screenThickness / 2]}
          stroke={strokeColor}
          strokeWidth={1}
          dash={[2, 2]}
        />
        <Line
          points={[-screenWindowWidth / 2, 0, screenWindowWidth / 2, 0]}
          stroke={strokeColor}
          strokeWidth={1}
          dash={[2, 2]}
        />
        {/* Size and sill height indicator */}
        <Text
          x={-screenWindowWidth / 2}
          y={screenThickness / 2 + 5}
          width={screenWindowWidth}
          text={`${(windowWidth * 100).toFixed(0)}×${(windowHeight * 100).toFixed(0)}cm @${(sillHeight * 100).toFixed(0)}cm`}
          fontSize={9}
          fill={strokeColor}
          align="center"
        />
      </Group>
    );
  };

  // Render cursor crosshair for drawing tools
  const renderCursor = () => {
    if (activeTool === 'select' || activeTool === 'pan' || activeTool === 'orbit') return null;
    if (!cursorWorldPos) return null;

    const screenPos = worldToScreen(cursorWorldPos.x, cursorWorldPos.y);
    const crosshairSize = 10;

    return (
      <Group>
        {/* Vertical line */}
        <Line
          points={[screenPos.x, screenPos.y - crosshairSize, screenPos.x, screenPos.y + crosshairSize]}
          stroke="#ff6600"
          strokeWidth={1}
        />
        {/* Horizontal line */}
        <Line
          points={[screenPos.x - crosshairSize, screenPos.y, screenPos.x + crosshairSize, screenPos.y]}
          stroke="#ff6600"
          strokeWidth={1}
        />
        {/* Coordinate display */}
        <Text
          x={screenPos.x + 12}
          y={screenPos.y + 12}
          text={`${cursorWorldPos.x.toFixed(2)}, ${cursorWorldPos.y.toFixed(2)}`}
          fontSize={10}
          fill="#666666"
        />
      </Group>
    );
  };

  // Render scale indicator
  const renderScaleIndicator = () => {
    const scaleBarLength = 100; // pixels
    const worldLength = scaleBarLength / cad2dZoom; // meters
    const roundedLength = worldLength >= 1 ? Math.round(worldLength) : Math.round(worldLength * 10) / 10;
    const adjustedBarLength = roundedLength * cad2dZoom;

    return (
      <Group x={20} y={dimensions.height - 40}>
        <Line points={[0, 0, adjustedBarLength, 0]} stroke="#333333" strokeWidth={2} />
        <Line points={[0, -5, 0, 5]} stroke="#333333" strokeWidth={2} />
        <Line points={[adjustedBarLength, -5, adjustedBarLength, 5]} stroke="#333333" strokeWidth={2} />
        <Text x={adjustedBarLength / 2 - 15} y={5} text={`${roundedLength}m`} fill="#333333" fontSize={11} />
      </Group>
    );
  };

  // Render box selection rectangle
  const renderBoxSelection = () => {
    if (!boxSelect.isActive || !boxSelect.startPoint || !boxSelect.currentPoint) {
      return null;
    }

    const start = worldToScreen(boxSelect.startPoint.x, boxSelect.startPoint.y);
    const end = worldToScreen(boxSelect.currentPoint.x, boxSelect.currentPoint.y);

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    return (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="rgba(0, 102, 255, 0.1)"
        stroke="#0066ff"
        strokeWidth={1}
        dash={[4, 4]}
      />
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#fafafa]" onContextMenu={(e) => e.preventDefault()}>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onClick={handleStageClick}
        onDblClick={handleStageDoubleClick}
      >
        {/* Grid Layer */}
        <Layer listening={false}>{renderGrid()}</Layer>

        {/* Elements Layer */}
        <Layer>{renderElements()}</Layer>

        {/* Preview Layer - for active tool previews */}
        <Layer listening={false}>
          {renderWallPreview()}
          {renderSlabPreview()}
          {renderSpacePreview()}
          {renderCounterPreview()}
          {renderColumnPreview()}
          {renderStairPreview()}
          {renderAssetPreview()}
          {renderDoorPreview()}
          {renderWindowPreview()}
          {renderBoxSelection()}
          {renderCursor()}
        </Layer>

        {/* Dimensions Layer */}
        <Layer listening={false}>{renderDimensions()}</Layer>

        {/* UI Layer (origin, scale) */}
        <Layer listening={false}>
          {renderOrigin()}
          {renderScaleIndicator()}
        </Layer>
      </Stage>

      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 bg-background/80 px-2 py-1 rounded text-xs">
        Zoom: {Math.round(cad2dZoom)}x | Pan: MMB
      </div>
    </div>
  );
}

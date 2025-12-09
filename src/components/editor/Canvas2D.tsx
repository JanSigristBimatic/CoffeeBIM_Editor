import { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Line, Rect, Circle, Arc, Text, Group } from 'react-konva';
import type { Stage as StageType } from 'konva/lib/Stage';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useElementStore, useViewStore, useSelectionStore, useProjectStore, useToolStore } from '@/store';
import type { BimElement } from '@/types/bim';
import { DEFAULT_WALL_THICKNESS, DEFAULT_WALL_HEIGHT } from '@/types/bim';
import type { Point2D } from '@/types/geometry';
import {
  generateElementDimensions,
  calculateDimensionLinePoints,
  normalizeTextRotation,
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
const SPACE_FILL_INTERNAL = 'rgba(135, 206, 235, 0.25)'; // Light blue
const SPACE_FILL_EXTERNAL = 'rgba(144, 238, 144, 0.25)'; // Light green
const SPACE_FILL_DEFAULT = 'rgba(211, 211, 211, 0.25)'; // Light gray
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
  const { cad2dZoom, cad2dPanX, cad2dPanY, setCad2dZoom, setCad2dPan, showGrid, gridSize, showDimensions, dimensionSettings, snapSettings } = useViewStore();
  const { getAllElements, getElementsByStorey, addElement } = useElementStore();
  const { selectedIds, select, clearSelection, toggleSelection } = useSelectionStore();
  const { activeStoreyId } = useProjectStore();
  const {
    activeTool,
    wallPlacement,
    setWallStartPoint,
    setWallPreviewEndPoint,
    resetWallPlacement,
    setCursorPosition,
    cancelCurrentOperation,
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

  // Keyboard handler for Escape to cancel operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelCurrentOperation();
        setCursorWorldPos(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelCurrentOperation]);

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

  // Apply grid snapping if enabled
  const applyGridSnap = useCallback(
    (point: Point2D): Point2D => {
      if (!snapSettings.enabled || !snapSettings.grid) {
        return point;
      }
      return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
      };
    },
    [snapSettings, gridSize]
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
      }
    },
    []
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

      // Track cursor position for active drawing tools
      if (activeTool !== 'select' && activeTool !== 'pan' && activeTool !== 'orbit') {
        const stage = stageRef.current;
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        // Convert screen to world coordinates
        const worldPos = screenToWorld(pointer.x, pointer.y);
        const snappedPos = applyGridSnap(worldPos);

        // Update local cursor state
        setCursorWorldPos(snappedPos);

        // Update global cursor position for snap preview
        setCursorPosition(snappedPos);

        // Update wall preview end point if placing wall
        if (activeTool === 'wall' && wallPlacement.isPlacing) {
          setWallPreviewEndPoint(snappedPos);
        }
      }
    },
    [isPanning, lastPanPos, cad2dPanX, cad2dPanY, setCad2dPan, activeTool, screenToWorld, applyGridSnap, setCursorPosition, wallPlacement.isPlacing, setWallPreviewEndPoint]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Prevent context menu
  const handleContextMenu = useCallback((e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
  }, []);

  // Handle element click for selection
  const handleElementClick = useCallback(
    (elementId: string, e: KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;

      e.cancelBubble = true; // Prevent stage click

      if (e.evt.shiftKey || e.evt.ctrlKey) {
        toggleSelection(elementId);
      } else {
        select(elementId);
      }
    },
    [activeTool, select, toggleSelection]
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
      // Only handle left clicks on the stage itself
      if (e.evt.button !== 0) return;
      if (e.target !== stageRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Convert to world coordinates with snapping
      const worldPos = screenToWorld(pointer.x, pointer.y);
      const snappedPos = applyGridSnap(worldPos);

      // Handle different tools
      switch (activeTool) {
        case 'select':
          clearSelection();
          break;

        case 'wall':
          handleWallClick(snappedPos);
          break;

        // Future tools will be added here
        default:
          break;
      }
    },
    [activeTool, clearSelection, screenToWorld, applyGridSnap, handleWallClick]
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

  // Render a wall as CAD lines
  const renderWall = (element: BimElement) => {
    if (!element.wallData) return null;

    const { startPoint, endPoint, thickness } = element.wallData;
    const isSelected = selectedIds.has(element.id);

    // Calculate wall rectangle corners
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return null;

    // Normal direction (perpendicular to wall)
    const nx = -dy / length;
    const ny = dx / length;
    const halfThick = thickness / 2;

    // Four corners of the wall
    const corners = [
      { x: startPoint.x + nx * halfThick, y: startPoint.y + ny * halfThick },
      { x: endPoint.x + nx * halfThick, y: endPoint.y + ny * halfThick },
      { x: endPoint.x - nx * halfThick, y: endPoint.y - ny * halfThick },
      { x: startPoint.x - nx * halfThick, y: startPoint.y - ny * halfThick },
    ];

    // Convert to screen coordinates
    const screenCorners = corners.map((c) => worldToScreen(c.x, c.y));
    const points = screenCorners.flatMap((c) => [c.x, c.y]);

    return (
      <Group key={element.id} onClick={(e) => handleElementClick(element.id, e)}>
        {/* Wall fill */}
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

    const { width, positionOnWall, hostWallId, swingDirection, swingSide } = element.doorData;
    const isSelected = selectedIds.has(element.id);

    // Get host wall to calculate door position
    const hostWall = elements.find((e) => e.id === hostWallId);
    if (!hostWall?.wallData) return null;

    const { startPoint, endPoint } = hostWall.wallData;
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
      </Group>
    );
  };

  // Render a window with CAD symbol
  const renderWindow = (element: BimElement) => {
    if (!element.windowData) return null;

    const { width, positionOnWall, hostWallId } = element.windowData;
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
  const renderSpace = (element: BimElement) => {
    if (!element.spaceData) return null;

    const { boundaryPolygon, spaceType, area } = element.spaceData;
    if (!boundaryPolygon || boundaryPolygon.length < 3) return null;

    const isSelected = selectedIds.has(element.id);

    // Get fill color based on space type
    let fillColor = SPACE_FILL_DEFAULT;
    if (spaceType === 'INTERNAL') {
      fillColor = SPACE_FILL_INTERNAL;
    } else if (spaceType === 'EXTERNAL') {
      fillColor = SPACE_FILL_EXTERNAL;
    }

    // Convert polygon to screen coordinates
    const screenPoints = boundaryPolygon.flatMap((p) => {
      const screen = worldToScreen(p.x, p.y);
      return [screen.x, screen.y];
    });

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
        {/* Space name label */}
        <Rect
          x={labelPos.x - 50}
          y={labelPos.y - 18}
          width={100}
          height={36}
          fill="rgba(255, 255, 255, 0.9)"
          cornerRadius={4}
          stroke={isSelected ? SPACE_COLOR_SELECTED : '#999'}
          strokeWidth={1}
        />
        <Text
          x={labelPos.x}
          y={labelPos.y - 8}
          text={element.name}
          fontSize={12}
          fontStyle="bold"
          fill={isSelected ? SPACE_COLOR_SELECTED : '#333'}
          align="center"
          verticalAlign="middle"
          offsetX={50}
          width={100}
        />
        {areaText && (
          <Text
            x={labelPos.x}
            y={labelPos.y + 6}
            text={areaText}
            fontSize={10}
            fill="#666"
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
    elements
      .filter((e) => e.type === 'space')
      .forEach((element) => {
        const space = renderSpace(element);
        if (space) rendered.push(space);
      });

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

    // 7. Render furniture/assets (top layer)
    elements
      .filter((e) => e.type === 'furniture')
      .forEach((element) => {
        const furniture = renderFurniture(element);
        if (furniture) rendered.push(furniture);
      });

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
      >
        {/* Grid Layer */}
        <Layer listening={false}>{renderGrid()}</Layer>

        {/* Elements Layer */}
        <Layer>{renderElements()}</Layer>

        {/* Preview Layer - for active tool previews */}
        <Layer listening={false}>
          {renderWallPreview()}
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

export {
  snapToGrid,
  snapPointToGrid,
  snapPoint,
  distance2D,
  lerp,
  clamp,
  degToRad,
  radToDeg,
  findNearestPoint,
  angleBetweenPoints,
  normalizeAngle,
  anglesEqual,
  // Extended snap functions
  getMidpoint,
  getSegmentLength,
  getSegmentDirection,
  nearestPointOnSegment,
  perpendicularToSegment,
  snapPointAdvanced,
  getSnapCandidates,
  // Element utilities
  getElementCenter,
  // Wall geometry utilities (DRY)
  calculateWallGeometry,
  getPointOnWall,
} from './math';

export type { SnapCandidate, WallGeometry } from './math';

// Dimension calculations
export {
  calculateWallLength,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculatePolygonCentroid,
  calculateWallDimensionPosition,
  formatDimensionValue,
  generateWallLengthDimension,
  generateSpaceAreaDimension,
  generateElementDimensions,
  generateAllDimensions,
  calculateDimensionLinePoints,
  normalizeTextRotation,
} from './dimensions';

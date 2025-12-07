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
} from './math';

export type { SnapCandidate } from './math';

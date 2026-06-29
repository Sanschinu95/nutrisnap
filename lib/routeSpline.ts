/**
 * Shared SVG-path geometry for the Route spline. Both the in-app chart and
 * the share-story renderer call into here so the curve shape is identical
 * regardless of canvas dimensions or styling.
 *
 * The spline is monotone cubic Hermite — same algorithm as d3.curveMonotoneX —
 * so the curve passes through every data point with C1 continuity and never
 * overshoots in a way that would imply calories decreased.
 */

import type { RoutePoint } from './routePoints';

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export function projectPoints(
  points: RoutePoint[],
  width: number,
  height: number,
  padding: Padding,
): PixelPoint[] {
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  return points.map((p) => ({
    x: padding.left + p.x * plotW,
    y: padding.top + (1 - p.y) * plotH,
  }));
}

function monotoneTangents(points: PixelPoint[]): number[] {
  const n = points.length;
  if (n < 2) return new Array(n).fill(0);

  const deltas: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    deltas.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }

  slopes.push(deltas[0]);
  for (let i = 1; i < n - 1; i++) {
    slopes.push(deltas[i - 1] * deltas[i] <= 0 ? 0 : (deltas[i - 1] + deltas[i]) / 2);
  }
  slopes.push(deltas[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(deltas[i]) < 1e-12) {
      slopes[i] = 0;
      slopes[i + 1] = 0;
      continue;
    }
    const alpha = slopes[i] / deltas[i];
    const beta = slopes[i + 1] / deltas[i];
    const s = alpha * alpha + beta * beta;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      slopes[i] = t * alpha * deltas[i];
      slopes[i + 1] = t * beta * deltas[i];
    }
  }
  return slopes;
}

export function buildSplinePath(points: PixelPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const tangents = monotoneTangents(points);
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) / 3;
    const cp1x = p0.x + dx;
    const cp1y = p0.y + tangents[i] * dx;
    const cp2x = p1.x - dx;
    const cp2y = p1.y - tangents[i + 1] * dx;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function buildAreaPath(
  splinePath: string,
  pixelPoints: PixelPoint[],
  baselineY: number,
): string {
  if (pixelPoints.length < 2 || !splinePath) return '';
  const last = pixelPoints[pixelPoints.length - 1];
  const first = pixelPoints[0];
  return `${splinePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

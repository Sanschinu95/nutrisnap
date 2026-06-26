/**
 * NutritionRouteChart — unified chart component with three render modes and
 * two orientations.  Replaces the old NutritionRoute.tsx.
 *
 * Render modes:
 *   • spline  — smooth monotone-cubic curve with gradient fill (default)
 *   • bar     — vertical bars with star marker on peak, optional goal pill
 *   • dual-line — two overlaid splines (primary + secondary) with gridlines
 *
 * Orientations:
 *   • horizontal — Home tab (x = time, y = calories)
 *   • vertical   — Progress tab (axes flipped, circular image nodes)
 */

import React, { useMemo, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RouteDataPoint {
  timestamp: string;
  calories: number;
  mealId: string;
  thumbnailUrl?: string;
  source?: 'scan' | 'manual';
}

export type ChartMode = 'spline' | 'bar' | 'dual-line';
export type ChartOrientation = 'horizontal' | 'vertical';

export interface NutritionRouteChartProps {
  data: RouteDataPoint[];
  mode?: ChartMode;
  orientation?: ChartOrientation;
  calorieGoal?: number;
  /** Secondary series for dual-line mode (e.g. consistency scores mapped 0–100) */
  secondaryData?: number[];
  onNodePress?: (mealId: string) => void;
  width?: number;
  height?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const DEFAULT_H_WIDTH = Math.min(SCREEN_WIDTH - 48, 380);
const DEFAULT_H_HEIGHT = 200;
const DEFAULT_V_WIDTH = Math.min(SCREEN_WIDTH - 64, 300);
const DEFAULT_V_HEIGHT = 480;

const PADDING = { top: 24, right: 24, bottom: 32, left: 24 };

// ─── Sample mock data for empty-state ─────────────────────────────────────────

const MOCK_DATA: RouteDataPoint[] = [
  { timestamp: '08:00', calories: 320, mealId: 'mock-1' },
  { timestamp: '10:00', calories: 180, mealId: 'mock-2' },
  { timestamp: '12:30', calories: 580, mealId: 'mock-3' },
  { timestamp: '14:00', calories: 420, mealId: 'mock-4' },
  { timestamp: '16:30', calories: 250, mealId: 'mock-5' },
  { timestamp: '18:30', calories: 640, mealId: 'mock-6' },
  { timestamp: '20:00', calories: 390, mealId: 'mock-7' },
];

const MOCK_SECONDARY = [22, 35, 48, 55, 62, 74, 80];

// ─── Monotone cubic Hermite interpolation ─────────────────────────────────────

/**
 * Compute monotone cubic tangent slopes for a sequence of (x, y) points.
 * Equivalent to d3.curveMonotoneX — the resulting spline passes through every
 * data point with C1 continuity and monotonicity between adjacent points.
 */
function monotoneTangents(points: { x: number; y: number }[]): number[] {
  const n = points.length;
  if (n < 2) return new Array(n).fill(0);

  const deltas: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    deltas.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }

  // Initial tangent estimates (three-point formula)
  slopes.push(deltas[0]);
  for (let i = 1; i < n - 1; i++) {
    if (deltas[i - 1] * deltas[i] <= 0) {
      slopes.push(0);
    } else {
      slopes.push((deltas[i - 1] + deltas[i]) / 2);
    }
  }
  slopes.push(deltas[n - 2]);

  // Enforce monotonicity (Fritsch–Carlson)
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

/**
 * Build an SVG cubic-bezier path string from a set of points using
 * monotone-cubic Hermite interpolation.
 */
function buildSplinePath(points: { x: number; y: number }[]): string {
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

/**
 * Build a closed area path (for gradient fill beneath the spline).
 * Closes downward to the baseline y.
 */
function buildAreaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length < 2) return '';
  const spline = buildSplinePath(points);
  return `${spline} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
}

// ─── Data → pixel coordinate mapping ──────────────────────────────────────────

function mapDataToPoints(
  data: RouteDataPoint[],
  plotW: number,
  plotH: number,
  orientation: ChartOrientation,
): { x: number; y: number }[] {
  if (data.length === 0) return [];
  const maxCal = Math.max(...data.map((d) => d.calories), 1);

  return data.map((dp, i) => {
    const t = data.length === 1 ? 0.5 : i / (data.length - 1);
    const calNorm = dp.calories / maxCal;

    if (orientation === 'horizontal') {
      return {
        x: PADDING.left + t * plotW,
        y: PADDING.top + (1 - calNorm) * plotH,
      };
    }
    // vertical: x maps to calorie amplitude, y maps to time (top → bottom)
    return {
      x: PADDING.left + calNorm * plotW,
      y: PADDING.top + t * plotH,
    };
  });
}

function mapSecondaryToPoints(
  values: number[],
  primaryData: RouteDataPoint[],
  plotW: number,
  plotH: number,
): { x: number; y: number }[] {
  const maxVal = Math.max(...values, 1);
  return values.map((v, i) => {
    const t = values.length === 1 ? 0.5 : i / (values.length - 1);
    return {
      x: PADDING.left + t * plotW,
      y: PADDING.top + (1 - v / maxVal) * plotH,
    };
  });
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function renderSpline(
  points: { x: number; y: number }[],
  baselineY: number,
  gradientId: string,
  strokeColor: string,
) {
  if (points.length < 2) return null;
  const curvePath = buildSplinePath(points);
  const areaPath = buildAreaPath(points, baselineY);

  return (
    <G>
      <Path d={areaPath} fill={`url(#${gradientId})`} />
      <Path
        d={curvePath}
        stroke={strokeColor}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
}

function renderBarMode(
  data: RouteDataPoint[],
  plotW: number,
  plotH: number,
  calorieGoal: number,
) {
  if (data.length === 0) return null;
  const maxCal = Math.max(...data.map((d) => d.calories), calorieGoal || 1);
  const peakCal = Math.max(...data.map((d) => d.calories));
  const barGap = 6;
  const totalGaps = (data.length - 1) * barGap;
  const barWidth = Math.max(12, Math.min(32, (plotW - totalGaps) / data.length));

  return (
    <G>
      {/* Goal line */}
      {calorieGoal > 0 && (
        <G>
          <Line
            x1={PADDING.left}
            y1={PADDING.top + (1 - calorieGoal / maxCal) * plotH}
            x2={PADDING.left + plotW}
            y2={PADDING.top + (1 - calorieGoal / maxCal) * plotH}
            stroke={Colors.chartGrid}
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
          <Rect
            x={PADDING.left + plotW - 36}
            y={PADDING.top + (1 - calorieGoal / maxCal) * plotH - 12}
            width={32}
            height={18}
            rx={9}
            fill={Colors.routePink}
          />
          <SvgText
            x={PADDING.left + plotW - 20}
            y={PADDING.top + (1 - calorieGoal / maxCal) * plotH + 2}
            fontSize={9}
            fontWeight="700"
            fill="#FFFFFF"
            textAnchor="middle"
          >
            {Math.round(calorieGoal / 10) * 10}
          </SvgText>
        </G>
      )}

      {data.map((dp, i) => {
        const x = PADDING.left + i * (barWidth + barGap) + (plotW - data.length * (barWidth + barGap) + barGap) / 2;
        const barH = Math.max(4, (dp.calories / maxCal) * plotH);
        const y = PADDING.top + plotH - barH;
        const isPeak = dp.calories === peakCal && dp.calories > 0;

        return (
          <G key={dp.mealId}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={barWidth / 2}
              fill={Colors.routePink}
              opacity={isPeak ? 1 : 0.75}
            />
            {isPeak && (
              <SvgText
                x={x + barWidth / 2}
                y={y - 8}
                fontSize={13}
                textAnchor="middle"
              >
                ⭐
              </SvgText>
            )}
          </G>
        );
      })}

      {/* X-axis time labels */}
      {data.map((dp, i) => {
        const x = PADDING.left + i * (barWidth + barGap) + (plotW - data.length * (barWidth + barGap) + barGap) / 2;
        const label = formatTimeLabel(dp.timestamp);
        return (
          <SvgText
            key={`label-${dp.mealId}`}
            x={x + barWidth / 2}
            y={PADDING.top + plotH + 16}
            fontSize={10}
            fill={Colors.muted}
            textAnchor="middle"
            fontWeight="500"
          >
            {label}
          </SvgText>
        );
      })}
    </G>
  );
}

function renderDualLine(
  primaryPoints: { x: number; y: number }[],
  secondaryPoints: { x: number; y: number }[],
  plotW: number,
  plotH: number,
  data: RouteDataPoint[],
) {
  // Gridlines
  const gridCount = 5;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const y = PADDING.top + (i / (gridCount - 1)) * plotH;
    return (
      <Line
        key={`grid-${i}`}
        x1={PADDING.left}
        y1={y}
        x2={PADDING.left + plotW}
        y2={y}
        stroke={Colors.chartGrid}
        strokeWidth={0.8}
      />
    );
  });

  // X-axis labels
  const xLabels = data.map((dp, i) => {
    if (data.length > 8 && i % 2 !== 0) return null;
    const t = data.length === 1 ? 0.5 : i / (data.length - 1);
    const x = PADDING.left + t * plotW;
    return (
      <SvgText
        key={`xlabel-${i}`}
        x={x}
        y={PADDING.top + plotH + 18}
        fontSize={10}
        fill={Colors.muted}
        textAnchor="middle"
        fontWeight="500"
      >
        {formatTimeLabel(dp.timestamp)}
      </SvgText>
    );
  });

  return (
    <G>
      {gridLines}
      {primaryPoints.length >= 2 && (
        <Path
          d={buildSplinePath(primaryPoints)}
          stroke={Colors.routePink}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {secondaryPoints.length >= 2 && (
        <Path
          d={buildSplinePath(secondaryPoints)}
          stroke={Colors.chartBlue}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {/* Data point dots */}
      {primaryPoints.map((p, i) => (
        <Circle key={`pd-${i}`} cx={p.x} cy={p.y} r={3.5} fill={Colors.routePink} />
      ))}
      {secondaryPoints.map((p, i) => (
        <Circle key={`sd-${i}`} cx={p.x} cy={p.y} r={3.5} fill={Colors.chartBlue} />
      ))}
      {xLabels}
    </G>
  );
}

/** Render circular image nodes — used for both orientations in spline mode. */
function renderImageNodes(
  points: { x: number; y: number }[],
  data: RouteDataPoint[],
  isMock: boolean,
  nodeRadius: number,
  onNodePress?: (mealId: string) => void,
) {
  return points.map((p, i) => {
    const dp = data[i];
    if (!dp) return null;

    if (isMock) {
      return (
        <Circle
          key={`node-${i}`}
          cx={p.x}
          cy={p.y}
          r={nodeRadius}
          fill="#D1D5DB"
          opacity={0.6}
        />
      );
    }

    const handlePress = onNodePress ? () => onNodePress(dp.mealId) : undefined;

    if (!dp.thumbnailUrl) {
      // No photo (manual entry, or scan with failed upload) — show a generic
      // fork-and-knife glyph instead of a blank circle.
      return (
        <G key={`node-${i}`} onPress={handlePress}>
          <Circle cx={p.x} cy={p.y} r={nodeRadius + 5} fill={Colors.routePink} opacity={0.10} />
          <Circle cx={p.x} cy={p.y} r={nodeRadius} fill="#FFFFFF" stroke={Colors.routePink} strokeWidth={2.5} />
          <SvgText
            x={p.x}
            y={p.y + nodeRadius * 0.32}
            fontSize={nodeRadius * 0.95}
            textAnchor="middle"
          >
            🍴
          </SvgText>
        </G>
      );
    }

    const clipId = `clip-node-${i}`;
    return (
      <G key={`node-${i}`} onPress={handlePress}>
        <Circle cx={p.x} cy={p.y} r={nodeRadius + 5} fill={Colors.routePink} opacity={0.10} />
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx={p.x} cy={p.y} r={nodeRadius} />
          </ClipPath>
        </Defs>
        <Circle cx={p.x} cy={p.y} r={nodeRadius + 2} fill={Colors.routePink} opacity={0.3} />
        <SvgImage
          href={dp.thumbnailUrl}
          x={p.x - nodeRadius}
          y={p.y - nodeRadius}
          width={nodeRadius * 2}
          height={nodeRadius * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
        <Circle cx={p.x} cy={p.y} r={nodeRadius} stroke={Colors.routePink} strokeWidth={2.5} fill="none" />
      </G>
    );
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeLabel(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp.slice(0, 5);
    const h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}${ampm}`;
  } catch {
    return timestamp.slice(0, 5);
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function NutritionRouteChart({
  data,
  mode = 'spline',
  orientation = 'horizontal',
  calorieGoal = 0,
  secondaryData,
  onNodePress,
  width: propWidth,
  height: propHeight,
}: NutritionRouteChartProps) {
  // Mock data logic: show mock when no real data
  const isMockData = data.length === 0;
  const displayData = isMockData ? MOCK_DATA : data;
  const displaySecondary = isMockData ? MOCK_SECONDARY : (secondaryData ?? []);

  // Dimensions
  const isVertical = orientation === 'vertical';
  const svgWidth = propWidth ?? (isVertical ? DEFAULT_V_WIDTH : DEFAULT_H_WIDTH);
  const svgHeight = propHeight ?? (isVertical ? DEFAULT_V_HEIGHT : DEFAULT_H_HEIGHT);
  const plotW = svgWidth - PADDING.left - PADDING.right;
  const plotH = svgHeight - PADDING.top - PADDING.bottom;

  // Map data → pixel coordinates
  const primaryPoints = useMemo(
    () => mapDataToPoints(displayData, plotW, plotH, orientation),
    [displayData, plotW, plotH, orientation],
  );

  const secondaryPoints = useMemo(
    () => mode === 'dual-line' && displaySecondary.length > 0
      ? mapSecondaryToPoints(displaySecondary, displayData, plotW, plotH)
      : [],
    [mode, displaySecondary, displayData, plotW, plotH],
  );

  const baselineY = PADDING.top + plotH;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.container, { width: svgWidth, height: svgHeight }]}>
      {isMockData && (
        <View style={styles.mockBadge}>
          <Animated.Text entering={FadeIn.delay(300)} style={styles.mockBadgeText}>
            Sample Data
          </Animated.Text>
        </View>
      )}
      <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <Defs>
          {/* Gradient for spline area fill */}
          <LinearGradient id="routePinkGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.routePink} stopOpacity={0.35} />
            <Stop offset="1" stopColor={Colors.routePink} stopOpacity={0.02} />
          </LinearGradient>
          <LinearGradient id="chartBlueGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.chartBlue} stopOpacity={0.25} />
            <Stop offset="1" stopColor={Colors.chartBlue} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Render based on mode */}
        {mode === 'spline' && renderSpline(primaryPoints, baselineY, 'routePinkGradient', Colors.routePink)}

        {mode === 'bar' && renderBarMode(displayData, plotW, plotH, calorieGoal)}

        {mode === 'dual-line' && renderDualLine(primaryPoints, secondaryPoints, plotW, plotH, displayData)}

        {/* Spline mode: circular image nodes on both orientations (smaller on horizontal). */}
        {mode === 'spline' &&
          renderImageNodes(
            primaryPoints,
            displayData,
            isMockData,
            isVertical ? 22 : 16,
            onNodePress,
          )}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
  },
  mockBadge: {
    position: 'absolute',
    top: 4,
    left: 12,
    zIndex: 2,
    backgroundColor: 'rgba(224,57,122,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mockBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.routePink,
    letterSpacing: 0.4,
  },
});

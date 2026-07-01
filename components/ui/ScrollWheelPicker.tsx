/**
 * ScrollWheelPicker — vertical snap-scrolling number picker.
 *
 * The center row is the selected value (bold). Rows above and below fade
 * in opacity. Snap-to-center on scroll-end; haptic on every tick. Tap the
 * center value to switch into a manual numeric TextInput.
 *
 * Perf notes:
 *   - Row is extracted into a React.memo'd component; only rows whose
 *     distance-to-center changed re-render on scroll.
 *   - Uses the app's Nunito heading font (not Fraunces) so RN font atlas
 *     lookups are cheap.
 *   - FlatList has `nestedScrollEnabled` so Android's nested-scroll
 *     coordinator lets this pan even when we're inside a vertical
 *     ScrollView (as we are on every onboarding screen).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ui/ThemedText';
import { Typography } from '@/constants/theme';

export const PICKER_GREEN = '#22C55E';
const TEXT_PRIMARY = '#2F241E';
const TEXT_SECONDARY = '#8a7e74';
const TEXT_TERTIARY = '#c4b9ab';
const DIVIDER = '#e8e2d6';

interface ScrollWheelPickerProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  fontSize?: number;
  itemHeight?: number;
  /** Must be odd. Defaults to 5 (2 above + center + 2 below). */
  visibleItems?: number;
  unit?: string;
}

const PAD_TOP = Number.NEGATIVE_INFINITY;
const PAD_BOT = Number.POSITIVE_INFINITY;

export function ScrollWheelPicker({
  min,
  max,
  step = 1,
  value,
  onChange,
  fontSize = 36,
  itemHeight = 56,
  visibleItems = 5,
  unit,
}: ScrollWheelPickerProps) {
  const listRef = useRef<FlatList<number>>(null);
  const lastReportedIndex = useRef<number>(-1);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [centerIndex, setCenterIndex] = useState<number>(0);

  const values = useMemo(() => {
    const out: number[] = [];
    const count = Math.round((max - min) / step) + 1;
    for (let i = 0; i < count; i++) {
      out.push(+(min + i * step).toFixed(6));
    }
    return out;
  }, [min, max, step]);

  const padCount = Math.floor(visibleItems / 2);
  const pickerHeight = itemHeight * visibleItems;

  const indexFromValue = useCallback(
    (v: number) => {
      const clamped = Math.max(min, Math.min(max, v));
      return Math.round((clamped - min) / step);
    },
    [min, max, step],
  );

  // Keep the list aligned when the external value changes (e.g. user types).
  useEffect(() => {
    const idx = indexFromValue(value);
    if (idx === lastReportedIndex.current) return;
    lastReportedIndex.current = idx;
    setCenterIndex(idx);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: idx * itemHeight, animated: false });
    });
  }, [value, indexFromValue, itemHeight]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offset / itemHeight);
      if (idx === lastReportedIndex.current) return;
      const clampedIdx = Math.max(0, Math.min(values.length - 1, idx));
      lastReportedIndex.current = clampedIdx;
      setCenterIndex(clampedIdx);
      Haptics.selectionAsync();
      onChange(values[clampedIdx]);
    },
    [itemHeight, onChange, values],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offset / itemHeight);
      const clampedIdx = Math.max(0, Math.min(values.length - 1, idx));
      if (clampedIdx !== lastReportedIndex.current) {
        lastReportedIndex.current = clampedIdx;
        setCenterIndex(clampedIdx);
        Haptics.selectionAsync();
        onChange(values[clampedIdx]);
      }
    },
    [itemHeight, onChange, values],
  );

  const dataWithPadding = useMemo<number[]>(() => {
    const padTop = Array.from({ length: padCount }, () => PAD_TOP);
    const padBot = Array.from({ length: padCount }, () => PAD_BOT);
    return [...padTop, ...values, ...padBot];
  }, [padCount, values]);

  const renderItem = useCallback(
    ({ item, index }: { item: number; index: number }) => (
      <Row
        item={item}
        realIdx={index - padCount}
        targetIdx={centerIndex}
        itemHeight={itemHeight}
        fontSize={fontSize}
        step={step}
      />
    ),
    [padCount, centerIndex, itemHeight, fontSize, step],
  );

  const handleCenterPress = () => {
    Haptics.selectionAsync();
    setEditValue(formatValue(value, step));
    setEditing(true);
  };

  const commitTyped = () => {
    const num = Number(editValue.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(num)) {
      const clamped = Math.max(min, Math.min(max, num));
      const idx = Math.round((clamped - min) / step);
      const snapped = +(min + idx * step).toFixed(6);
      onChange(snapped);
    }
    setEditing(false);
  };

  return (
    <View style={[styles.container, { height: pickerHeight }]}>
      <View pointerEvents="none" style={[styles.dividerTop, { top: padCount * itemHeight }]} />
      <View
        pointerEvents="none"
        style={[styles.dividerBottom, { top: (padCount + 1) * itemHeight - 0.5 }]}
      />
      <View pointerEvents="none" style={[styles.triangleLeft, { top: padCount * itemHeight + itemHeight / 2 - 6 }]} />
      <View pointerEvents="none" style={[styles.triangleRight, { top: padCount * itemHeight + itemHeight / 2 - 6 }]} />

      {!editing && (
        <FlatList
          ref={listRef}
          data={dataWithPadding}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          nestedScrollEnabled
          initialNumToRender={visibleItems + 2}
          windowSize={5}
          maxToRenderPerBatch={visibleItems + 2}
          removeClippedSubviews
          getItemLayout={(_, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onMomentumScrollEnd={onMomentumScrollEnd}
          initialScrollIndex={indexFromValue(value)}
          contentContainerStyle={styles.listContent}
        />
      )}

      {editing && (
        <View style={[styles.editOverlay, { height: pickerHeight }]}>
          <TextInput
            style={{
              fontSize,
              fontFamily: Typography.fonts.headingBold,
              color: TEXT_PRIMARY,
              minWidth: 120,
              textAlign: 'center',
            }}
            value={editValue}
            onChangeText={setEditValue}
            keyboardType="numeric"
            autoFocus
            onSubmitEditing={commitTyped}
            onBlur={commitTyped}
            returnKeyType="done"
            selectTextOnFocus
          />
        </View>
      )}

      {!editing && (
        <Pressable
          style={[
            styles.centerTap,
            { top: padCount * itemHeight, height: itemHeight },
          ]}
          onPress={handleCenterPress}
        />
      )}

      {unit && (
        <View pointerEvents="none" style={[styles.unitLabel, { top: padCount * itemHeight + itemHeight / 2 - 10 }]}>
          <ThemedText style={{ fontSize: 13, color: TEXT_SECONDARY }}>{unit}</ThemedText>
        </View>
      )}
    </View>
  );
}

/* ─── Row (memo'd so only rows crossing the center re-render) ── */

interface RowProps {
  item: number;
  realIdx: number;
  targetIdx: number;
  itemHeight: number;
  fontSize: number;
  step: number;
}

const Row = React.memo(
  function Row({ item, realIdx, targetIdx, itemHeight, fontSize, step }: RowProps) {
    const isPad = item === PAD_TOP || item === PAD_BOT;
    if (isPad) {
      return <View style={{ height: itemHeight }} />;
    }

    const d = Math.abs(realIdx - targetIdx);
    let opacity = 0.1;
    let size = Math.round(fontSize * 0.5);
    let color = TEXT_TERTIARY;
    if (d === 0) {
      opacity = 1;
      size = fontSize;
      color = TEXT_PRIMARY;
    } else if (d === 1) {
      opacity = 0.55;
      size = Math.round(fontSize * 0.62);
      color = TEXT_SECONDARY;
    } else if (d === 2) {
      opacity = 0.28;
      size = Math.round(fontSize * 0.55);
      color = TEXT_SECONDARY;
    }

    return (
      <View style={[styles.row, { height: itemHeight }]}>
        <ThemedText
          style={{
            fontSize: size,
            fontFamily: Typography.fonts.headingBold,
            color,
            opacity,
            textAlign: 'center',
          }}
        >
          {formatValue(item, step)}
        </ThemedText>
      </View>
    );
  },
  (prev, next) =>
    prev.item === next.item &&
    prev.realIdx === next.realIdx &&
    prev.targetIdx === next.targetIdx &&
    prev.itemHeight === next.itemHeight &&
    prev.fontSize === next.fontSize &&
    prev.step === next.step,
);

function keyExtractor(_: number, i: number): string {
  return String(i);
}

function formatValue(v: number, step: number): string {
  if (step < 1) {
    const decimals = String(step).split('.')[1]?.length ?? 1;
    return v.toFixed(decimals);
  }
  return String(Math.round(v));
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  listContent: { paddingHorizontal: 24 },
  row: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerTop: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: 0.5,
    backgroundColor: DIVIDER,
  },
  dividerBottom: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: 0.5,
    backgroundColor: DIVIDER,
  },
  triangleLeft: {
    position: 'absolute',
    left: 8,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: PICKER_GREEN,
  },
  triangleRight: {
    position: 'absolute',
    right: 8,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: PICKER_GREEN,
  },
  centerTap: {
    position: 'absolute',
    left: 60,
    right: 60,
  },
  editOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitLabel: {
    position: 'absolute',
    right: 36,
  },
});

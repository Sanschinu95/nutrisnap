/**
 * ScrollWheelPicker — vertical snap-scrolling number picker.
 *
 * The center row is the selected value (large, bold). Rows above and below
 * fade in opacity. Snap-to-center on scroll-end; haptic on every tick. Tap
 * the center value to switch into a manual numeric TextInput.
 *
 * Used on the onboarding Age / Height / Weight / Goal-weight screens.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export function ScrollWheelPicker({
  min,
  max,
  step = 1,
  value,
  onChange,
  fontSize = 48,
  itemHeight = 80,
  visibleItems = 5,
  unit,
}: ScrollWheelPickerProps) {
  const listRef = useRef<FlatList<number>>(null);
  const lastReportedIndex = useRef<number>(-1);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');

  const values = useMemo(() => {
    const out: number[] = [];
    // Float-tolerant generator: avoid `value < max` drift via index math.
    const count = Math.round((max - min) / step) + 1;
    for (let i = 0; i < count; i++) {
      const v = +(min + i * step).toFixed(6);
      out.push(v);
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
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: idx * itemHeight, animated: false });
    });
  }, [value, indexFromValue, itemHeight]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offset / itemHeight);
      const clampedIdx = Math.max(0, Math.min(values.length - 1, idx));
      const v = values[clampedIdx];
      if (clampedIdx !== lastReportedIndex.current) {
        lastReportedIndex.current = clampedIdx;
        Haptics.selectionAsync();
        onChange(v);
      }
    },
    [itemHeight, onChange, values],
  );

  // Fire a haptic tick while scrolling whenever the center row crosses a new value.
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offset / itemHeight);
      if (idx === lastReportedIndex.current) return;
      const clampedIdx = Math.max(0, Math.min(values.length - 1, idx));
      lastReportedIndex.current = clampedIdx;
      Haptics.selectionAsync();
      onChange(values[clampedIdx]);
    },
    [itemHeight, onChange, values],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: number; index: number }) => {
      const distance = Math.abs(index - (indexFromValue(value) + 0));
      // index includes pad rows; back out the real-data index for distance calc
      const realIdx = index - padCount;
      const targetIdx = indexFromValue(value);
      const d = Math.abs(realIdx - targetIdx);

      let opacity = 1;
      let size = fontSize;
      let weight: '500' | '400' = '500';
      let color = TEXT_PRIMARY;
      if (d === 0) {
        opacity = 1;
        weight = '500';
      } else if (d === 1) {
        opacity = 0.6;
        size = Math.round(fontSize * 0.58);
        weight = '400';
        color = TEXT_SECONDARY;
      } else if (d === 2) {
        opacity = 0.3;
        size = Math.round(fontSize * 0.46);
        weight = '400';
        color = TEXT_SECONDARY;
      } else {
        opacity = 0.1;
        size = Math.round(fontSize * 0.46);
        weight = '400';
        color = TEXT_TERTIARY;
      }

      // Pad rows render empty placeholders sized to itemHeight.
      const isPad = item === Number.NEGATIVE_INFINITY || item === Number.POSITIVE_INFINITY;
      // We use sentinel values for padding (see data below).
      void distance; // silence unused

      return (
        <View style={[styles.row, { height: itemHeight }]}>
          {!isPad && (
            <ThemedText
              style={{
                fontSize: size,
                fontFamily: Typography.fonts.serif,
                color,
                opacity,
                fontWeight: weight,
                textAlign: 'center',
              }}
            >
              {formatValue(item, step)}
            </ThemedText>
          )}
        </View>
      );
    },
    [fontSize, indexFromValue, itemHeight, padCount, step, value],
  );

  const dataWithPadding = useMemo<number[]>(() => {
    const padTop = Array.from({ length: padCount }, () => Number.NEGATIVE_INFINITY);
    const padBot = Array.from({ length: padCount }, () => Number.POSITIVE_INFINITY);
    return [...padTop, ...values, ...padBot];
  }, [padCount, values]);

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
          keyExtractor={(_, idx) => String(idx)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          initialScrollIndex={indexFromValue(value)}
          contentContainerStyle={{ paddingHorizontal: 24 }}
        />
      )}

      {editing && (
        <View style={[styles.editOverlay, { height: pickerHeight }]}>
          <TextInput
            style={{
              fontSize,
              fontFamily: Typography.fonts.serif,
              color: TEXT_PRIMARY,
              fontWeight: '500',
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

      {/* Tap-to-type hit area sits over the center row when not editing. */}
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
          <ThemedText style={{ fontSize: 14, color: TEXT_SECONDARY }}>{unit}</ThemedText>
        </View>
      )}
    </View>
  );
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

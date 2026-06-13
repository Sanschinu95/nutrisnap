/**
 * Camera tab - Food scanning screen
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useGemini } from '@/hooks/useGemini';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useDailyStore } from '@/stores/daily.store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RING_SIZE = 240;

export default function CameraScreen() {
  const { theme, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [isSingleMode, setIsSingleMode] = useState(true);
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  const { isAnalyzing, result, error, analyze, reset } = useGemini();
  const { loadToday } = useDailyStore();

  // Animation values
  const rotation = useSharedValue(0);
  const ringColor = useSharedValue<string>(Colors.orange);
  const detectedBadgeY = useSharedValue(-100);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // Continuous rotation animation
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  // Ring color change on detection
  useEffect(() => {
    if (result) {
      ringColor.value = withTiming(Colors.olive, { duration: 300 });
      detectedBadgeY.value = withSpring(Spacing['3xl']);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      bottomSheetRef.current?.snapToIndex(0);
    } else if (error) {
      ringColor.value = withTiming(Colors.yellow, { duration: 300 });
    } else {
      ringColor.value = withTiming(Colors.orange, { duration: 300 });
      detectedBadgeY.value = withSpring(-100);
    }
  }, [result, error, ringColor, detectedBadgeY]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: detectedBadgeY.value }],
  }));

  const handleCapture = async () => {
    if (!cameraRef.current || isAnalyzing) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo?.base64) {
        const ext = photo.uri?.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        await analyze({ base64: photo.base64, mimeType }, photo.uri!);
      }
    } catch (e) {
      console.error('Capture error:', e);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const handleGalleryPick = async () => {
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });

      if (!pickerResult.canceled && pickerResult.assets[0]?.base64) {
        const uri = pickerResult.assets[0].uri;
        const ext = uri?.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        await analyze({ base64: pickerResult.assets[0].base64, mimeType }, uri);
      }
    } catch (e) {
      console.error('Gallery pick error:', e);
    }
  };

  const handleConfirm = () => {
    if (result) {
      router.push({
        pathname: '/confirm',
        params: { data: JSON.stringify(result) },
      });
    }
  };

  // Permission not granted yet
  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ThemedText>Loading camera...</ThemedText>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="camera-outline" size={64} color={theme.textMuted} />
        <ThemedText variant="h3" align="center" style={styles.permissionTitle}>
          Camera Access Needed
        </ThemedText>
        <ThemedText
          variant="body"
          color={theme.textMuted}
          align="center"
          style={styles.permissionText}
        >
          NutriSnap needs camera access to scan and analyze your food
        </ThemedText>
        <Button
          title="Enable Camera"
          onPress={requestPermission}
          variant="primary"
          style={styles.permissionButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        zoom={zoom}
      >
        {/* Scanning overlay */}
        <View style={styles.overlay}>
          {/* Detection badge */}
          <Animated.View style={[styles.detectedBadge, badgeStyle]}>
            <View style={[styles.badgeContent, { backgroundColor: Colors.olive }]}>
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <ThemedText variant="bodyMedium" color="white" style={styles.badgeText}>
                Food Detected
              </ThemedText>
            </View>
          </Animated.View>

          {/* Top controls */}
          <View style={styles.topControls}>
            <Pressable
              style={[styles.iconButton, { backgroundColor: theme.card + 'CC' }]}
              onPress={() => Alert.alert('Tips', 'Point your camera at food in good lighting for best results.')}
            >
              <Ionicons name="information-circle-outline" size={24} color={theme.text} />
            </Pressable>

            <View style={[styles.modeToggle, { backgroundColor: theme.card + 'CC' }]}>
              <Pressable
                style={[
                  styles.modeButton,
                  isSingleMode && { backgroundColor: theme.primary },
                ]}
                onPress={() => setIsSingleMode(true)}
              >
                <ThemedText
                  variant="label"
                  color={isSingleMode ? 'white' : theme.text}
                >
                  Single
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  !isSingleMode && { backgroundColor: theme.primary },
                ]}
                onPress={() => setIsSingleMode(false)}
              >
                <ThemedText
                  variant="label"
                  color={!isSingleMode ? 'white' : theme.text}
                >
                  Multi
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Scanning ring */}
          <View style={styles.ringContainer}>
            <Animated.View style={rotationStyle}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={(RING_SIZE - 6) / 2}
                  stroke={isAnalyzing ? Colors.yellow : result ? Colors.olive : Colors.orange}
                  strokeWidth={3}
                  fill="none"
                  strokeDasharray="20 10"
                />
              </Svg>
            </Animated.View>
            {isAnalyzing && (
              <View style={styles.analyzingOverlay}>
                <ThemedText variant="bodyMedium" color="white">
                  Analyzing...
                </ThemedText>
              </View>
            )}
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            {/* Gallery picker */}
            <Pressable
              style={[styles.iconButton, { backgroundColor: theme.card + 'CC' }]}
              onPress={handleGalleryPick}
            >
              <Ionicons name="images-outline" size={24} color={theme.text} />
            </Pressable>

            {/* Capture button */}
            <Pressable
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={isAnalyzing}
            >
              <View style={styles.captureInner}>
                {isAnalyzing && (
                  <View style={styles.captureLoading} />
                )}
              </View>
            </Pressable>

            {/* Zoom control */}
            <View style={[styles.zoomContainer, { backgroundColor: theme.card + 'CC' }]}>
              <ThemedText variant="label" color={theme.text}>
                {(1 + zoom * 2).toFixed(1)}x
              </ThemedText>
            </View>
          </View>

          {/* Error message */}
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: Colors.yellowLight }]}>
              <ThemedText variant="bodyMedium" color={Colors.brown}>
                {error.error === 'no_food_detected'
                  ? 'No food detected. Point at food in good lighting.'
                  : 'Analysis failed. Please try again.'}
              </ThemedText>
              <Button
                title="Retry"
                onPress={reset}
                variant="ghost"
                size="small"
                style={styles.retryButton}
              />
            </View>
          )}
        </View>
      </CameraView>

      {/* Bottom sheet for results */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['65%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: theme.card }}
        handleIndicatorStyle={{ backgroundColor: theme.border }}
        onClose={reset}
      >
        <BottomSheetView style={styles.sheetContent}>
          {result && (
            <>
              <ThemedText variant="h2" style={styles.mealName}>
                {result.meal_name}
              </ThemedText>
              <View style={styles.calorieRow}>
                <ThemedText variant="h1" color={theme.primary}>
                  {result.total_calories}
                </ThemedText>
                <ThemedText variant="body" color={theme.textMuted}>
                  {' '}calories
                </ThemedText>
              </View>
              <View style={styles.macroRow}>
                <View style={styles.macroItem}>
                  <ThemedText variant="bodyMedium" color={Colors.brownMid}>
                    {Math.round(result.total_protein_g)}g
                  </ThemedText>
                  <ThemedText variant="label" color={theme.textMuted}>
                    Protein
                  </ThemedText>
                </View>
                <View style={styles.macroItem}>
                  <ThemedText variant="bodyMedium" color={Colors.yellow}>
                    {Math.round(result.total_carbs_g)}g
                  </ThemedText>
                  <ThemedText variant="label" color={theme.textMuted}>
                    Carbs
                  </ThemedText>
                </View>
                <View style={styles.macroItem}>
                  <ThemedText variant="bodyMedium" color={Colors.oliveMid}>
                    {Math.round(result.total_fat_g)}g
                  </ThemedText>
                  <ThemedText variant="label" color={theme.textMuted}>
                    Fat
                  </ThemedText>
                </View>
              </View>
              <Button
                title="Confirm →"
                onPress={handleConfirm}
                variant="primary"
                size="large"
                fullWidth
                style={styles.confirmButton}
              />
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  permissionTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  permissionText: {
    marginBottom: Spacing.xl,
    maxWidth: 280,
  },
  permissionButton: {
    minWidth: 200,
  },
  detectedBadge: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 10,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  badgeText: {
    marginLeft: Spacing.xs,
  },
  topControls: {
    position: 'absolute',
    top: Spacing['4xl'],
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  modeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.sm,
  },
  bottomControls: {
    position: 'absolute',
    bottom: Spacing['4xl'],
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'white',
  },
  captureLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.orange,
    borderRadius: 28,
    opacity: 0.5,
  },
  zoomContainer: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 44,
    alignItems: 'center',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 160,
    left: Spacing.base,
    right: Spacing.base,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  retryButton: {
    marginLeft: Spacing.sm,
  },
  sheetContent: {
    padding: Spacing.xl,
  },
  mealName: {
    marginBottom: Spacing.base,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.xl,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing['2xl'],
  },
  macroItem: {
    alignItems: 'center',
  },
  confirmButton: {
    marginTop: Spacing.base,
  },
});

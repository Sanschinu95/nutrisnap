import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Button } from '@/components/ui/Button';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useGroq } from '@/hooks/useGroq';
import { useDailyStore } from '@/stores/daily.store';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { trackEvent } from '@/lib/telemetry';
import { useChartSound } from '@/hooks/useChartSound';

export default function CameraScreen() {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { isAnalyzing, result, error, analyze, reset } = useGroq();
  const { loadToday } = useDailyStore();
  const { playTap } = useChartSound();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualTime, setManualTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const successY = useSharedValue(0);
  const successOpacity = useSharedValue(0);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    if (result) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      successOpacity.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 900 }));
      successY.value = withSequence(withSpring(-90), withTiming(-180, { duration: 600 }));
    }
  }, [result, successOpacity, successY]);

  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ translateY: successY.value }],
  }));

  const runAnalyze = async (base64: string, uri: string) => {
    const ext = uri?.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    await analyze({ base64, mimeType }, uri);
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isAnalyzing) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      playTap();
      await trackEvent('scan_started', { source: 'camera' });
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.82, base64: true });
      if (photo?.base64 && photo.uri) await runAnalyze(photo.base64, photo.uri);
    } catch (e) {
      console.error('Capture error:', e);
      Alert.alert('Scan failed', 'Please try again in better light.');
    }
  };

  const handleGalleryPick = async () => {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.82,
      base64: true,
    });
    if (!pickerResult.canceled && pickerResult.assets[0]?.base64) {
      await trackEvent('scan_started', { source: 'gallery' });
      await runAnalyze(pickerResult.assets[0].base64, pickerResult.assets[0].uri);
    }
  };

  const handleConfirm = (feedback?: 'incorrect') => {
    if (!result) return;
    router.push({
      pathname: '/confirm',
      params: { data: JSON.stringify(result), ...(feedback ? { feedback } : {}) },
    });
  };

  const handleManualSubmit = () => {
    const calories = parseInt(manualCalories, 10) || 0;
    const protein = parseFloat(manualProtein) || 0;
    const carbs = parseFloat(manualCarbs) || 0;
    const fat = parseFloat(manualFat) || 0;
    if (!manualName.trim() || calories <= 0) {
      Alert.alert('Missing info', 'Food name and calories are required.');
      return;
    }
    // Parse HH:MM into a logged_at on today; fallback to now on malformed input.
    const now = new Date();
    const match = manualTime.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
      const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
      now.setHours(h, m, 0, 0);
    }
    const manualEntry = {
      meal_name: manualName.trim(),
      food_items: [{
        name: manualName.trim(),
        quantity: '1 serving',
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        fiber_g: 0,
        confidence: 'medium' as const,
      }],
      total_calories: calories,
      total_protein_g: protein,
      total_carbs_g: carbs,
      total_fat_g: fat,
      source: 'manual' as const,
      logged_at: now.toISOString(),
    };
    setManualOpen(false);
    setManualName('');
    setManualCalories('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    router.push({ pathname: '/confirm', params: { data: JSON.stringify(manualEntry) } });
  };

  if (!permission) {
    return <View style={[styles.permissionContainer, { backgroundColor: theme.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="camera-outline" size={58} color={Colors.olive} />
        <ThemedText variant="h2" align="center" style={styles.permissionTitle}>
          Camera Access
        </ThemedText>
        <ThemedText variant="body" color={theme.textMuted} align="center" style={styles.permissionText}>
          Scan meals instantly by allowing NutriSnap to use the camera.
        </ThemedText>
        <Button title="Enable Camera" onPress={requestPermission} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <Pressable style={styles.glassButton} onPress={() => router.push('/(tabs)/home')}>
              <Ionicons name="chevron-back" size={22} color={Colors.brown} />
            </Pressable>
            <View style={styles.scanHint}>
              <ThemedText variant="label" color={Colors.brown}>SCAN FOOD</ThemedText>
            </View>
          </View>

          <View style={[styles.focusFrame, isAnalyzing && styles.focusFrameActive]}>
            {isAnalyzing && <ThemedText variant="bodySemiBold" color="white">Analyzing...</ThemedText>}
          </View>

          <Animated.View style={[styles.successFly, successStyle]}>
            <Ionicons name="fast-food" size={30} color={Colors.orange} />
          </Animated.View>

          {error && (
            <Animated.View entering={FadeInDown.springify()} style={styles.errorBanner}>
              <ThemedText variant="bodyMedium" color={Colors.brown}>
                {error.error === 'no_food_detected' ? 'No food detected. Try a clearer angle.' : 'Scan failed. Try again.'}
              </ThemedText>
              <Pressable onPress={reset}>
                <Ionicons name="close" size={20} color={Colors.brown} />
              </Pressable>
            </Animated.View>
          )}

          <View style={styles.bottomControls}>
            <ControlButton icon="images-outline" label="Gallery" onPress={handleGalleryPick} />
            <Pressable style={styles.captureButton} onPress={handleCapture} disabled={isAnalyzing}>
              <View style={[styles.captureCore, isAnalyzing && { backgroundColor: Colors.orangeLight }]} />
            </Pressable>
            <ControlButton icon="create-outline" label="Manual" onPress={() => setManualOpen(true)} />
          </View>
        </View>
      </CameraView>

      {result && (
      <BottomSheet
        index={0}
        snapPoints={['64%']}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: Colors.white }}
        handleIndicatorStyle={{ backgroundColor: Colors.border }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {result && (
            <>
              <View style={styles.resultImage}>
                {result.image_url ? (
                  <Image source={{ uri: result.image_url }} style={styles.resultPhoto} />
                ) : (
                  <Ionicons name="restaurant-outline" size={56} color={Colors.olive} />
                )}
              </View>
              <ThemedText variant="h2" align="center">{result.meal_name}</ThemedText>
              <View style={styles.resultCalories}>
                <ThemedText variant="h1" color={Colors.olive}>{result.total_calories}</ThemedText>
                <ThemedText variant="body" color={theme.textMuted}>calories</ThemedText>
              </View>
              <View style={styles.macroRow}>
                <MacroStat label="Protein" value={Math.round(result.total_protein_g)} color={Colors.olive} />
                <MacroStat label="Carbs" value={Math.round(result.total_carbs_g)} color={Colors.orange} />
                <MacroStat label="Fat" value={Math.round(result.total_fat_g)} color={Colors.brownMid} />
              </View>
              <View style={styles.feedbackRow}>
                <Pressable style={styles.feedbackButton} onPress={() => handleConfirm()}>
                  <Ionicons name="thumbs-up-outline" size={18} color={Colors.olive} />
                  <ThemedText variant="button" color={Colors.olive}>Correct</ThemedText>
                </Pressable>
                <Pressable style={styles.feedbackButton} onPress={() => handleConfirm('incorrect')}>
                  <Ionicons name="thumbs-down-outline" size={18} color={Colors.orange} />
                  <ThemedText variant="button" color={Colors.orange}>Incorrect</ThemedText>
                </Pressable>
              </View>
              <Button title="Confirm" onPress={() => handleConfirm()} size="large" fullWidth />
              <Button title="Edit" onPress={() => handleConfirm('incorrect')} variant="ghost" size="medium" fullWidth />
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
      )}

      {manualOpen && (
        <View style={styles.manualOverlay}>
          <View style={styles.manualCard}>
            <ThemedText variant="h3">Manual Entry</ThemedText>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Food name"
              placeholderTextColor={Colors.muted}
              style={styles.manualInput}
            />
            <TextInput
              value={manualCalories}
              onChangeText={setManualCalories}
              placeholder="Calories"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              style={styles.manualInput}
            />
            <View style={styles.manualMacroRow}>
              <TextInput
                value={manualProtein}
                onChangeText={setManualProtein}
                placeholder="Protein g"
                placeholderTextColor={Colors.muted}
                keyboardType="decimal-pad"
                style={[styles.manualInput, styles.manualMacroInput]}
              />
              <TextInput
                value={manualCarbs}
                onChangeText={setManualCarbs}
                placeholder="Carbs g"
                placeholderTextColor={Colors.muted}
                keyboardType="decimal-pad"
                style={[styles.manualInput, styles.manualMacroInput]}
              />
              <TextInput
                value={manualFat}
                onChangeText={setManualFat}
                placeholder="Fat g"
                placeholderTextColor={Colors.muted}
                keyboardType="decimal-pad"
                style={[styles.manualInput, styles.manualMacroInput]}
              />
            </View>
            <View style={styles.manualTimeRow}>
              <ThemedText variant="label" color={Colors.muted}>Time (HH:MM)</ThemedText>
              <TextInput
                value={manualTime}
                onChangeText={setManualTime}
                placeholder="14:30"
                placeholderTextColor={Colors.muted}
                style={[styles.manualInput, styles.manualTimeInput]}
              />
            </View>
            <View style={styles.manualActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setManualOpen(false)} style={styles.manualAction} />
              <Button title="Review" onPress={handleManualSubmit} style={styles.manualAction} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function ControlButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.controlButton} onPress={onPress}>
      <Ionicons name={icon} size={24} color={Colors.brown} />
      <ThemedText variant="label" color={Colors.brown}>{label}</ThemedText>
    </Pressable>
  );
}

function MacroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.macroStat}>
      <ThemedText variant="h3" color={color}>{value}g</ThemedText>
      <ThemedText variant="label" color={Colors.muted}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 54,
    left: Spacing.xl,
    right: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  glassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanHint: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  focusFrame: {
    width: 246,
    height: 246,
    borderRadius: 123,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusFrameActive: {
    borderColor: Colors.orange,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  successFly: {
    position: 'absolute',
    bottom: 136,
    alignSelf: 'center',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 142,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.yellowLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  bottomControls: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    width: 76,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  captureButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 3,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureCore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.white,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  permissionTitle: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  permissionText: { maxWidth: 270, marginBottom: Spacing.xl },
  sheetContent: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.base,
  },
  resultImage: {
    width: 124,
    height: 124,
    borderRadius: 62,
    overflow: 'hidden',
    backgroundColor: Colors.oliveLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultPhoto: {
    width: '100%',
    height: '100%',
  },
  resultCalories: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  macroRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
  },
  macroStat: { alignItems: 'center' },
  feedbackRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  feedbackButton: {
    flex: 1,
    height: 46,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  manualOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(47,36,30,0.28)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  manualCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  manualInput: {
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    color: Colors.brown,
    fontSize: 16,
  },
  manualActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  manualAction: {
    flex: 1,
  },
  manualMacroRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  manualMacroInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: Spacing.sm,
  },
  manualTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  manualTimeInput: {
    flex: 1,
  },
});

/**
 * useWaterSound — short water-pour audio feedback when hydration is logged.
 *
 * Uses expo-audio configured to respect the device silent/mute switch.
 * Fire-and-forget: a failed load/play can never block the UI or the
 * fill animation.
 */

import { useCallback, useEffect } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

const WATER_ASSET = require('@/assets/sounds/water-pour.wav');

export function useWaterSound() {
  const player = useAudioPlayer(WATER_ASSET);

  useEffect(() => {
    // Respect device silent switch
    setAudioModeAsync({ playsInSilentMode: false }).catch(() => {
      // Non-critical — fail silently
    });

    if (player) {
      player.volume = 0.5;
    }
  }, [player]);

  const playWaterSound = useCallback(async () => {
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Non-critical — swallow playback errors
    }
  }, [player]);

  return { playWaterSound };
}

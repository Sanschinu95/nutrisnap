/**
 * useChartSound — soft tap/click audio feedback for chart interactions.
 *
 * Uses expo-audio configured to respect the device silent/mute switch.
 * The sound is loaded once via useAudioPlayer and cached for the
 * component lifetime. Playback is fire-and-forget — a failed sound
 * load/play can never block the calling action.
 */

import { useCallback, useEffect } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

const TAP_ASSET = require('@/assets/sounds/tap.wav');

export function useChartSound() {
  const player = useAudioPlayer(TAP_ASSET);

  useEffect(() => {
    // Configure audio session to respect device silent switch
    setAudioModeAsync({ playsInSilentMode: false }).catch(() => {
      // Non-critical — fail silently
    });

    if (player) {
      player.volume = 0.4;
    }
  }, [player]);

  const playTap = useCallback(async () => {
    if (!player) return;
    try {
      // Seek to start before playing (allows rapid re-taps)
      player.seekTo(0);
      player.play();
    } catch {
      // Non-critical — swallow playback errors
    }
  }, [player]);

  return { playTap };
}

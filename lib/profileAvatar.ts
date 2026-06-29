/**
 * Local-only profile avatar storage.
 *
 * The image never leaves the device — we store a resized 200×200 base64 data
 * URI in AsyncStorage keyed per user. No Cloudinary, no Supabase column.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'profile_avatar';

// Lazy require so the app boots even when running against a dev build that
// predates the expo-image-manipulator native module. Avatar save no-ops in
// that case (caller catches the throw and shows the existing initials).
function loadImageManipulator(): typeof import('expo-image-manipulator') | null {
  try {
    return require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  } catch {
    return null;
  }
}

function keyFor(userId: string): string {
  return `${STORAGE_PREFIX}_${userId}`;
}

export async function loadAvatar(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    return await AsyncStorage.getItem(keyFor(userId));
  } catch {
    return null;
  }
}

export async function saveAvatarFromUri(userId: string, sourceUri: string): Promise<string> {
  const ImageManipulator = loadImageManipulator();
  if (!ImageManipulator) {
    throw new Error('AVATAR_REBUILD_REQUIRED');
  }
  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 200, height: 200 } }],
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  if (!result.base64) throw new Error('No base64 returned from image manipulator');
  const dataUri = `data:image/jpeg;base64,${result.base64}`;
  await AsyncStorage.setItem(keyFor(userId), dataUri);
  return dataUri;
}

export async function clearAvatar(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}

/**
 * Cloudinary image upload utilities for NutriSnap
 * Handles food scan images and profile pictures with retry logic
 */

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function isConfigured(): boolean {
  return !!(CLOUDINARY_CLOUD_NAME && UPLOAD_PRESET);
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadWithRetry(
  formData: FormData,
  attempt = 0,
): Promise<string | null> {
  if (!isConfigured()) {
    console.warn('Cloudinary not configured — skipping upload');
    return null;
  }

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Cloudinary HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();

    if (!data.secure_url) {
      throw new Error('Cloudinary response missing secure_url');
    }

    return data.secure_url as string;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      console.warn(
        `Cloudinary upload attempt ${attempt + 1} failed, retrying...`,
        error,
      );
      await delay(RETRY_DELAY_MS * (attempt + 1));
      return uploadWithRetry(formData, attempt + 1);
    }
    console.error('Cloudinary upload failed after retries:', error);
    return null;
  }
}

/**
 * Upload a food scan image to Cloudinary.
 * Returns the secure URL or null if upload fails / not configured.
 */
export async function uploadFoodImage(
  imageUri: string,
  userId: string,
): Promise<string | null> {
  if (!isConfigured()) return null;

  const timestamp = Date.now();
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: `food_${userId}_${timestamp}.jpg`,
  } as any);
  formData.append('upload_preset', UPLOAD_PRESET!);
  formData.append('folder', `nutrisnap/food-scans/${userId}`);
  formData.append('transformation', 'q_auto,f_auto,w_800');

  return uploadWithRetry(formData);
}

/**
 * Upload a profile picture to Cloudinary.
 * Returns the secure URL or null if upload fails / not configured.
 */
export async function uploadProfileImage(
  imageUri: string,
  userId: string,
): Promise<string | null> {
  if (!isConfigured()) return null;

  const timestamp = Date.now();
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: `profile_${userId}_${timestamp}.jpg`,
  } as any);
  formData.append('upload_preset', UPLOAD_PRESET!);
  formData.append('folder', `nutrisnap/profiles/${userId}`);
  formData.append('transformation', 'q_auto,f_auto,w_400,h_400,c_fill,g_face');

  return uploadWithRetry(formData);
}

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!

export async function uploadFoodImage(
  imageUri: string,
  userId: string
): Promise<string> {
  const formData = new FormData()
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: `food_${userId}_${Date.now()}.jpg`
  } as any)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', `nutrisnap/food-scans/${userId}`)
  formData.append('transformation', 'q_auto,f_auto,w_800')

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )
  const data = await res.json()
  return data.secure_url
}

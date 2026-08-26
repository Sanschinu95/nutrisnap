const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * expo-image-picker / expo-media-library declare READ_EXTERNAL_STORAGE and
 * WRITE_EXTERNAL_STORAGE with no version ceiling. Unscoped, these trigger
 * Google Play's "all files / broad storage" reviews on modern Android even
 * though the app only ever reads/writes images via the scoped MediaStore.
 *
 * This caps them at the last OS versions that actually need them, so they no
 * longer apply on Android 13+. READ_MEDIA_IMAGES (the current photo-access
 * permission, justified because the app analyzes food photos) is left intact.
 */
const MAX_SDK = {
  'android.permission.READ_EXTERNAL_STORAGE': '32',
  'android.permission.WRITE_EXTERNAL_STORAGE': '28',
};

module.exports = function withScopedStoragePermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const perms = manifest['uses-permission'] || [];
    for (const perm of perms) {
      const name = perm.$ && perm.$['android:name'];
      if (name && MAX_SDK[name]) {
        perm.$['android:maxSdkVersion'] = MAX_SDK[name];
      }
    }
    return cfg;
  });
};

const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withInstagramQueries(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    manifest.queries = manifest.queries || [{}];
    const queries = manifest.queries[0];
    queries.package = queries.package || [];

    const packageName = 'com.instagram.android';
    const alreadyPresent = queries.package.some(
      (entry) => entry?.$?.['android:name'] === packageName,
    );

    if (!alreadyPresent) {
      queries.package.push({ $: { 'android:name': packageName } });
    }

    return androidConfig;
  });
};

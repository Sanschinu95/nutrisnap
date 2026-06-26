// Metro configuration for NutriSnap.
//
// The blockList excludes native build artifacts (gradle / xcode) that live
// inside node_modules. Metro's Windows FallbackWatcher can crash with ENOENT
// when these directories appear and disappear mid-build (see the
// react-native-reanimated/android/build/intermediates path that broke our
// dev-client launch).
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver ?? {};
config.resolver.blockList = exclusionList([
  /node_modules[\\/].*[\\/]android[\\/]build[\\/].*/,
  /node_modules[\\/].*[\\/]ios[\\/]build[\\/].*/,
  /node_modules[\\/].*[\\/]\.cxx[\\/].*/,
]);

module.exports = config;

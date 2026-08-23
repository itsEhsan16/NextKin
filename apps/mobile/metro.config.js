// Expo's default Metro config auto-detects the pnpm workspace root (hoisted node_modules).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `.svg` files import as React components (react-native-svg) so Figma vector assets are
// committed as-is and tinted via `color` / currentColor.
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

module.exports = config;

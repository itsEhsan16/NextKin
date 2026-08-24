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

// The dev Figma overlay require()s 25 artboard PNGs (~1.5MB) so screens can be measured against
// their frames on device. `<Stack.Protected guard={__DEV__}>` and the __DEV__ check inside
// FigmaOverlay keep it off screen in a release build, but neither keeps it out of the bundle:
// the require()s are static. Resolving the generated module to an empty stub does.
const figmaRefsStub = require.resolve('./src/dev/figmaRefs.stub.ts');
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = baseResolveRequest ?? context.resolveRequest;
  if (!context.dev && moduleName.endsWith('figmaRefs.generated')) {
    return { type: 'sourceFile', filePath: figmaRefsStub };
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;

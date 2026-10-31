/**
 * Jest resolver: Reanimated's, on top of React Native's.
 *
 * Reanimated 4.7 sends the modules that set up a UI runtime (its initializer among them) to their
 * web builds, and hands everything else to Worklets' resolver, which does the same for Worklets.
 * Setting it as the resolver replaces React Native's, which drops `react-native`'s `exports` map
 * so the deep `react-native/...` imports its mocks and ours use still resolve. So the two chain:
 * Reanimated's decides the request, React Native's resolves it.
 */
const reactNativeResolver = require('@react-native/jest-preset/jest/resolver');
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) => {
  const { defaultResolver } = options;
  return reanimatedResolver(request, {
    ...options,
    defaultResolver: (path, resolveOptions) =>
      reactNativeResolver(path, { ...resolveOptions, defaultResolver }),
  });
};

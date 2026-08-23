// Expo's default Metro config auto-detects the pnpm workspace root (hoisted node_modules).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;

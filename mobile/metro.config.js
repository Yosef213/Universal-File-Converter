const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the offline engine page (assets/engine/engine.html) as a static asset.
config.resolver.assetExts.push('html');

module.exports = config;

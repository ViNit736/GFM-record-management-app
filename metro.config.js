const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// Only prefer browser fields when bundling for web
if (process.env.EXPO_BUNDLER === 'web' || process.env.npm_lifecycle_event === 'web') {
  config.resolver.resolverMainFields = ['browser', 'module', 'main'];
}

// Redirect jspdf to its ES module version using resolveRequest
// This is more reliable than blockList + extraNodeModules for this specific case
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jspdf') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/jspdf/dist/jspdf.es.min.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

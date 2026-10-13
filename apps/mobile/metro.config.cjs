const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm nests transitive deps in each package's node_modules; keep hierarchical
// lookup so Metro can resolve them from workspace packages (e.g. jszip).
config.resolver.disableHierarchicalLookup = false;
config.resolver.assetExts = [...config.resolver.assetExts, 'html'];

module.exports = config;

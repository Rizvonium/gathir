#!/usr/bin/env node
/**
 * Writes .expo/types/router.d.ts (typed routes) and expo-env.d.ts without starting Metro, so
 * `npm run typecheck` checks every href against the real files in src/app.
 * `expo start` normally generates these; on CI / the cloud machine nothing else does, and without
 * them tsc silently skips route checking.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appRoot = path.join(root, 'src', 'app');
const typesDir = path.join(root, '.expo', 'types');

const cliPkg = require.resolve('@expo/cli/package.json', { paths: [path.dirname(require.resolve('expo/package.json', { paths: [root] }))] });
const generator = require.resolve('@expo/router-server/build/typed-routes', { paths: [path.dirname(cliPkg)] });

process.env.EXPO_ROUTER_APP_ROOT = appRoot;
fs.mkdirSync(typesDir, { recursive: true });

const envFile = path.join(root, 'expo-env.d.ts');
if (!fs.existsSync(envFile)) {
  fs.writeFileSync(envFile, '/// <reference types="expo/types" />\n\n// NOTE: This file should not be edited and should be in your git ignore\n');
}

// regenerateDeclarations is debounced (~1 s); the pending timer keeps Node alive until it writes.
require(generator).regenerateDeclarations(typesDir, {});
process.on('exit', () => {
  if (!fs.existsSync(path.join(typesDir, 'router.d.ts'))) {
    console.error('gen-route-types: .expo/types/router.d.ts was not written');
    process.exitCode = 1;
  }
});

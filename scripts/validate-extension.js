#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'manifest.json');

function fail(message) {
  console.error(`\u274c ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`\u2705 ${message}`);
}

if (!fs.existsSync(manifestPath)) {
  fail('manifest.json is missing.');
  process.exit(1);
}

let manifest;
try {
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  manifest = JSON.parse(manifestRaw);
  pass('manifest.json is valid JSON.');
} catch (error) {
  fail(`Failed to read manifest.json: ${error.message}`);
  process.exit(1);
}

if (manifest.manifest_version !== 3) {
  fail(`Expected manifest_version 3 but found ${manifest.manifest_version}.`);
} else {
  pass('manifest_version is set to 3.');
}

if (typeof manifest.name !== 'string' || manifest.name.trim() === '') {
  fail('Extension name is missing.');
} else {
  pass('Extension name is defined.');
}

function ensureFile(relativePath, description) {
  const targetPath = path.join(projectRoot, relativePath);
  if (!relativePath) {
    fail(`${description} is not defined in manifest.json.`);
    return;
  }
  if (!fs.existsSync(targetPath)) {
    fail(`${description} file is missing: ${relativePath}`);
  } else {
    pass(`${description} file exists: ${relativePath}`);
  }
}

if (manifest.background && manifest.background.service_worker) {
  ensureFile(manifest.background.service_worker, 'Background service worker');
} else {
  fail('Background service worker is not configured.');
}

if (manifest.action && manifest.action.default_popup) {
  ensureFile(manifest.action.default_popup, 'Popup HTML');
} else {
  fail('Popup HTML is not configured.');
}

if (Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0) {
  manifest.content_scripts.forEach((scriptConfig, index) => {
    if (!Array.isArray(scriptConfig.js) || scriptConfig.js.length === 0) {
      fail(`content_scripts[${index}] is missing JavaScript files.`);
      return;
    }
    scriptConfig.js.forEach((file) => {
      ensureFile(file, `Content script ${file}`);
    });
    if (!Array.isArray(scriptConfig.matches) || scriptConfig.matches.length === 0) {
      fail(`content_scripts[${index}] is missing match patterns.`);
    } else {
      pass(`content_scripts[${index}] defines match patterns.`);
    }
  });
} else {
  fail('No content scripts are configured.');
}

if (process.exitCode) {
  console.error('\nExtension validation failed.');
  process.exit(1);
} else {
  console.log('\nAll extension validation checks passed.');
}

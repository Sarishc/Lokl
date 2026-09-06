#!/usr/bin/env node
// Single command that bumps the one authoritative version (version.json at repo root)
// and propagates it everywhere else that needs a copy of it.
//
// Android reads version.json directly at Gradle-evaluation time (android/variables.gradle)
// so it is always in sync automatically — nothing to do here for Android.
//
// iOS's MARKETING_VERSION/CURRENT_PROJECT_VERSION live inside project.pbxproj, which is
// not something a plain build-time script can read the way Gradle can without an actual
// Xcode Run Script Build Phase (out of reach to add safely without Xcode installed to
// verify the project file still opens correctly — see docs/audit/FINDINGS.md LOKL-030
// and the Step 1 report's Task 4 write-up). So this script keeps iOS in sync at *bump*
// time instead of *build* time: every bump immediately patches project.pbxproj's four
// existing MARKETING_VERSION/CURRENT_PROJECT_VERSION fields via a narrow, exact-match
// text substitution — the same technique fastlane's increment_build_number uses.
//
// versionCode must be monotonically increasing for Play — it is never read from a
// human-editable field, only ever incremented by this script, so it cannot regress.
//
// Usage: node scripts/version-bump.cjs [major|minor|patch]   (default: patch)
const fs = require('fs');
const path = require('path');

const bumpType = process.argv[2] || 'patch';
if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error(`Usage: node scripts/version-bump.cjs [major|minor|patch] (got: ${bumpType})`);
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const versionFile = path.join(repoRoot, 'version.json');
const packageJsonFile = path.join(repoRoot, 'package.json');
const pbxprojFile = path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj');

const current = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
const [major, minor, patch] = current.version.split('.').map(Number);

let nextVersion;
if (bumpType === 'major') nextVersion = `${major + 1}.0.0`;
else if (bumpType === 'minor') nextVersion = `${major}.${minor + 1}.0`;
else nextVersion = `${major}.${minor}.${patch + 1}`;

const nextVersionCode = current.versionCode + 1; // always +1 — never settable directly

const next = { version: nextVersion, versionCode: nextVersionCode };
fs.writeFileSync(versionFile, `${JSON.stringify(next, null, 2)}\n`);
console.log(`version.json: ${current.version} (code ${current.versionCode}) -> ${next.version} (code ${next.versionCode})`);

// package.json's own "version" field is unrelated to either store, but keeping it in
// sync removes the "coincidence" this whole task exists to eliminate.
const pkg = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
pkg.version = next.version;
fs.writeFileSync(packageJsonFile, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`package.json: version -> ${next.version}`);

// Narrow, exact-match substitution — only these two known keys, only their numeric
// value, formatting otherwise untouched. Same field appears twice (Debug + Release).
let pbxproj = fs.readFileSync(pbxprojFile, 'utf8');
const marketingBefore = (pbxproj.match(/MARKETING_VERSION = [^;]+;/g) || []).length;
const buildBefore = (pbxproj.match(/CURRENT_PROJECT_VERSION = [^;]+;/g) || []).length;

pbxproj = pbxproj.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${next.version};`);
pbxproj = pbxproj.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${next.versionCode};`);

fs.writeFileSync(pbxprojFile, pbxproj);
console.log(
  `project.pbxproj: MARKETING_VERSION -> ${next.version} (${marketingBefore} occurrences), ` +
    `CURRENT_PROJECT_VERSION -> ${next.versionCode} (${buildBefore} occurrences)`,
);

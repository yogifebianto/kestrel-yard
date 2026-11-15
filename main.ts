// KESTREL YARD entry point for make.fun three.js FPS bounty
//
// This program packages the game for submission by copying game/ and screenshots/ to the output
// directory and generating dossier.json, the manifest the scorer reads to validate the entry.
//
// Run locally: MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container, it writes to /output by default.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

// Resolve the directory containing this script
const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));

// Output directory: use MAKEFUN_OUTPUT_DIR env var, or fall back to /output for the grader
const outputDirectory = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Create the output directory structure
mkdirSync(outputDirectory, { recursive: true });

// Copy the game files (the browser-loadable three.js application)
const gameSource = join(scriptDirectory, 'game');
const gameDestination = join(outputDirectory, 'game');
cpSync(gameSource, gameDestination, { recursive: true });

// Copy screenshots if they exist (the first screenshot by name becomes the cover image)
const screenshotsSource = join(scriptDirectory, 'screenshots');
const screenshotsDestination = join(outputDirectory, 'screenshots');
mkdirSync(screenshotsDestination, { recursive: true });

if (existsSync(screenshotsSource)) {
  cpSync(screenshotsSource, screenshotsDestination, { recursive: true });
}

// Generate dossier.json with the scorer's caps from reference/gate.json:
//
// - text_max_bytes: 163840 (160 KiB) - truncates the dossier's text fields to fit this limit
// - screenshots.max: 4 - rejects entries with more than 4 screenshots
// - screenshots.max_bytes: 262144 (256 KiB) - rejects any screenshot over this size
// - game_max_files: 993 - rejects entries with more than 993 files in game/
//   (the grader allows 1000 total entries in /output including game/, screenshots/, and dossier.json)
// - game_max_bytes: 50331648 (48 MiB) - rejects entries where game/ exceeds this total size
//
// These caps ensure the entry passes the scorer's validation before it reaches the judge.

const dossierContent = buildDossier(outputDirectory, {
  text_max_bytes: 163840,
  screenshots: {
    max: 4,
    max_bytes: 262144,
  },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

const dossierPath = join(outputDirectory, 'dossier.json');
writeFileSync(dossierPath, dossierContent);

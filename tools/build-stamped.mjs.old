#!/usr/bin/env node
/**
 * Run a doc build only when its inputs have changed.
 *
 * Usage:
 *   node tools/build-stamped.mjs <rules|paper> [--force]
 *   DOC_BUILD_FORCE=1 node tools/build-stamped.mjs paper
 *
 * Stamp file: `.docs-build-stamps.json` (committed) — SHA-256 over the
 * sorted list of input paths + file contents. Skips the build command when
 * the stamp matches and every output path exists. PDFlatex embeds wall-clock
 * timestamps, so skipping is what keeps committed PDFs stable.
 */

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAMP_PATH = join(ROOT, '.docs-build-stamps.json');

/** @typedef {{ inputs: string[]; outputs: string[]; command: string; cwd?: string }} DocBuild */

/** @type {Record<string, DocBuild>} */
const BUILDS = {
  rules: {
    inputs: ['RULES.tex'],
    outputs: [
      'RULES.pdf',
      'RULES.html',
      'RULES.md',
      'apps/Warp12/public/rules.pdf',
    ],
    // Two pdflatex passes so longtable column widths settle before pandoc runs.
    // Mirror the paper build: ship the typeset PDF into the app public/ tree.
    command:
      'pdflatex -interaction=nonstopmode RULES.tex && pdflatex -interaction=nonstopmode RULES.tex && pandoc RULES.tex -f latex -t html --mathjax -s -o RULES.html && pandoc RULES.tex -f latex -t gfm -o RULES.md && mkdir -p apps/Warp12/public && cp -f RULES.pdf apps/Warp12/public/rules.pdf && rm -f RULES.aux RULES.log RULES.out',
  },
  paper: {
    inputs: [
      'docs/tei-paper.tex',
      'docs/tei-paper.bib',
      'tools/nn/figures/*.png',
    ],
    outputs: [
      'docs/tei-paper.pdf',
      'docs/tei-paper.html',
      'docs/tei-paper.md',
      'apps/Warp12/public/tei-paper.pdf',
    ],
    // Keep sed escapes identical to the former package.json script (shell sees \[ … \]).
    command:
      "mkdir -p apps/Warp12/public/figures && cp -f tools/nn/figures/*.png apps/Warp12/public/figures/ 2>/dev/null || true && cd docs && pdflatex -interaction=nonstopmode tei-paper.tex && pdflatex -interaction=nonstopmode tei-paper.tex && cp tei-paper.pdf ../apps/Warp12/public/ && pandoc tei-paper.tex -f latex -t html --mathml --number-sections -s -o tei-paper.html && pandoc tei-paper.tex -f latex -t gfm -o tei-paper.md && cd .. && sed -i.bak 's|../tools/nn/figures/|/figures/|g' docs/tei-paper.html && sed -i.bak 's|>\\[tab:[^]]*\\]|>Table|g' docs/tei-paper.html && sed -i.bak 's|>\\[fig:[^]]*\\]|>Figure|g' docs/tei-paper.html && rm -f docs/tei-paper.html.bak docs/tei-paper.aux docs/tei-paper.log docs/tei-paper.out",
  },
};

/**
 * Expand a repo-relative path or simple `dir/*.ext` glob to absolute files.
 * @param {string} pattern
 * @returns {string[]}
 */
function expandInput(pattern) {
  const abs = join(ROOT, pattern);
  if (pattern.includes('*')) {
    const lastSlash = pattern.lastIndexOf('/');
    const dirRel = lastSlash >= 0 ? pattern.slice(0, lastSlash) : '.';
    const fileGlob = lastSlash >= 0 ? pattern.slice(lastSlash + 1) : pattern;
    const dirAbs = join(ROOT, dirRel);
    if (!existsSync(dirAbs)) {
      return [];
    }
    const star = fileGlob.indexOf('*');
    const prefix = fileGlob.slice(0, star);
    const suffix = fileGlob.slice(star + 1);
    return readdirSync(dirAbs)
      .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
      .map((name) => join(dirAbs, name))
      .sort();
  }
  return [abs];
}

/**
 * @param {string[]} patterns
 * @returns {string} hex sha256
 */
function hashInputs(patterns) {
  const hash = createHash('sha256');
  /** @type {string[]} */
  const files = [];
  for (const pattern of patterns) {
    files.push(...expandInput(pattern));
  }
  const unique = [...new Set(files)].sort();
  for (const file of unique) {
    const rel = relative(ROOT, file).split('\\').join('/');
    hash.update(rel);
    hash.update('\0');
    if (!existsSync(file) || !statSync(file).isFile()) {
      hash.update('MISSING');
      hash.update('\0');
      continue;
    }
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  // Include the pattern list so adding a new input pattern invalidates stamps.
  hash.update(JSON.stringify(patterns));
  return hash.digest('hex');
}

/**
 * @returns {Record<string, { hash: string; updatedAt: string }>}
 */
function readStamps() {
  if (!existsSync(STAMP_PATH)) {
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(STAMP_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, { hash: string; updatedAt: string }>} stamps
 */
function writeStamps(stamps) {
  writeFileSync(STAMP_PATH, `${JSON.stringify(stamps, null, 2)}\n`, 'utf8');
}

/**
 * @param {string[]} outputs
 */
function outputsExist(outputs) {
  return outputs.every((rel) => existsSync(join(ROOT, rel)));
}

function main() {
  const args = process.argv.slice(2);
  const force =
    args.includes('--force') ||
    process.env.DOC_BUILD_FORCE === '1' ||
    process.env.DOC_BUILD_FORCE === 'true';
  const name = args.find((a) => !a.startsWith('-'));
  if (!name || !(name in BUILDS)) {
    console.error(
      `Usage: node tools/build-stamped.mjs <${Object.keys(BUILDS).join('|')}> [--force]`
    );
    process.exit(1);
  }

  const build = BUILDS[name];
  const nextHash = hashInputs(build.inputs);
  const stamps = readStamps();
  const prev = stamps[name];
  const haveOutputs = outputsExist(build.outputs);

  if (!force && prev?.hash === nextHash && haveOutputs) {
    console.log(
      `[build-stamped] ${name}: inputs unchanged (${nextHash.slice(0, 12)}…) — skipping`
    );
    return;
  }

  if (!force && prev?.hash === nextHash && !haveOutputs) {
    console.log(
      `[build-stamped] ${name}: stamp matches but outputs missing — rebuilding`
    );
  } else if (force) {
    console.log(`[build-stamped] ${name}: forced rebuild`);
  } else if (prev?.hash) {
    console.log(`[build-stamped] ${name}: inputs changed — rebuilding`);
  } else {
    console.log(`[build-stamped] ${name}: no stamp yet — building`);
  }

  for (const out of build.outputs) {
    const dir = dirname(join(ROOT, out));
    mkdirSync(dir, { recursive: true });
  }

  execSync(build.command, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  stamps[name] = {
    hash: nextHash,
    updatedAt: new Date().toISOString(),
  };
  writeStamps(stamps);
  console.log(
    `[build-stamped] ${name}: wrote stamp ${nextHash.slice(0, 12)}… → ${relative(ROOT, STAMP_PATH)}`
  );
}

main();

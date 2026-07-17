#!/usr/bin/env node
/*
 * Frontend build for Shivam Enterprises LMS.
 *
 * Two jobs, both deterministic and order-preserving:
 *
 *  1) BUNDLE  — concatenate every file in src/app (in filename order) into a
 *     single classic script, then run it through esbuild (whitespace/comment
 *     stripping only — identifiers are NOT renamed) and write ./app.bundle.js.
 *
 *     Why concatenate instead of `esbuild --bundle`?  The original app was four
 *     <script> tags that all shared ONE global scope, relied on function
 *     hoisting, and are called from 227 inline on* handlers in the HTML. ES-module
 *     bundling gives each file its own scope and would break every one of those
 *     cross-references. Concatenating the source files in their original order
 *     reproduces the exact single-scope runtime, so there are zero regressions,
 *     while the *source* is now cleanly split into concern files under src/app.
 *
 *  2) ASSEMBLE — read src/index.template.html, inline each
 *     <!--#include views/x.html--> partial, drop in the <script> tag for the
 *     bundle, and write ./index.html (the file Electron actually loads). The
 *     views live in their own files but the final DOM is identical to the
 *     original monolith, so nothing that queries the DOM is affected.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const APP_DIR = path.join(ROOT, 'src', 'app');
const VIEWS_DIR = path.join(ROOT, 'src', 'views');
const TEMPLATE = path.join(ROOT, 'src', 'index.template.html');
const BUNDLE_OUT = path.join(ROOT, 'app.bundle.js');
const HTML_OUT = path.join(ROOT, 'index.html');

function log(msg) { process.stdout.write(msg + '\n'); }

// ---- 1. bundle app modules (order = filename order) -----------------------
function readAppModules() {
  const files = fs.readdirSync(APP_DIR).filter(f => f.endsWith('.js')).sort();
  if (!files.length) throw new Error('No app modules found in src/app');
  return files.map(f => ({
    name: f,
    code: fs.readFileSync(path.join(APP_DIR, f), 'utf8')
  }));
}

async function bundle() {
  const mods = readAppModules();
  // Concatenate with a comment banner per module so stack traces & debugging
  // still tell you which source file you are in.
  const combined = mods.map(m =>
    `\n/* ===================== src/app/${m.name} ===================== */\n` + m.code
  ).join('\n');

  let output = combined;
  try {
    const esbuild = require('esbuild');
    const res = await esbuild.transform(combined, {
      loader: 'js',
      // Whitespace + dead-comment removal only. We deliberately DO NOT rename
      // identifiers (minifyIdentifiers:false) or rewrite syntax, because the
      // 227 inline HTML handlers reference these globals by their exact names.
      minifyWhitespace: true,
      minifyIdentifiers: false,
      minifySyntax: false,
      legalComments: 'none',
      charset: 'utf8'
    });
    output = res.code;
    log('  esbuild: transformed ' + mods.length + ' modules (' +
        (combined.length / 1024).toFixed(0) + 'kb -> ' +
        (output.length / 1024).toFixed(0) + 'kb)');
  } catch (e) {
    // esbuild missing or failed: fall back to a plain, still-correct concatenation.
    log('  esbuild unavailable (' + (e && e.message) + ') - writing readable concat instead');
  }
  fs.writeFileSync(BUNDLE_OUT, output, 'utf8');
  log('  wrote app.bundle.js');
}

// ---- 2. assemble index.html from template + view partials -----------------
function assemble() {
  let html = fs.readFileSync(TEMPLATE, 'utf8');

  // Inline each <!--#include views/NAME--> with the partial's contents.
  html = html.replace(/<!--#include\s+views\/([^\s>]+?)\s*-->/g, (m, name) => {
    const p = path.join(VIEWS_DIR, name);
    if (!fs.existsSync(p)) throw new Error('Missing view partial: ' + name);
    return fs.readFileSync(p, 'utf8').replace(/\n$/, '');
  });

  // Drop the app bundle <script> where the last original app script was
  // (end of <body>, so the whole DOM exists before any app code runs).
  html = html.replace(/<!--#appbundle-->/g, '<script src="app.bundle.js"></script>');

  if (html.includes('<!--#include') || html.includes('<!--#appbundle-->')) {
    throw new Error('Unresolved build markers remain in index.html');
  }
  fs.writeFileSync(HTML_OUT, html, 'utf8');
  log('  wrote index.html');
}

(async function main() {
  log('Building Shivam LMS frontend...');
  await bundle();
  assemble();
  log('Done.');
})().catch(err => { console.error('BUILD FAILED:', err); process.exit(1); });

// build.js concatenates src/app/*.js into ONE shared scope, so a name defined
// twice is one name and the file loading last silently wins.
//
// Most files wrap themselves in an IIFE, which makes their helpers private --
// those are safe no matter how generic the name. The real global surface is:
//   * top-level declarations in files that are NOT IIFE-wrapped
//   * every `window.X = function` assignment, wherever it appears
// This reports duplicates on that surface only, and flags whether the two
// bodies actually differ.
//
// Run: node tools/scan-collisions.js
'use strict';
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'app');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();

function declutter(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^\\:])\/\/[^\n]*/g, '$1')
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '``')
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

// Is the whole file sealed inside one IIFE?
function isWrapped(src) {
  const clean = declutter(src);
  const i = clean.search(/^\(\s*function\s*\(/m);
  if (i < 0) return false;
  const b = clean.indexOf('{', i);
  let d = 0;
  for (let j = b; j < clean.length; j++) {
    if (clean[j] === '{') d++;
    else if (clean[j] === '}' && --d === 0) {
      // nothing of substance may follow the closing brace
      return clean.slice(j + 1).replace(/[\s)(;]/g, '').length === 0;
    }
  }
  return false;
}

function defs(src, wrapped) {
  const out = [];
  let depth = 0, n = 0;
  for (const raw of declutter(src).split('\n')) {
    n++;
    let m;
    // window.* is global from any depth
    if ((m = raw.match(/^\s*window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function/))) out.push([m[1], n]);
    else if (!wrapped && depth === 0) {
      if ((m = raw.match(/^\s*function\s+([A-Za-z_$][\w$]*)/))) out.push([m[1], n]);
      else if ((m = raw.match(/^\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function/))) out.push([m[1], n]);
    }
    for (const c of raw) { if (c === '{') depth++; else if (c === '}') depth--; }
  }
  return out;
}

function bodyAt(file, line) {
  const from = fs.readFileSync(path.join(dir, file), 'utf8').split('\n').slice(line - 1).join('\n');
  const b = from.indexOf('{');
  if (b < 0) return from.slice(0, 200);
  let d = 0;
  for (let i = b; i < from.length; i++) {
    if (from[i] === '{') d++;
    else if (from[i] === '}' && --d === 0) return from.slice(b, i + 1).replace(/\s+/g, ' ');
  }
  return from.slice(b, b + 400);
}

const seen = Object.create(null);
let wrappedCount = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const w = isWrapped(src);
  if (w) wrappedCount++;
  for (const [name, line] of defs(src, w)) (seen[name] = seen[name] || []).push({ file: f, line });
}

const dups = Object.entries(seen).filter(([, v]) => v.length > 1);
let differing = 0;
for (const [name, where] of dups) {
  const bodies = where.map(w => bodyAt(w.file, w.line));
  const same = bodies.every(b => b === bodies[0]);
  if (!same) differing++;
  console.log((same ? 'same    ' : 'DIFFERS ') + name.padEnd(20) +
    where.map(w => w.file + ':' + w.line).join('   '));
}
console.log('\n' + files.length + ' files (' + wrappedCount + ' IIFE-wrapped, ' +
  (files.length - wrappedCount) + ' contributing globals)');
console.log(dups.length + ' duplicated global name(s), ' + differing + ' with differing bodies.');
process.exitCode = differing ? 1 : 0;

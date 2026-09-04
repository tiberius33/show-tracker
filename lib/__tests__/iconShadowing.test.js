/**
 * Guards against a lucide-react icon import shadowing a global constructor
 * for its whole module.
 *
 * This exists because of a real crash: TourBrowseModal imported lucide's
 * `Map` icon unaliased, which shadowed the global `Map` — so `new Map()` in
 * the month-grouping memo threw "Map is not a constructor" and took the
 * whole page down with a client-side exception. It only fired on tours long
 * enough to trigger month grouping, so it survived a clean build, a green
 * unit suite and a working deploy preview.
 *
 * lucide exports plenty of these names (Map, Image, Menu, Text, Option,
 * Audio, Comment, File...), so the rule is: if a module imports one bare
 * AND calls `new <Name>(` anywhere, that's the bug.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/iconShadowing.test.js
 */

import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIRS = ['app', 'components', 'lib', 'hooks'];

// Global constructors that lucide-react also exports an icon for.
const SHADOWABLE = [
  'Map', 'Set', 'Image', 'Text', 'Option', 'Audio', 'Comment',
  'File', 'Range', 'Selection', 'Notification', 'Screen', 'History',
];

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

console.log('\nlucide-react icon / global constructor shadowing\n');

test('no module imports a lucide icon bare and then calls new on that name', () => {
  const files = DIRS.flatMap(d => walk(path.join(ROOT, d)));
  const offenders = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    // Multi-line import blocks are the norm in this repo, so match across
    // newlines rather than line by line — the original bug hid in one.
    for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/gs)) {
      // Strip comments from the WHOLE block before splitting on commas.
      // Doing it the other way round lets a comma inside a comment (and
      // the real import block here contains one) glue comment prose onto
      // the next name, so `Map` never compares equal to "Map" and the
      // scan silently passes.
      const bare = stripComments(match[1])
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .filter(part => !part.includes(' as '));

      for (const name of SHADOWABLE) {
        if (bare.includes(name) && new RegExp(`\\bnew\\s+${name}\\s*\\(`).test(source)) {
          offenders.push(
            `${path.relative(ROOT, file)}: imports lucide \`${name}\` unaliased and calls \`new ${name}(\` ` +
            `— alias it (e.g. \`${name} as ${name}Icon\`)`
          );
        }
      }
    }
  }

  assert.deepStrictEqual(offenders, [], `\n  ${offenders.join('\n  ')}\n`);
});

test('the scanner actually detects the shape it is guarding against', () => {
  // Self-check with the exact source shape of the original bug, so a
  // refactor that breaks the regex fails loudly instead of passing vacuously.
  // Includes a comma inside a comment, which is exactly what defeated the
  // first version of this scanner.
  const buggy = [
    'import {',
    '  Search, Check,',
    '  // lucide exports an icon named `Map`, and importing it bare shadows',
    '  // the global constructor.',
    '  Map, MapPin,',
    "} from 'lucide-react';",
    'const m = new Map();',
  ].join('\n');
  const importMatch = [...buggy.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/gs)];
  assert.strictEqual(importMatch.length, 1, 'multi-line lucide import should be matched');
  const bare = stripComments(importMatch[0][1]).split(',').map(p => p.trim()).filter(Boolean).filter(p => !p.includes(' as '));
  assert.ok(bare.includes('Map'), 'bare Map should be detected despite a comma inside a comment');
  assert.ok(/\bnew\s+Map\s*\(/.test(buggy), 'new Map( should be detected');
});

test('an aliased import of the same icon is not flagged', () => {
  const fixed = `import {\n  Search,\n  Map as MapIcon,\n} from 'lucide-react';\nconst m = new Map();`;
  const importMatch = [...fixed.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/gs)];
  const bare = stripComments(importMatch[0][1]).split(',').map(p => p.trim()).filter(Boolean).filter(p => !p.includes(' as '));
  assert.ok(!bare.includes('Map'), 'an aliased Map must not count as bare');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

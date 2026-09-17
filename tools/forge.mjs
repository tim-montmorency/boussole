#!/usr/bin/env node
// forge — venue bundle tooling (plan Phase 5.0: validate + hash first).
// Rust rewrite (boussole-forge) lands in Phase 6 with identical behaviour;
// these commands are the reference implementation and CI gate.
//
//   node tools/forge.mjs validate <venue-dir>   schema + media hashes
//   node tools/forge.mjs hash <venue-dir>       print/add media sha256 map
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { validate } from '../app/src/lib/content/validate.js';

const [cmd, dir] = process.argv.slice(2);
if (!cmd || !dir) {
  console.error('usage: forge.mjs validate|hash <venue-dir>');
  process.exit(2);
}

const schema = JSON.parse(readFileSync(new URL('../app/schemas/venue.schema.json', import.meta.url), 'utf8'));
const manifestPath = join(dir, 'venue.json');

function hashFile(p) {
  return 'sha256:' + createHash('sha256').update(readFileSync(p)).digest('hex');
}

function mediaFiles() {
  const mediaDir = join(dir, 'media');
  if (!existsSync(mediaDir)) return [];
  return readdirSync(mediaDir).map((f) => `media/${f}`);
}

if (cmd === 'validate') {
  if (!existsSync(manifestPath)) {
    console.error(`✗ ${manifestPath} not found`);
    process.exit(1);
  }
  const bundle = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const res = validate(bundle, schema, 'venue.json');
  let bad = res.errors.length;
  for (const e of res.errors) console.error(`✗ ${e.file} ${e.rule}: ${e.message}`);

  // DATA-2: verify declared media hashes against the files on disk
  for (const [path, want] of Object.entries(bundle.media ?? {})) {
    const p = join(dir, path);
    if (!existsSync(p)) { console.error(`✗ media missing: ${path}`); bad++; continue; }
    const got = hashFile(p);
    if (got !== want) { console.error(`✗ media hash mismatch: ${path}`); bad++; }
  }
  // undeclared media
  for (const f of mediaFiles()) {
    if (!bundle.media?.[f]) console.error(`⚠ media not hashed in manifest: ${f}`);
  }
  // georeference residual report (PLAN-1)
  const { fitAffine } = await import('../app/src/lib/geometry/affine.js');
  try {
    const g = fitAffine(bundle.plan.controlPoints);
    const maxRes = Math.max(...g.residuals);
    console.log(`  georeference max residual: ${(maxRes * 111320).toFixed(2)} m`);
    if (maxRes * 111320 > 5) { console.error('⚠ residual > 5 m — check control points'); }
  } catch (e) {
    console.error(`✗ georeference: ${e.message}`); bad++;
  }
  if (bad) { console.error(`✗ ${bad} error(s)`); process.exit(1); }
  console.log('✓ bundle valid');
} else if (cmd === 'hash') {
  const bundle = JSON.parse(readFileSync(manifestPath, 'utf8'));
  bundle.media = Object.fromEntries(mediaFiles().map((f) => [f, hashFile(join(dir, f))]));
  writeFileSync(manifestPath, JSON.stringify(bundle, null, 2) + '\n');
  console.log(`✓ wrote ${Object.keys(bundle.media).length} media hashes into ${relative('.', manifestPath)}`);
} else {
  console.error(`unknown command: ${cmd}`);
  process.exit(2);
}

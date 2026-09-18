// tools/vendor-jsqr.mjs — rebuild src/lib/vendor/jsQR.esm.js from node_modules
import { readFileSync, writeFileSync } from 'node:fs';
const umd = readFileSync('node_modules/jsqr/dist/jsQR.js', 'utf8');
const tpl = readFileSync('src/lib/vendor/jsQR.esm.js', 'utf8');
writeFileSync('src/lib/vendor/jsQR.esm.js', tpl.replace('/* JSQR_BODY */', umd));
console.log('✓ vendored jsQR', (umd.length/1024).toFixed(0)+'KB');

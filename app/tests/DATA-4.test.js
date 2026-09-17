import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validate } from '../src/lib/content/validate.js';

const schema = JSON.parse(readFileSync(new URL('../schemas/venue.schema.json', import.meta.url), 'utf8'));
const example = JSON.parse(readFileSync(new URL('../../venues/example/venue.json', import.meta.url), 'utf8'));

// DATA-4: invalid bundles produce an error-card shape; validation never throws.
describe('DATA-4 bundle validation', () => {
  it('accepts the example venue bundle', () => {
    const r = validate(example, schema);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it('reports missing required properties with path + rule', () => {
    const bad = structuredClone(example);
    delete bad.origin;
    const r = validate(bad, schema);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({ file: 'venue.json', rule: 'required' });
    expect(r.errors[0].message).toContain('origin');
  });
  it('rejects unknown properties (additionalProperties false)', () => {
    const bad = structuredClone(example);
    bad.surprise = 1;
    expect(validate(bad, schema).errors.some((e) => e.rule === 'additionalProperties')).toBe(true);
  });
  it('rejects out-of-range latitude via definitions/$ref', () => {
    const bad = structuredClone(example);
    bad.origin.lat = 123;
    expect(validate(bad, schema).errors.some((e) => e.rule === 'maximum')).toBe(true);
  });
  it('rejects fewer than 3 control points', () => {
    const bad = structuredClone(example);
    bad.plan.controlPoints.pop();
    expect(validate(bad, schema).errors.some((e) => e.rule === 'minItems')).toBe(true);
  });
  it('rejects bad enum values (ASCII enums, DATA-5)', () => {
    const bad = structuredClone(example);
    bad.reperes[0].tableaux[0].trigger = 'arrivée'; // accented — invalid
    const r = validate(bad, schema);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.rule === 'enum')).toBe(true);
  });
  it('rejects malformed media hashes', () => {
    const bad = structuredClone(example);
    bad.media = { 'media/x.webm': 'not-a-hash' };
    expect(validate(bad, schema).errors.some((e) => e.rule === 'pattern')).toBe(true);
  });
  it('never throws, even on garbage input', () => {
    expect(validate(null, schema).ok).toBe(false);
    expect(validate(42, schema).ok).toBe(false);
    expect(validate('x', schema).ok).toBe(false);
  });
});

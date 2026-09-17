/**
 * Hand-rolled JSON-Schema subset validator (no runtime dependencies).
 * Supports: type, properties, required, items, enum, additionalProperties,
 * minimum/maximum, minItems, pattern, $ref to "#/definitions/…".
 * Failures return DATA-4's error-card shape; the validator never throws.
 */

/**
 * @param {any} value @param {any} schema @param {any} root
 * @param {string} path @param {any[]} errors
 */
function check(value, schema, root, path, errors) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.$ref) {
    const name = schema.$ref.replace('#/definitions/', '');
    return check(value, root.definitions?.[name], root, path, errors);
  }
  /** @param {string} rule @param {string} message */
  const fail = (rule, message) => errors.push({ path, rule, message });

  if (schema.enum && !schema.enum.includes(value))
    return fail('enum', `value ${JSON.stringify(value)} not in enum`);
  if (schema.type) {
    const t = schema.type;
    const ok =
      t === 'array' ? Array.isArray(value) :
      t === 'integer' ? Number.isInteger(value) :
      t === 'number' ? typeof value === 'number' && Number.isFinite(value) :
      t === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) :
      t === 'string' ? typeof value === 'string' :
      t === 'boolean' ? typeof value === 'boolean' : true;
    if (!ok) return fail('type', `expected ${t}, got ${Array.isArray(value) ? 'array' : typeof value}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) fail('minimum', `${value} < ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) fail('maximum', `${value} > ${schema.maximum}`);
  }
  if (typeof value === 'string' && schema.pattern && !(new RegExp(schema.pattern).test(value)))
    fail('pattern', `"${value}" does not match ${schema.pattern}`);
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems)
      fail('minItems', `${value.length} items < ${schema.minItems}`);
    if (schema.items) value.forEach((v, i) => check(v, schema.items, root, `${path}/${i}`, errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of schema.required ?? [])
      if (!(k in value)) fail('required', `missing required property "${k}"`);
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(value)) {
      if (k in props) check(v, props[k], root, `${path}/${k}`, errors);
      else if (schema.additionalProperties === false)
        fail('additionalProperties', `unexpected property "${k}"`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
        check(v, schema.additionalProperties, root, `${path}/${k}`, errors);
    }
  }
}

/**
 * Validate a value against a schema.
 * @param {any} value @param {any} schema @param {string} [file]
 * @returns {{ ok: boolean, errors: { file: string, rule: string, message: string }[] }}
 * DATA-4: the error-card shape — callers render it, nothing throws.
 */
export function validate(value, schema, file = 'venue.json') {
  try {
    /** @type {{ path: string, rule: string, message: string }[]} */
    const errors = [];
    check(value, schema, schema, '#', errors);
    return { ok: errors.length === 0, errors: errors.map((e) => ({ file, ...e })) };
  } catch (err) {
    return { ok: false, errors: [{ file, rule: 'internal', message: String(err) }] };
  }
}

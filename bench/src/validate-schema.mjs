// Minimal JSON Schema (Draft 2020-12) validator covering the keyword subset
// used by bench/framework-matrix.schema.json. Intentionally not a full
// implementation: supports only the keywords that show up in the matrix
// schema today. Extending here is preferred over importing a transitive dep.
//
// Supported keywords:
//   $ref (local "#/..." only), $defs (lookup target), type (string + integer
//   + number + boolean + null + object + array), enum, pattern, minLength,
//   maxLength, minimum, maximum, properties, required, additionalProperties
//   (boolean | schema), patternProperties, items, minItems, uniqueItems.
//
// Unsupported keywords are silently ignored — extend as needs arise.

const TYPE_PREDICATES = {
  string: (v) => typeof v === "string",
  integer: (v) => typeof v === "number" && Number.isInteger(v),
  number: (v) => typeof v === "number" && Number.isFinite(v),
  boolean: (v) => typeof v === "boolean",
  null: (v) => v === null,
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  array: (v) => Array.isArray(v),
};

function jsonType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "string") return "string";
  return "object";
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  if (typeof a === "object") {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key, index) => key === bKeys[index] && deepEqual(a[key], b[key]));
  }
  return false;
}

function resolveRef(root, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    throw new Error(`validate-schema: only local $refs of form "#/..." are supported (got ${JSON.stringify(ref)}).`);
  }
  const segments = ref.slice(2).split("/").map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cursor = root;
  for (const segment of segments) {
    if (cursor == null || typeof cursor !== "object" || !(segment in cursor)) {
      throw new Error(`validate-schema: $ref ${ref} could not be resolved against schema root.`);
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function matchesType(expected, value) {
  const list = Array.isArray(expected) ? expected : [expected];
  return list.some((typeName) => {
    if (typeName === "number") {
      return TYPE_PREDICATES.number(value) || TYPE_PREDICATES.integer(value);
    }
    return TYPE_PREDICATES[typeName]?.(value) ?? false;
  });
}

function pushError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function validateNode(root, schema, value, path, errors) {
  if (schema == null || typeof schema !== "object") return;
  if (typeof schema.$ref === "string") {
    validateNode(root, resolveRef(root, schema.$ref), value, path, errors);
    return;
  }
  if (schema.type !== undefined && !matchesType(schema.type, value)) {
    pushError(errors, path, `expected type ${Array.isArray(schema.type) ? schema.type.join("|") : schema.type}, got ${jsonType(value)}`);
    return;
  }
  if (Array.isArray(schema.enum)) {
    const inEnum = schema.enum.some((allowed) => deepEqual(allowed, value));
    if (!inEnum) {
      pushError(errors, path, `value ${JSON.stringify(value)} not in enum [${schema.enum.map((entry) => JSON.stringify(entry)).join(", ")}]`);
    }
  }

  if (typeof value === "string") {
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
      pushError(errors, path, `string ${JSON.stringify(value)} does not match pattern /${schema.pattern}/`);
    }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      pushError(errors, path, `string length ${value.length} < minLength ${schema.minLength}`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      pushError(errors, path, `string length ${value.length} > maxLength ${schema.maxLength}`);
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      pushError(errors, path, `${value} < minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      pushError(errors, path, `${value} > maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      pushError(errors, path, `array length ${value.length} < minItems ${schema.minItems}`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (let index = 0; index < value.length; index += 1) {
        const key = JSON.stringify(value[index]);
        if (seen.has(key)) {
          pushError(errors, path, `duplicate item at index ${index}`);
        }
        seen.add(key);
      }
    }
    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        validateNode(root, schema.items, value[index], `${path}[${index}]`, errors);
      }
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          pushError(errors, path, `missing required property "${key}"`);
        }
      }
    }
    const propertiesSchema = schema.properties || {};
    const patternProperties = schema.patternProperties || {};
    const patternEntries = Object.entries(patternProperties).map(([pattern, sub]) => [new RegExp(pattern), sub]);

    for (const key of Object.keys(value)) {
      let matched = false;
      const childPath = `${path}.${key}`;
      if (Object.prototype.hasOwnProperty.call(propertiesSchema, key)) {
        matched = true;
        validateNode(root, propertiesSchema[key], value[key], childPath, errors);
      }
      for (const [regex, sub] of patternEntries) {
        if (regex.test(key)) {
          matched = true;
          validateNode(root, sub, value[key], childPath, errors);
        }
      }
      if (!matched) {
        if (schema.additionalProperties === false) {
          pushError(errors, path, `unexpected property "${key}" (additionalProperties: false)`);
        } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
          validateNode(root, schema.additionalProperties, value[key], childPath, errors);
        }
      }
    }
  }
}

export function validate(schema, data, rootPath = "$") {
  const errors = [];
  validateNode(schema, schema, data, rootPath, errors);
  return { ok: errors.length === 0, errors };
}

export function validateOrThrow(schema, data, label) {
  const result = validate(schema, data, "$");
  if (!result.ok) {
    const lines = result.errors.map((message) => `  - ${message}`);
    throw new Error(`Schema validation failed for ${label}:\n${lines.join("\n")}`);
  }
}

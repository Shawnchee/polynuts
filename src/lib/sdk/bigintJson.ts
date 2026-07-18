// JSON (de)serialization that survives BigInt.
//
// SDK types (e.g. Position) carry bigint fields, and JSON.stringify throws on
// BigInt ("Do not know how to serialize a BigInt"). Anything persisting such
// values (localStorage, etc.) must round-trip through these: bigints are tagged
// on the way out and restored on the way in, so consumers get REAL bigints back
// — not strings — which matters because downstream code does bigint arithmetic
// on them (e.g. positionLogic does `amount * 10n ** BigInt(...)`).
const TAG = '__bigint__';

export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? { [TAG]: value.toString() } : value;
}

export function bigintReviver(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>)[TAG] === 'string'
  ) {
    return BigInt((value as Record<string, string>)[TAG]);
  }
  return value;
}

/** Serialize a value to JSON, preserving bigint fields. */
export function stringifyWithBigint(value: unknown): string {
  return JSON.stringify(value, bigintReplacer);
}

/** Parse JSON produced by {@link stringifyWithBigint}, restoring bigints. */
export function parseWithBigint<T>(raw: string): T {
  return JSON.parse(raw, bigintReviver) as T;
}

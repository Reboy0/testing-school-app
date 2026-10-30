/**
 * Gives every row of a test table an OpenCards case id of its own, so each
 * test the table expands into reports under its own id:
 * withIds("VAL-021", "VAL-023", rows) → VAL-021, VAL-022, VAL-023.
 *
 * `last` is the id of the final row. A table that grows or shrinks fails
 * here, loudly, instead of sliding into the ids of the table after it.
 *
 * Rows are spread the way it.each spreads them: when every row is an array,
 * its items become the test's arguments; otherwise each row is one argument.
 */
type Row<T> = T extends readonly unknown[] ? T : readonly [T];

export function withIds<const T>(first: string, last: string, rows: readonly T[]): [string, ...Row<T>][] {
  const [, prefix, start] = /^(.*-)(\d+)$/.exec(first) ?? [];
  if (prefix === undefined) throw new Error(`withIds: "${first}" is not a case id`);
  const id = (index: number) => `${prefix}${String(Number(start) + index).padStart(start.length, "0")}`;
  if (id(rows.length - 1) !== last) {
    throw new Error(`withIds: ${rows.length} rows from ${first} end at ${id(rows.length - 1)}, not ${last}`);
  }
  const spread = rows.every((row) => Array.isArray(row));
  return rows.map((row, index) => [id(index), ...(spread ? (row as unknown[]) : [row])] as [string, ...Row<T>]);
}

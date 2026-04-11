/**
 * Extrait une valeur string depuis req.query ou req.params
 * (compatible @types/express v5 qui peut retourner string | string[])
 */
export const qs = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return String(v[0]);
  return String(v);
};

export const qsReq = (v: unknown): string =>
  Array.isArray(v) ? String(v[0]) : String(v);

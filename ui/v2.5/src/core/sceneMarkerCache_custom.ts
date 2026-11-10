export interface ICacheReferenceCustom {
  __ref: string;
}

export function upsertCacheReferenceCustom(
  references: readonly ICacheReferenceCustom[],
  reference: ICacheReferenceCustom
) {
  // CUSTOM: normalize any stale duplicate references left by overlapping
  // mutation/refetch results before applying the current marker update.
  const seen = new Set<string>();
  const uniqueReferences = references.filter((candidate) => {
    if (seen.has(candidate.__ref)) return false;
    seen.add(candidate.__ref);
    return true;
  });

  if (seen.has(reference.__ref)) {
    return uniqueReferences.length === references.length
      ? references
      : uniqueReferences;
  }

  return [...uniqueReferences, reference];
}

export function removeCacheReferenceCustom(
  references: readonly ICacheReferenceCustom[],
  referenceID: string
) {
  return references.filter((reference) => reference.__ref !== referenceID);
}

export interface ICacheReferenceCustom {
  __ref: string;
}

export function upsertCacheReferenceCustom(
  references: readonly ICacheReferenceCustom[],
  reference: ICacheReferenceCustom
) {
  if (references.some((candidate) => candidate.__ref === reference.__ref)) {
    return references;
  }

  return [...references, reference];
}

export function removeCacheReferenceCustom(
  references: readonly ICacheReferenceCustom[],
  referenceID: string
) {
  return references.filter((reference) => reference.__ref !== referenceID);
}

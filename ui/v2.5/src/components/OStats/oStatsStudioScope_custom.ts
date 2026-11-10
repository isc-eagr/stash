export interface IOStatsStudioScope {
  id: string;
  name: string;
  depth: number;
}

export function getOStatsStudioScope(
  studio: { id: string; name?: string | null },
  includeChildStudios: boolean
): IOStatsStudioScope {
  return {
    id: studio.id,
    name: studio.name ?? `Studio ${studio.id}`,
    depth: includeChildStudios ? -1 : 0,
  };
}

export function readOStatsStudioScope(
  search: string
): IOStatsStudioScope | undefined {
  const params = new URLSearchParams(search);
  const id = params.get("scopeStudioId");
  if (!id) return undefined;

  const depthValue = Number(params.get("scopeDepth") ?? 0);
  return {
    id,
    name: params.get("scopeStudioName") ?? `Studio ${id}`,
    depth: Number.isFinite(depthValue) ? depthValue : 0,
  };
}

export function addOStatsStudioScopeToPath(
  path: string,
  scope?: IOStatsStudioScope
) {
  if (!scope) return path;
  const [pathAndSearch, hash = ""] = path.split("#", 2);
  const [pathname, search = ""] = pathAndSearch.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("scopeStudioId", scope.id);
  params.set("scopeDepth", String(scope.depth));
  params.set("scopeStudioName", scope.name);
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

export function getOStatsStudioScopeVariables(scope?: IOStatsStudioScope) {
  return {
    studioId: scope?.id ?? null,
    depth: scope?.depth ?? null,
  };
}

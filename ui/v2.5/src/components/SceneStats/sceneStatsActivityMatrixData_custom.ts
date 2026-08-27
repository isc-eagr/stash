import type {
  IOutstandingActivityMatrix,
  IOutstandingActivityRow,
} from "src/components/Scenes/sceneCardInsightsData_custom";

export interface ISceneStatsActivityMatrixValue {
  tag_id: string;
  tag_name: string;
  parent_tag_ids: string[];
  duration: number;
  marker_count: number;
  percent: number;
}

export interface ISceneStatsActivityMatrixTreeRow {
  depth: number;
  hasChildren: boolean;
  row: IOutstandingActivityRow;
}

export interface ISceneStatsActivityMatrixStudioScope {
  id: string;
  name: string;
  depth: number;
}

export interface ISceneStatsActivityMatrixPerformerScope {
  id: string;
  name: string;
}

export function makeSceneStatsActivityMatrixTagURL(
  tag: { id: string },
  studioScope?: ISceneStatsActivityMatrixStudioScope,
  includeSubTags = false,
  performerScope?: ISceneStatsActivityMatrixPerformerScope
) {
  const subTagParameter = `includeSubTags=${includeSubTags ? "true" : "false"}`;
  const criteria: Record<string, unknown>[] = [];
  if (studioScope) {
    criteria.push({
      type: "studios",
      modifier: "INCLUDES",
      value: {
        items: [{ id: studioScope.id, label: studioScope.name }],
        excluded: [],
        depth: studioScope.depth,
      },
    });
  }
  if (performerScope) {
    const performer = { id: performerScope.id, label: performerScope.name };
    criteria.push({
      type: "marker_performers",
      modifier: "EQUALS",
      tag_ids: [],
      include_subtags: false,
      require_overlap: false,
      performer_mode: "OR",
      top_performer_ids: [performer],
      bottom_performer_ids: [performer],
      unnamed_performers: [],
    });
  }

  const criteriaParameters = criteria
    .map((criterion) => `c=${encodeURIComponent(JSON.stringify(criterion))}`)
    .join("&");
  return `/tags/${tag.id}/markers?${
    criteriaParameters ? `${criteriaParameters}&` : ""
  }${subTagParameter}&sortby=title`;
}

export function makeSceneStatsActivityMatrix(
  values: ISceneStatsActivityMatrixValue[]
): IOutstandingActivityMatrix {
  const rows: IOutstandingActivityRow[] = values
    .map((value) => ({
      amountLevel: "some" as const,
      cells: {},
      duration: value.duration,
      markerCount: value.marker_count,
      parentTagIds: value.parent_tag_ids,
      percent: value.percent,
      tag: { id: value.tag_id, name: value.tag_name },
    }))
    .sort(
      (a, b) =>
        b.duration - a.duration ||
        b.markerCount - a.markerCount ||
        a.tag.name.localeCompare(b.tag.name, undefined, {
          sensitivity: "base",
        }) ||
        a.tag.id.localeCompare(b.tag.id)
    );

  return { columns: [], rows };
}

export function makeSceneStatsActivityMatrixTreeRows(
  rows: IOutstandingActivityRow[],
  expandedTagIds: ReadonlySet<string>
): ISceneStatsActivityMatrixTreeRow[] {
  const rowByID = new Map(rows.map((row) => [row.tag.id, row]));
  const orderByID = new Map(rows.map((row, index) => [row.tag.id, index]));
  const parentByID = new Map<string, string>();
  const childrenByID = new Map<string, IOutstandingActivityRow[]>();

  for (const row of rows) {
    const parentID = (row.parentTagIds ?? [])
      .filter((id) => id !== row.tag.id && rowByID.has(id))
      .sort(
        (a, b) =>
          (orderByID.get(a) ?? Number.MAX_SAFE_INTEGER) -
            (orderByID.get(b) ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b)
      )[0];
    if (!parentID) continue;
    parentByID.set(row.tag.id, parentID);
    const siblings = childrenByID.get(parentID) ?? [];
    siblings.push(row);
    childrenByID.set(parentID, siblings);
  }

  const byOriginalOrder = (
    a: IOutstandingActivityRow,
    b: IOutstandingActivityRow
  ) =>
    (orderByID.get(a.tag.id) ?? Number.MAX_SAFE_INTEGER) -
    (orderByID.get(b.tag.id) ?? Number.MAX_SAFE_INTEGER);
  for (const children of childrenByID.values()) children.sort(byOriginalOrder);

  const ret: ISceneStatsActivityMatrixTreeRow[] = [];
  const visited = new Set<string>();
  const appendRow = (
    row: IOutstandingActivityRow,
    depth: number,
    ancestors: ReadonlySet<string>
  ) => {
    if (visited.has(row.tag.id) || ancestors.has(row.tag.id)) return;
    visited.add(row.tag.id);
    const children = childrenByID.get(row.tag.id) ?? [];
    ret.push({ depth, hasChildren: children.length > 0, row });
    if (!expandedTagIds.has(row.tag.id)) return;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(row.tag.id);
    for (const child of children) appendRow(child, depth + 1, nextAncestors);
  };

  for (const row of rows.filter((item) => !parentByID.has(item.tag.id))) {
    appendRow(row, 0, new Set());
  }

  return ret;
}

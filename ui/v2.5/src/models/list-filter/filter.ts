import {
  ConfigDataFragment,
  FilterMode,
  FindFilterType,
  SavedFilterDataFragment,
  SortDirectionEnum,
} from "src/core/generated-graphql";
import { Criterion } from "./criteria/criterion";
import { getFilterOptions } from "./factory";
import { CriterionType, DisplayMode, SavedUIOptions } from "./types";
import { ListFilterOptions } from "./filter-options";
import { CustomFieldsCriterion } from "./criteria/custom-fields";
import { MarkerTagsCriterion } from "./criteria/marker-tags";
import { MarkerTopCriterion } from "./criteria/marker-top";
import { MarkerBottomCriterion } from "./criteria/marker-bottom";

interface IDecodedParams {
  perPage?: number;
  sortby?: string;
  sortdir?: string;
  disp?: DisplayMode;
  q?: string;
  p?: number;
  z?: number;
  c?: string[];
}

interface IEncodedParams {
  perPage?: string | null;
  sortby?: string | null;
  sortdir?: string | null;
  disp?: string | null;
  q?: string | null;
  p?: string | null;
  z?: string | null;
  c?: string[];
}

const DEFAULT_PARAMS = {
  sortDirection: SortDirectionEnum.Asc,
  displayMode: DisplayMode.Grid,
  currentPage: 1,
  itemsPerPage: 40,
};

// TODO: handle customCriteria
export class ListFilterModel {
  public readonly mode: FilterMode;
  public readonly options: ListFilterOptions;
  private config?: ConfigDataFragment;
  public searchTerm: string = "";
  public currentPage = DEFAULT_PARAMS.currentPage;
  public itemsPerPage = DEFAULT_PARAMS.itemsPerPage;
  public sortDirection: SortDirectionEnum = DEFAULT_PARAMS.sortDirection;
  public sortBy?: string;
  public displayMode: DisplayMode = DEFAULT_PARAMS.displayMode;
  public zoomIndex: number = 1;
  public criteria: Array<Criterion> = [];
  public randomSeed = -1;
  private defaultZoomIndex: number = 1;

  public constructor(
    mode: FilterMode,
    config?: ConfigDataFragment,
    options?: {
      defaultZoomIndex?: number;
      defaultSortBy?: string;
      defaultSortDir?: SortDirectionEnum;
    }
  ) {
    this.mode = mode;
    this.config = config;
    this.options = getFilterOptions(mode);
    const { defaultSortBy, displayModeOptions } = this.options;

    if (options?.defaultSortBy) {
      this.sortBy = options.defaultSortBy;
      if (options.defaultSortDir) {
        this.sortDirection = options.defaultSortDir;
      }
    } else {
      this.sortBy = defaultSortBy;
      if (this.sortBy === "date") {
        this.sortDirection = SortDirectionEnum.Desc;
      }
    }
    this.displayMode = displayModeOptions[0];
    if (options?.defaultZoomIndex !== undefined) {
      this.defaultZoomIndex = options.defaultZoomIndex;
      this.zoomIndex = options.defaultZoomIndex;
    }
  }

  public clone() {
    const ret = Object.assign(
      new ListFilterModel(this.mode, this.config),
      this
    );
    ret.criteria = this.criteria.map((c) => c.clone());
    return ret;
  }

  public empty() {
    return new ListFilterModel(this.mode, this.config, {
      defaultZoomIndex: this.defaultZoomIndex,
    });
  }

  // returns a clone of the filter for metadata fetching
  // this removes the sort, page size and page number and zoom index
  public metadataInfo() {
    const clone = this.clone();
    clone.sortBy = undefined;
    clone.randomSeed = -1;
    clone.currentPage = 1;
    clone.sortDirection = DEFAULT_PARAMS.sortDirection;
    clone.itemsPerPage = 0;
    clone.zoomIndex = 1;
    clone.displayMode = DEFAULT_PARAMS.displayMode;
    return clone;
  }

  // returns the number of filters applied
  public count() {
    // don't include search term
    return this.criteria.length;
  }

  public configureFromDecodedParams(params: IDecodedParams) {
    if (params.perPage !== undefined) {
      this.itemsPerPage = params.perPage;
    }
    if (params.sortby !== undefined) {
      this.sortBy = params.sortby;

      // parse the random seed if provided
      const match = this.sortBy.match(/^random_(\d+)$/);
      if (match) {
        this.sortBy = "random";
        this.randomSeed = Number.parseInt(match[1], 10);
      }
    }
    if (params.sortdir !== undefined) {
      this.sortDirection =
        params.sortdir === "desc"
          ? SortDirectionEnum.Desc
          : SortDirectionEnum.Asc;
    } else {
      // #3193 - sortdir undefined means asc
      // #3559 - unless sortby is date, then desc
      this.sortDirection =
        params.sortby === "date"
          ? SortDirectionEnum.Desc
          : SortDirectionEnum.Asc;
    }
    if (params.disp !== undefined) {
      this.displayMode = params.disp;
    }
    if (params.q !== undefined) {
      this.searchTerm = params.q;
    }
    this.currentPage = params.p ?? 1;
    if (params.z !== undefined) {
      this.zoomIndex = params.z;
    }

    this.criteria = [];
    if (params.c !== undefined) {
      for (const jsonString of params.c) {
        try {
          const { type: criterionType, ...savedCriterion } =
            JSON.parse(jsonString);

          const criterion = this.makeCriterion(criterionType);
          criterion.fromDecodedParams(savedCriterion);

          this.criteria.push(criterion);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Failed to parse encoded criterion:", err);
        }
      }
    }
  }

  // Does not decode any URL-encoding, only type conversions
  public static decodeParams(params: IEncodedParams): IDecodedParams {
    const ret: IDecodedParams = {};

    if (params.perPage) {
      ret.perPage = Number.parseInt(params.perPage, 10);
    }
    if (params.sortby) {
      ret.sortby = params.sortby;
    }
    if (params.sortdir) {
      ret.sortdir = params.sortdir;
    }
    if (params.disp) {
      ret.disp = Number.parseInt(params.disp, 10);
    }
    if (params.q) {
      ret.q = params.q;
    }
    if (params.p) {
      ret.p = Number.parseInt(params.p, 10);
    }
    if (params.z) {
      const zoomIndex = Number.parseInt(params.z, 10);
      if (zoomIndex >= 0) {
        ret.z = zoomIndex;
      }
    }

    if (params.c && params.c.length !== 0) {
      ret.c = params.c.map((jsonString) =>
        ListFilterModel.translateJSON(jsonString, true)
      );
    }

    return ret;
  }

  private static translateJSON(jsonString: string, decoding: boolean) {
    let inString = false;
    let escape = false;
    return [...jsonString]
      .map((c) => {
        if (escape) {
          // this character has been escaped, skip
          escape = false;
          return c;
        }

        switch (c) {
          case "\\":
            // escape the next character if in a string
            if (inString) {
              escape = true;
            }
            break;
          case '"':
            // unescaped quote, toggle inString
            inString = !inString;
            break;
          case "(":
            // decode only: restore ( to { if not in a string
            if (decoding && !inString) {
              return "{";
            }
            break;
          case ")":
            // decode only: restore ) to } if not in a string
            if (decoding && !inString) {
              return "}";
            }
            break;
          case "{":
            // encode only: replace { with ( if not in a string
            if (!decoding && !inString) {
              return "(";
            }
            break;
          case "}":
            // encode only: replace } with ) if not in a string
            if (!decoding && !inString) {
              return ")";
            }
            break;
        }

        return c;
      })
      .join("");
  }

  public configureFromQueryString(queryString: string) {
    const query = new URLSearchParams(queryString);
    const params = {
      perPage: query.get("perPage"),
      sortby: query.get("sortby"),
      sortdir: query.get("sortdir"),
      disp: query.get("disp"),
      q: query.get("q"),
      p: query.get("p"),
      z: query.get("z"),
      c: query.getAll("c"),
    };
    const decoded = ListFilterModel.decodeParams(params);
    this.configureFromDecodedParams(decoded);
  }

  public configureFromSavedFilter(savedFilter: SavedFilterDataFragment) {
    const {
      find_filter: findFilter,
      object_filter: objectFilter,
      ui_options: uiOptions,
    } = savedFilter;

    this.itemsPerPage = findFilter?.per_page ?? this.itemsPerPage;
    this.sortBy = findFilter?.sort ?? this.sortBy;
    // parse the random seed if provided
    const match = this.sortBy?.match(/^random_(\d+)$/);
    if (match) {
      this.sortBy = "random";
      this.randomSeed = Number.parseInt(match[1], 10);
    }
    this.sortDirection = findFilter?.direction ?? this.sortDirection;
    this.searchTerm = findFilter?.q ?? this.searchTerm;

    this.displayMode = uiOptions?.display_mode ?? this.displayMode;
    this.zoomIndex = uiOptions?.zoom_index ?? this.zoomIndex;

    this.currentPage = 1;

    this.criteria = [];
    if (objectFilter) {
      for (const [k, v] of Object.entries(objectFilter)) {
        const criterion = this.makeCriterion(k as CriterionType);
        criterion.setFromSavedCriterion(v);
        this.criteria.push(criterion);
      }
    }
  }

  private setRandomSeed() {
    if (this.sortBy === "random") {
      // #321 - set the random seed if it is not set
      if (this.randomSeed === -1) {
        // generate 8-digit seed
        this.randomSeed = Math.floor(Math.random() * 10 ** 8);
      }
    } else {
      this.randomSeed = -1;
    }
  }

  private getSortBy(): string | undefined {
    this.setRandomSeed();

    if (this.sortBy === "random") {
      return `random_${this.randomSeed.toString()}`;
    }

    return this.sortBy;
  }

  // Returns query parameters with necessary parts URL-encoded
  public getEncodedParams(): IEncodedParams {
    const encodedCriteria: string[] = this.criteria.map((criterion) => {
      const queryParams = criterion.toQueryParams();
      let str = ListFilterModel.translateJSON(
        JSON.stringify(queryParams),
        false
      );

      // URL-encode other characters
      str = encodeURI(str);

      // only the reserved characters ?#&;=+ need to be URL-encoded
      // as they have special meaning in query strings
      str = str.replaceAll("?", encodeURIComponent("?"));
      str = str.replaceAll("#", encodeURIComponent("#"));
      str = str.replaceAll("&", encodeURIComponent("&"));
      str = str.replaceAll(";", encodeURIComponent(";"));
      str = str.replaceAll("=", encodeURIComponent("="));
      str = str.replaceAll("+", encodeURIComponent("+"));

      return str;
    });

    return {
      perPage:
        this.itemsPerPage !== DEFAULT_PARAMS.itemsPerPage
          ? String(this.itemsPerPage)
          : undefined,
      sortby: this.getSortBy(),
      sortdir:
        this.sortBy === "date"
          ? this.sortDirection === SortDirectionEnum.Asc
            ? "asc"
            : undefined
          : this.sortDirection === SortDirectionEnum.Desc
          ? "desc"
          : undefined,
      disp:
        this.displayMode !== DEFAULT_PARAMS.displayMode
          ? String(this.displayMode)
          : undefined,
      q: this.searchTerm ? encodeURIComponent(this.searchTerm) : undefined,
      p:
        this.currentPage !== DEFAULT_PARAMS.currentPage
          ? String(this.currentPage)
          : undefined,
      z:
        this.zoomIndex !== this.defaultZoomIndex
          ? String(this.zoomIndex)
          : undefined,
      c: encodedCriteria,
    };
  }

  public makeQueryParameters(): string {
    const query: string[] = [];
    const params = this.getEncodedParams();

    if (params.q) {
      query.push(`q=${params.q}`);
    }
    if (params.c) {
      for (const c of params.c) {
        query.push(`c=${c}`);
      }
    }
    if (params.sortby) {
      query.push(`sortby=${params.sortby}`);
    }
    if (params.sortdir) {
      query.push(`sortdir=${params.sortdir}`);
    }
    if (params.perPage) {
      query.push(`perPage=${params.perPage}`);
    }
    if (params.disp) {
      query.push(`disp=${params.disp}`);
    }
    if (params.z) {
      query.push(`z=${params.z}`);
    }
    if (params.p) {
      query.push(`p=${params.p}`);
    }

    return query.join("&");
  }

  /**
   * Map of old criterion type names to new type names for backwards compatibility.
   * When URLs or saved filters use old type names, they'll be migrated to new ones.
   */
  private static readonly TYPE_MIGRATIONS: Record<string, CriterionType> = {
    marker_giver: "marker_top" as CriterionType,
    marker_receiver: "marker_bottom" as CriterionType,
  };

  public makeCriterion(type: CriterionType) {
    const { criterionOptions } = getFilterOptions(this.mode);

    // Apply type migrations for backwards compatibility
    const migratedType = ListFilterModel.TYPE_MIGRATIONS[type] ?? type;

    const option = criterionOptions.find((o) => o.type === migratedType);

    if (!option) {
      throw new Error(`Unknown criterion parameter name: ${type}`);
    }

    return option.makeCriterion(this.config);
  }

  public makeFindFilter(): FindFilterType {
    return {
      q: this.searchTerm,
      page: this.currentPage,
      per_page: this.itemsPerPage,
      sort: this.getSortBy(),
      direction: this.sortDirection,
    };
  }

  public makeFilter() {
    const output: Record<string, unknown> = {};
    for (const c of this.criteria) {
      c.applyToCriterionInput(output);
    }

    // Aggregate marker-related criteria into scene_marker_tags structure
    this.aggregateMarkerCriteria(output);

    return output;
  }

  /**
   * Aggregates the new marker filter criteria (MarkerTagsCriterion, MarkerTopCriterion,
   * MarkerBottomCriterion, ExcludeMarkerTagsCriterion) into the scene_marker_tags
   * GraphQL input structure.
   */
  private aggregateMarkerCriteria(output: Record<string, unknown>): void {
    type MarkerTagData = {
      groupId: string;
      tags: string[];
      depth: number;
      performerMode: "AND" | "OR";
    };
    type MarkerTopData = {
      targetGroupId: string;
      performer_ids: string[];
      ethnicities: string[];
      countries: string[];
      rating: { modifier: string; value: number; value2?: number } | null;
    };
    type MarkerBottomData = MarkerTopData;
    type ExcludeData = {
      groupId: string;
      tags: string[];
      targetGroupId?: string;
    };

    const markerTags =
      (output._markerTagsCriteria as MarkerTagData[] | undefined) ?? [];
    const tops =
      (output._markerTopCriteria as MarkerTopData[] | undefined) ?? [];
    const bottoms =
      (output._markerBottomCriteria as MarkerTopData[] | undefined) ?? [];
    const excludes =
      (output._excludeMarkerTagsCriteria as ExcludeData[] | undefined) ?? [];
    
    // New scene marker filters (groups_extended format)
    type GroupExtended = {
      tag_ids: string[];
      depth?: number;
      top_performer_ids?: string[];
      top_any_count?: number;
      top_ethnicities?: string[];
      top_countries?: string[];
      top_rating?: { modifier: string; value: number; value2?: number };
      bottom_performer_ids?: string[];
      bottom_any_count?: number;
      bottom_ethnicities?: string[];
      bottom_countries?: string[];
      bottom_rating?: { modifier: string; value: number; value2?: number };
      performer_mode?: "AND" | "OR";
    };
    const includeGroups =
      (output._sceneMarkerIncludeCriteria as GroupExtended[] | undefined) ?? [];
    const excludeGroups =
      (output._sceneMarkerExcludeCriteria as GroupExtended[] | undefined) ?? [];
    const excludeModifier = output._sceneMarkerExcludeModifier as string | undefined;

    // Clean up temporary keys
    delete output._markerTagsCriteria;
    delete output._markerTopCriteria;
    delete output._markerBottomCriteria;
    delete output._excludeMarkerTagsCriteria;
    delete output._sceneMarkerIncludeCriteria;
    delete output._sceneMarkerExcludeCriteria;
    delete output._sceneMarkerExcludeModifier;

    // If there are no marker criteria, nothing to do
    if (markerTags.length === 0 && excludes.length === 0 && includeGroups.length === 0 && excludeGroups.length === 0) {
      return;
    }

    // Build extendedGroups by groupId
    type ExtendedGroup = {
      tag_ids: string[];
      exclude_tag_ids?: string[];
      depth?: number;
      top_performer_ids?: string[];
      top_any_count?: number;
      top_ethnicities?: string[];
      top_countries?: string[];
      top_rating?: { modifier: string; value: number; value2?: number };
      bottom_performer_ids?: string[];
      bottom_any_count?: number;
      bottom_ethnicities?: string[];
      bottom_countries?: string[];
      bottom_rating?: { modifier: string; value: number; value2?: number };
      performer_mode?: "AND" | "OR";
    };

    const groupsMap = new Map<string, ExtendedGroup>();

    // First, create groups from MarkerTagsCriterion - including performerMode
    for (const mt of markerTags) {
      groupsMap.set(mt.groupId, {
        tag_ids: mt.tags,
        depth: mt.depth !== 0 ? mt.depth : undefined,
        performer_mode: mt.performerMode, // Get mode from the tag group, not from Top/Bottom
      });
    }

    // Add Top data to matching groups
    for (const t of tops) {
      const group = groupsMap.get(t.targetGroupId);
      if (group) {
        if (t.performer_ids.length > 0)
          group.top_performer_ids = t.performer_ids;
        if (t.ethnicities.length > 0) group.top_ethnicities = t.ethnicities;
        if (t.countries.length > 0) group.top_countries = t.countries;
        if (t.rating) group.top_rating = t.rating;
        // Mode is already set from MarkerTagsCriterion
      }
    }

    // Add Bottom data to matching groups
    for (const b of bottoms) {
      const group = groupsMap.get(b.targetGroupId);
      if (group) {
        if (b.performer_ids.length > 0)
          group.bottom_performer_ids = b.performer_ids;
        if (b.ethnicities.length > 0) group.bottom_ethnicities = b.ethnicities;
        if (b.countries.length > 0) group.bottom_countries = b.countries;
        if (b.rating) group.bottom_rating = b.rating;
        // Mode is already set from MarkerTagsCriterion
      }
    }

    // Add Exclude data
    for (const e of excludes) {
      if (e.targetGroupId) {
        // Add to specific group
        const group = groupsMap.get(e.targetGroupId);
        if (group) {
          group.exclude_tag_ids = e.tags;
        }
      } else {
        // Global exclusion - add to all groups or create a separate exclusion group
        // For simplicity, add to first group or create a new one
        const firstGroup = groupsMap.values().next().value;
        if (firstGroup) {
          firstGroup.exclude_tag_ids = [
            ...(firstGroup.exclude_tag_ids ?? []),
            ...e.tags,
          ];
        }
      }
    }

    // Convert map to array for GraphQL
    const groups_extended = Array.from(groupsMap.values()).filter(
      (g) => g.tag_ids.length > 0 || (g.exclude_tag_ids?.length ?? 0) > 0
    );
    
    // Add new scene marker include groups
    groups_extended.push(...includeGroups);
    
    // Add new scene marker exclude groups
    // INCLUDES_ALL mode: merge all exclude tags into ONE group (require ALL to match before excluding)
    // INCLUDES mode: separate groups (exclude if ANY group matches)
    if (excludeGroups.length > 0) {
      if (excludeModifier === "INCLUDES_ALL") {
        // Merge all exclude group tags into a single exclude_tag_ids array
        // This creates a group that requires ALL tags to be present before excluding
        const allExcludeTags: string[] = [];
        for (const eg of excludeGroups) {
          allExcludeTags.push(...(eg.tag_ids as string[]));
        }
        groups_extended.push({
          tag_ids: [],
          exclude_tag_ids: allExcludeTags,
          performer_mode: "AND", // All exclude tags must be present
        });
      } else {
        // INCLUDES mode (OR): each exclude group is separate
        for (const eg of excludeGroups) {
          groups_extended.push({
            ...eg,
            tag_ids: [],
            exclude_tag_ids: eg.tag_ids,
          });
        }
      }
    }

    if (groups_extended.length > 0) {
      // Use EQUALS modifier by default (AND semantics between groups)
      output.scene_marker_tags = {
        modifier: "EQUALS",
        groups_extended,
      };
    }
  }

  // TODO - this needs to just use makeFilter, but it needs a migration
  public makeSavedFilter() {
    const output: Record<string, unknown> = {};
    for (const c of this.criteria) {
      c.applyToSavedCriterion(output);
    }
    return output;
  }

  public makeSavedUIOptions(): SavedUIOptions {
    return {
      display_mode: this.displayMode,
      zoom_index: this.zoomIndex,
    };
  }

  public criteriaFor(type: CriterionType) {
    return this.criteria.filter((c) => c.criterionOption.type === type);
  }

  public replaceCriteria(type: CriterionType, newCriteria: Criterion[]) {
    const criteria = [
      ...this.criteria.filter((c) => c.criterionOption.type !== type),
      ...newCriteria,
    ];

    return this.setCriteria(criteria);
  }

  public clearCriteria(clearSearchTerm = false) {
    const ret = this.clone();
    if (clearSearchTerm) {
      ret.searchTerm = "";
    }
    ret.criteria = [];
    ret.currentPage = 1;
    return ret;
  }

  public clearSearchTerm() {
    const ret = this.clone();
    ret.searchTerm = "";
    ret.currentPage = 1; // reset to first page
    return ret;
  }

  public setCriteria(criteria: Criterion[]) {
    const ret = this.clone();
    ret.criteria = criteria;
    return ret;
  }

  public removeCriterion(type: CriterionType) {
    const ret = this.clone();
    const c = ret.criteria.find((cc) => cc.criterionOption.type === type);

    if (!c) return ret;

    const newCriteria = ret.criteria.filter((cc) => {
      return cc.getId() !== c.getId();
    });

    ret.criteria = newCriteria;
    ret.currentPage = 1;
    return ret;
  }

  /**
   * Remove a criterion by its unique ID (from getId()).
   * Also handles cascade deletion for marker filter groups:
   * - When removing a MarkerTagsCriterion, also removes any Top/Bottom
   *   criteria since all groups are removed.
   */
  public removeCriterionById(criterionId: string) {
    const ret = this.clone();
    const c = ret.criteria.find((cc) => cc.getId() === criterionId);

    if (!c) return ret;

    let criteriaToRemove = new Set<string>([criterionId]);

    // Check if this is a MarkerTagsCriterion - if so, cascade delete all dependent criteria
    if (c instanceof MarkerTagsCriterion) {
      // Remove all Top/Bottom criteria since all groups are being removed
      ret.criteria.forEach((cc) => {
        if (
          cc instanceof MarkerTopCriterion ||
          cc instanceof MarkerBottomCriterion
        ) {
          criteriaToRemove.add(cc.getId());
        }
      });
    }

    const newCriteria = ret.criteria.filter((cc) => {
      return !criteriaToRemove.has(cc.getId());
    });

    ret.criteria = newCriteria;
    ret.currentPage = 1;
    return ret;
  }

  public removeCustomFieldCriterion(type: CriterionType, index: number) {
    const ret = this.clone();
    const c = ret.criteria.find((cc) => cc.criterionOption.type === type);

    if (!c) return ret;

    if (c instanceof CustomFieldsCriterion) {
      const newCriteria = c.value.filter((_, i) => i !== index);
      c.value = newCriteria;
    }

    return ret;
  }

  public setPageSize(pageSize: number) {
    const ret = this.clone();
    ret.itemsPerPage = pageSize;
    ret.currentPage = 1; // reset to first page
    return ret;
  }

  public setSortBy(sortBy: string | undefined) {
    const ret = this.clone();
    ret.sortBy = sortBy;
    ret.currentPage = 1; // reset to first page
    return ret;
  }

  public toggleSortDirection() {
    const ret = this.clone();

    if (ret.sortDirection === SortDirectionEnum.Asc) {
      ret.sortDirection = SortDirectionEnum.Desc;
    } else {
      ret.sortDirection = SortDirectionEnum.Asc;
    }

    ret.currentPage = 1; // reset to first page
    return ret;
  }

  public reshuffleRandomSort() {
    const ret = this.clone();
    ret.currentPage = 1;
    ret.randomSeed = -1;
    return ret;
  }

  public changePage(page: number) {
    const ret = this.clone();
    ret.currentPage = page;
    return ret;
  }

  public setZoom(zoomIndex: number) {
    const ret = this.clone();
    ret.zoomIndex = zoomIndex;
    return ret;
  }

  public setDisplayMode(displayMode: DisplayMode) {
    const ret = this.clone();
    ret.displayMode = displayMode;
    return ret;
  }
}

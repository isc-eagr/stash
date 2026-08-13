import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { ILabeledId, CriterionType } from "../types";
import { IntlShape } from "react-intl";
import { RatingCriterion } from "./tags";

/**
 * A single top performer filter entry.
 */
export interface IMarkerTopFilter {
  targetGroupId: string; // References a MarkerTagsCriterion's groupId
  performer_ids: ILabeledId[];
  ethnicities: string[];
  countries: string[];
  rating: RatingCriterion;
}

/**
 * The value for MarkerTopCriterion - contains multiple top filters.
 */
export interface IMarkerTopValue {
  filters: IMarkerTopFilter[];
}

export const MarkerTopCriterionOption: CriterionOption = new CriterionOption({
  messageID: "markers_filter.top",
  type: "marker_top" as CriterionType,
  makeCriterion: () => new MarkerTopCriterion(),
});

/**
 * MarkerTopCriterion - Filter by top performer attributes.
 * Contains multiple filters, each targeting a MarkerTagsCriterion group.
 * The AND/OR mode is on the MarkerTagsCriterion itself.
 */
export class MarkerTopCriterion extends Criterion {
  public value: IMarkerTopValue = {
    filters: [],
  };

  constructor(option?: CriterionOption) {
    super(option ?? MarkerTopCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      filters: this.value.filters.map((f) => ({
        targetGroupId: f.targetGroupId,
        performer_ids: f.performer_ids.map((p) => ({ ...p })),
        ethnicities: [...f.ethnicities],
        countries: [...f.countries],
        rating: f.rating ? { ...f.rating } : null,
      })),
    };
  }

  public getId(): string {
    return this.criterionOption.type;
  }

  /**
   * Add a new filter and return its index.
   */
  public addFilter(): number {
    this.value.filters.push({
      targetGroupId: "",
      performer_ids: [],
      ethnicities: [],
      countries: [],
      rating: null,
    });
    return this.value.filters.length - 1;
  }

  /**
   * Remove a filter by its index.
   */
  public removeFilter(index: number): void {
    this.value.filters = this.value.filters.filter((_, i) => i !== index);
  }

  /**
   * Get a filter by its index.
   */
  public getFilter(index: number): IMarkerTopFilter | undefined {
    return this.value.filters[index];
  }

  /**
   * Update a filter's properties.
   */
  public updateFilter(index: number, updates: Partial<IMarkerTopFilter>): void {
    const filter = this.getFilter(index);
    if (filter) {
      if (updates.targetGroupId !== undefined)
        filter.targetGroupId = updates.targetGroupId;
      if (updates.performer_ids !== undefined)
        filter.performer_ids = updates.performer_ids;
      if (updates.ethnicities !== undefined)
        filter.ethnicities = updates.ethnicities;
      if (updates.countries !== undefined) filter.countries = updates.countries;
      if (updates.rating !== undefined) filter.rating = updates.rating;
    }
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });

    if (this.value.filters.length === 0) {
      return `${criterion}: ${intl.formatMessage({ id: "none" })}`;
    }

    const filterLabels = this.value.filters.map((f) => {
      const groupLabel = f.targetGroupId || "?";
      const parts: string[] = [];
      if (f.performer_ids.length > 0)
        parts.push(f.performer_ids.map((p) => p.label).join(", "));
      if (f.ethnicities.length > 0) parts.push(f.ethnicities.join(", "));
      if (f.countries.length > 0) parts.push(f.countries.join(", "));
      return `${groupLabel}: ${parts.join(", ") || "..."}`;
    });

    return `${criterion}: ${filterLabels.join(" | ")}`;
  }

  public isValid(): boolean {
    // Valid if at least one filter has criteria
    return this.value.filters.some(
      (f) =>
        f.targetGroupId !== "" &&
        (f.performer_ids.length > 0 ||
          f.ethnicities.length > 0 ||
          f.countries.length > 0 ||
          f.rating !== null)
    );
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      filters: this.value.filters.map((f) => ({
        targetGroupId: f.targetGroupId,
        performer_ids: f.performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        ethnicities: f.ethnicities,
        countries: f.countries,
        rating: f.rating
          ? {
              modifier: f.rating.modifier,
              value: f.rating.value,
              value2: f.rating.value2,
            }
          : undefined,
      })),
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      filters?: Array<{
        targetGroupId: string;
        performer_ids: Array<{ id: string; label: string }>;
        ethnicities: string[];
        countries: string[];
        rating?: {
          modifier: CriterionModifier;
          value: number;
          value2?: number;
        };
      }>;
    };

    if (raw.filters) {
      this.value.filters = raw.filters.map((f) => ({
        targetGroupId: f.targetGroupId,
        performer_ids: f.performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        ethnicities: f.ethnicities,
        countries: f.countries,
        rating: f.rating
          ? {
              modifier: f.rating.modifier,
              value: f.rating.value,
              value2: f.rating.value2,
            }
          : null,
      }));
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // Store in a special key for aggregation
    if (!input._markerTopCriteria) {
      input._markerTopCriteria = [];
    }
    for (const f of this.value.filters) {
      (
        input._markerTopCriteria as Array<{
          targetGroupId: string;
          performer_ids: string[];
          ethnicities: string[];
          countries: string[];
          rating: RatingCriterion;
        }>
      ).push({
        targetGroupId: f.targetGroupId,
        performer_ids: f.performer_ids.map((p) => p.id),
        ethnicities: f.ethnicities,
        countries: f.countries,
        rating: f.rating,
      });
    }
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      filters: this.value.filters.map((f) => ({
        targetGroupId: f.targetGroupId,
        performer_ids: f.performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        ethnicities: f.ethnicities,
        countries: f.countries,
        rating: f.rating,
      })),
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as {
      filters?: Array<{
        targetGroupId: string;
        performer_ids: Array<{ id: string; label: string }>;
        ethnicities: string[];
        countries: string[];
        rating?: RatingCriterion;
      }>;
    };

    if (!data) return;

    if (data.filters) {
      this.value.filters = data.filters.map((f) => ({
        targetGroupId: f.targetGroupId,
        performer_ids: f.performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        ethnicities: f.ethnicities,
        countries: f.countries,
        rating: f.rating ?? null,
      }));
    }
  }
}

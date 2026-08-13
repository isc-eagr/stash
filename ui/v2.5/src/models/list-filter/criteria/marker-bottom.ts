import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption, ModifierCriterion } from "./criterion";
import { ILabeledId, CriterionType } from "../types";
import { IntlShape } from "react-intl";
import { RatingCriterion } from "./tags";

export interface IMarkerBottomFilter {
  targetGroupId: string; // References a MarkerTagsCriterion's groupId
  performer_ids: ILabeledId[];
  ethnicities: string[];
  countries: string[];
  rating: RatingCriterion;
}

export interface IMarkerBottomValue {
  filters: IMarkerBottomFilter[];
}

export const MarkerBottomCriterionOption: CriterionOption = new CriterionOption(
  {
    messageID: "markers_filter.bottom",
    type: "marker_bottom" as CriterionType,
    makeCriterion: () => new MarkerBottomCriterion(),
  }
);

/**
 * MarkerBottomCriterion - Filter by bottom performer attributes.
 * Must target an existing MarkerTagsCriterion group.
 * Holds multiple bottom performer filters.
 */
export class MarkerBottomCriterion extends Criterion {
  public value: IMarkerBottomValue = {
    filters: [],
  };

  constructor(option?: CriterionOption) {
    super(option ?? MarkerBottomCriterionOption);
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
    return `${this.criterionOption.type}`;
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

  public removeFilter(index: number): void {
    this.value.filters.splice(index, 1);
  }

  public getFilter(index: number): IMarkerBottomFilter | undefined {
    return this.value.filters[index];
  }

  public updateFilter(
    index: number,
    filter: Partial<IMarkerBottomFilter>
  ): void {
    const existing = this.value.filters[index];
    if (!existing) return;

    if (filter.targetGroupId !== undefined)
      existing.targetGroupId = filter.targetGroupId;
    if (filter.performer_ids !== undefined)
      existing.performer_ids = filter.performer_ids;
    if (filter.ethnicities !== undefined)
      existing.ethnicities = filter.ethnicities;
    if (filter.countries !== undefined) existing.countries = filter.countries;
    if (filter.rating !== undefined) existing.rating = filter.rating;
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });
    const count = this.value.filters.length;

    if (count === 0) {
      return criterion;
    } else if (count === 1) {
      const f = this.value.filters[0];
      const parts: string[] = [];

      if (f.performer_ids.length > 0) {
        parts.push(f.performer_ids.map((p) => p.label).join(", "));
      }
      if (f.ethnicities.length > 0) {
        parts.push(f.ethnicities.join(", "));
      }
      if (f.countries.length > 0) {
        parts.push(f.countries.join(", "));
      }
      if (f.rating) {
        const modLabel = ModifierCriterion.getModifierLabel(
          intl,
          f.rating.modifier
        );
        if (
          f.rating.modifier === CriterionModifier.Between ||
          f.rating.modifier === CriterionModifier.NotBetween
        ) {
          parts.push(`${modLabel} ${f.rating.value}-${f.rating.value2 ?? ""}`);
        } else {
          parts.push(`${modLabel} ${f.rating.value}★`);
        }
      }

      const valueString =
        parts.length > 0
          ? parts.join(", ")
          : intl.formatMessage({ id: "none" });
      return `${criterion}: ${valueString}`;
    } else {
      return `${criterion}: ${count} filters`;
    }
  }

  public isValid(): boolean {
    // Must have at least one filter
    if (this.value.filters.length === 0) return false;

    // Each filter must have a target group and at least one filter criterion
    return this.value.filters.every(
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
    if (!input._markerBottomCriteria) {
      input._markerBottomCriteria = [];
    }

    this.value.filters.forEach((f) => {
      (
        input._markerBottomCriteria as Array<{
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
    });
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    const key = this.getId();
    input[key] = {
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

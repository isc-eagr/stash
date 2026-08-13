import { CriterionModifier } from "src/core/generated-graphql";
import {
  Criterion,
  CriterionOption,
  ModifierCriterionOption,
} from "./criterion";
import { ILabeledId, CriterionType } from "../types";
import { IntlShape } from "react-intl";
import { RatingCriterion } from "./tags";

/**
 * A marker configuration for performer filtering (exclude variant).
 * Unlike scene markers, this has a single group with performer/partner sections.
 */
export interface IPerformerMarkersExcludeGroup {
  // Tags
  tag_ids: ILabeledId[];
  depth: number; // 0 = no sub-tags, -1 = all sub-tags
  // Performer criteria
  performer_ids: ILabeledId[];
  performer_ethnicities: string[];
  performer_countries: string[];
  performer_rating: RatingCriterion;
  performer_role: "any" | "top" | "bottom";
  // Partner criteria
  partner_ids: ILabeledId[];
  partner_ethnicities: string[];
  partner_countries: string[];
  partner_rating: RatingCriterion;
  partner_role: "any" | "top" | "bottom";
}

/**
 * The value for PerformerMarkersExcludeCriterion - single group only.
 */
export interface IPerformerMarkersExcludeValue {
  group: IPerformerMarkersExcludeGroup;
}

// Default empty group
function createEmptyGroup(): IPerformerMarkersExcludeGroup {
  return {
    tag_ids: [],
    depth: 0,
    performer_ids: [],
    performer_ethnicities: [],
    performer_countries: [],
    performer_rating: null,
    performer_role: "any",
    partner_ids: [],
    partner_ethnicities: [],
    partner_countries: [],
    partner_rating: null,
    partner_role: "any",
  };
}

const modifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
];

const defaultModifier = CriterionModifier.IncludesAll;

export const PerformerMarkersExcludeCriterionOption: ModifierCriterionOption =
  new ModifierCriterionOption({
    messageID: "performer_markers_exclude",
    type: "performer_markers_exclude" as CriterionType,
    modifierOptions,
    defaultModifier,
    makeCriterion: () => new PerformerMarkersExcludeCriterion(),
  });

/**
 * PerformerMarkersExcludeCriterion - A criterion for filtering performers by excluding markers.
 * Has a single group with performer/partner criteria, each with role dropdowns.
 * The modifier controls AND/OR logic: INCLUDES_ALL = both performer AND partner must match,
 * INCLUDES = either performer OR partner must match.
 */
export class PerformerMarkersExcludeCriterion extends Criterion {
  public modifier: CriterionModifier = defaultModifier;
  public value: IPerformerMarkersExcludeValue = {
    group: createEmptyGroup(),
  };

  constructor(option?: CriterionOption) {
    super(option ?? PerformerMarkersExcludeCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      group: {
        tag_ids: this.value.group.tag_ids.map((t) => ({ ...t })),
        depth: this.value.group.depth,
        performer_ids: this.value.group.performer_ids.map((p) => ({ ...p })),
        performer_ethnicities: [...this.value.group.performer_ethnicities],
        performer_countries: [...this.value.group.performer_countries],
        performer_rating: this.value.group.performer_rating
          ? { ...this.value.group.performer_rating }
          : null,
        performer_role: this.value.group.performer_role,
        partner_ids: this.value.group.partner_ids.map((p) => ({ ...p })),
        partner_ethnicities: [...this.value.group.partner_ethnicities],
        partner_countries: [...this.value.group.partner_countries],
        partner_rating: this.value.group.partner_rating
          ? { ...this.value.group.partner_rating }
          : null,
        partner_role: this.value.group.partner_role,
      },
    };
  }

  public getId(): string {
    return this.criterionOption.type;
  }

  /**
   * Update the group's properties.
   */
  public updateGroup(updates: Partial<IPerformerMarkersExcludeGroup>): void {
    Object.assign(this.value.group, updates);
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });

    const g = this.value.group;
    const parts: string[] = [];

    if (g.tag_ids.length > 0) {
      parts.push(g.tag_ids.map((t) => t.label).join(", "));
    }
    if (
      g.performer_ids.length > 0 ||
      g.performer_ethnicities.length > 0 ||
      g.performer_role !== "any"
    ) {
      parts.push("Performer: ...");
    }
    if (
      g.partner_ids.length > 0 ||
      g.partner_ethnicities.length > 0 ||
      g.partner_role !== "any"
    ) {
      parts.push("Partner: ...");
    }

    const modeLabel =
      this.modifier === CriterionModifier.IncludesAll ? "AND" : "OR";
    return `${criterion} (${modeLabel}): ${parts.join(" + ") || "..."}`;
  }

  public isValid(): boolean {
    const g = this.value.group;
    return (
      g.tag_ids.length > 0 ||
      g.performer_ids.length > 0 ||
      g.performer_ethnicities.length > 0 ||
      g.performer_countries.length > 0 ||
      g.performer_rating !== null ||
      g.performer_role !== "any" ||
      g.partner_ids.length > 0 ||
      g.partner_ethnicities.length > 0 ||
      g.partner_countries.length > 0 ||
      g.partner_rating !== null ||
      g.partner_role !== "any"
    );
  }

  protected encodeValue(): unknown {
    const g = this.value.group;
    return {
      group: {
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        performer_ids: g.performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        performer_ethnicities: g.performer_ethnicities,
        performer_countries: g.performer_countries,
        performer_rating: g.performer_rating,
        performer_role: g.performer_role,
        partner_ids: g.partner_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        partner_ethnicities: g.partner_ethnicities,
        partner_countries: g.partner_countries,
        partner_rating: g.partner_rating,
        partner_role: g.partner_role,
      },
    };
  }

  protected decodeValue(v: unknown): void {
    if (!v) return;

    const raw = v as {
      group?: {
        tag_ids: Array<{ id: string; label: string }>;
        depth: number;
        performer_ids: Array<{ id: string; label: string }>;
        performer_ethnicities: string[];
        performer_countries: string[];
        performer_rating: RatingCriterion;
        performer_role: "any" | "top" | "bottom";
        partner_ids: Array<{ id: string; label: string }>;
        partner_ethnicities: string[];
        partner_countries: string[];
        partner_rating: RatingCriterion;
        partner_role: "any" | "top" | "bottom";
      };
    };

    if (raw.group) {
      this.value.group = {
        tag_ids: raw.group.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        depth: raw.group.depth,
        performer_ids: raw.group.performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        performer_ethnicities: raw.group.performer_ethnicities,
        performer_countries: raw.group.performer_countries,
        performer_rating: raw.group.performer_rating,
        performer_role: raw.group.performer_role,
        partner_ids: raw.group.partner_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        partner_ethnicities: raw.group.partner_ethnicities,
        partner_countries: raw.group.partner_countries,
        partner_rating: raw.group.partner_rating,
        partner_role: raw.group.partner_role,
      };
    }
  }

  public toQueryParams(): Record<string, unknown> {
    const g = this.value.group;
    return {
      type: this.criterionOption.type,
      modifier: this.modifier,
      group: {
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        performer_ids: g.performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        performer_ethnicities: g.performer_ethnicities,
        performer_countries: g.performer_countries,
        performer_rating: g.performer_rating,
        performer_role: g.performer_role,
        partner_ids: g.partner_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        partner_ethnicities: g.partner_ethnicities,
        partner_countries: g.partner_countries,
        partner_rating: g.partner_rating,
        partner_role: g.partner_role,
      },
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      modifier?: CriterionModifier;
      group?: {
        tag_ids: Array<{ id: string; label: string }>;
        depth: number;
        performer_ids: Array<{ id: string; label: string }>;
        performer_ethnicities: string[];
        performer_countries: string[];
        performer_rating: RatingCriterion;
        performer_role: "any" | "top" | "bottom";
        partner_ids: Array<{ id: string; label: string }>;
        partner_ethnicities: string[];
        partner_countries: string[];
        partner_rating: RatingCriterion;
        partner_role: "any" | "top" | "bottom";
      };
    };

    if (raw.modifier) this.modifier = raw.modifier;
    if (raw.group) {
      this.value.group = {
        tag_ids: raw.group.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        depth: raw.group.depth,
        performer_ids: raw.group.performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        performer_ethnicities: raw.group.performer_ethnicities,
        performer_countries: raw.group.performer_countries,
        performer_rating: raw.group.performer_rating,
        performer_role: raw.group.performer_role,
        partner_ids: raw.group.partner_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        partner_ethnicities: raw.group.partner_ethnicities,
        partner_countries: raw.group.partner_countries,
        partner_rating: raw.group.partner_rating,
        partner_role: raw.group.partner_role,
      };
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    const g = this.value.group;

    // Build a single condition from our group
    const condition: Record<string, unknown> = {
      tag_ids: g.tag_ids.map((t) => t.id),
      depth: g.depth,
    };

    // Role (performer's role on the marker)
    if (g.performer_role !== "any") {
      condition.role = g.performer_role;
    }

    // Self attributes (the performer being filtered)
    if (g.performer_ids.length > 0) {
      // If specific performers are selected, we can't use ethnicity/country/rating filters
    } else {
      if (g.performer_ethnicities.length > 0) {
        condition.self_ethnicities = g.performer_ethnicities;
      }
      if (g.performer_countries.length > 0) {
        condition.self_countries = g.performer_countries;
      }
      if (g.performer_rating) {
        condition.self_rating = g.performer_rating;
      }
    }

    // Partner attributes
    if (g.partner_ids.length > 0) {
      condition.partner_performer_ids = g.partner_ids.map((p) => p.id);
    }
    if (g.partner_role !== "any") {
      condition.partner_role = g.partner_role;
    }
    if (g.partner_ethnicities.length > 0) {
      condition.partner_ethnicities = g.partner_ethnicities;
    }
    if (g.partner_countries.length > 0) {
      condition.partner_countries = g.partner_countries;
    }
    if (g.partner_rating) {
      condition.partner_rating = g.partner_rating;
    }

    // Use "performer_markers" GraphQL field but send as exclude array
    // If there's already a performer_markers value from include filter, merge with it
    const existing = input.performer_markers as
      | Record<string, unknown>
      | undefined;
    input.performer_markers = {
      ...existing,
      exclude: [condition],
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = this.toQueryParams();
  }

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    // savedCriterion is already the criterion data, not a wrapper
    if (savedCriterion) {
      this.fromDecodedParams(savedCriterion);
    }
  }
}

// Export modifierOptions for use in CriterionEditor
export const performerMarkersExcludeModifierOptions = modifierOptions;

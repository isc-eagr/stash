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
 * A marker configuration for performer filtering.
 * Unlike scene markers, this has a single group with performer/partner sections.
 */
export interface IPerformerMarkersGroup {
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
 * The value for PerformerMarkersCriterion - single group only.
 */
export interface IPerformerMarkersValue {
  group: IPerformerMarkersGroup;
}

// Default empty group
function createEmptyGroup(): IPerformerMarkersGroup {
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

const copyLabeledIds = (ids: ILabeledId[]): ILabeledId[] =>
  ids.map(({ id, label }) => ({ id, label }));

// Copies a group for the URL, a saved filter, or back from either one.
function copyGroup(g: IPerformerMarkersGroup): IPerformerMarkersGroup {
  return {
    tag_ids: copyLabeledIds(g.tag_ids),
    depth: g.depth,
    performer_ids: copyLabeledIds(g.performer_ids),
    performer_ethnicities: g.performer_ethnicities,
    performer_countries: g.performer_countries,
    performer_rating: g.performer_rating,
    performer_role: g.performer_role,
    partner_ids: copyLabeledIds(g.partner_ids),
    partner_ethnicities: g.partner_ethnicities,
    partner_countries: g.partner_countries,
    partner_rating: g.partner_rating,
    partner_role: g.partner_role,
  };
}

export const performerMarkersModifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
];

export const performerMarkersDefaultModifier = CriterionModifier.IncludesAll;

export const PerformerMarkersCriterionOption: ModifierCriterionOption =
  new ModifierCriterionOption({
    messageID: "performer_markers",
    type: "performer_markers" as CriterionType,
    modifierOptions: performerMarkersModifierOptions,
    defaultModifier: performerMarkersDefaultModifier,
    makeCriterion: () => new PerformerMarkersCriterion(),
  });

/**
 * Shared by the include and exclude performer marker criteria.
 * Has a single group with performer/partner criteria, each with role dropdowns.
 * The modifier controls AND/OR logic: INCLUDES_ALL = both performer AND partner must match,
 * INCLUDES = either performer OR partner must match.
 */
export abstract class PerformerMarkersCriterionBase extends Criterion {
  public modifier: CriterionModifier = performerMarkersDefaultModifier;
  public value: IPerformerMarkersValue = {
    group: createEmptyGroup(),
  };

  // Which side of the "performer_markers" GraphQL input this criterion fills.
  protected abstract readonly inputKey: "include" | "exclude";

  protected cloneValues() {
    const g = this.value.group;
    this.value = {
      group: {
        ...copyGroup(g),
        performer_ethnicities: [...g.performer_ethnicities],
        performer_countries: [...g.performer_countries],
        performer_rating: g.performer_rating ? { ...g.performer_rating } : null,
        partner_ethnicities: [...g.partner_ethnicities],
        partner_countries: [...g.partner_countries],
        partner_rating: g.partner_rating ? { ...g.partner_rating } : null,
      },
    };
  }

  public getId(): string {
    return this.criterionOption.type;
  }

  /**
   * Update the group's properties.
   */
  public updateGroup(updates: Partial<IPerformerMarkersGroup>): void {
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
      // CUSTOM: begin - consistent entity vocabulary.
      parts.push("Vato: ...");
      // CUSTOM: end
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
    return { group: copyGroup(this.value.group) };
  }

  protected decodeValue(v: unknown): void {
    if (!v) return;

    const raw = v as { group?: IPerformerMarkersGroup };
    if (raw.group) {
      this.value.group = copyGroup(raw.group);
    }
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      modifier: this.modifier,
      group: copyGroup(this.value.group),
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      modifier?: CriterionModifier;
      group?: IPerformerMarkersGroup;
    };

    if (raw.modifier) this.modifier = raw.modifier;
    if (raw.group) {
      this.value.group = copyGroup(raw.group);
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

    // Self attributes (the performer being filtered). Ethnicity, country and
    // rating are for anonymous filtering, so specific performers skip them.
    if (g.performer_ids.length === 0) {
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

    // Include and exclude share the "performer_markers" GraphQL field, so keep
    // whatever the other criterion already put there.
    const existing = input.performer_markers as
      | Record<string, unknown>
      | undefined;
    input.performer_markers = {
      ...existing,
      [this.inputKey]: [condition],
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

/**
 * PerformerMarkersCriterion - A criterion for filtering performers by their markers.
 */
export class PerformerMarkersCriterion extends PerformerMarkersCriterionBase {
  protected readonly inputKey = "include";

  constructor(option?: CriterionOption) {
    super(option ?? PerformerMarkersCriterionOption);
  }
}

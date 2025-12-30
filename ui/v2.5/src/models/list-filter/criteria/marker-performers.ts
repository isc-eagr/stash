import { CriterionModifier } from "src/core/generated-graphql";
import {
  Criterion,
  CriterionOption,
  ModifierCriterion,
  ModifierCriterionOption,
} from "./criterion";
import { ILabeledId } from "../types";
import { IntlShape } from "react-intl";
import { RatingCriterion } from "./tags";

// Value type for the marker performers criterion
export interface IMarkerPerformersValue {
  tag_ids: ILabeledId[]; // Tags for filtering markers
  include_subtags: boolean; // Include child tags (-1 depth when true)
  top_performer_ids: ILabeledId[];
  top_ethnicities: string[];
  top_countries: string[];
  top_rating: RatingCriterion;
  bottom_performer_ids: ILabeledId[];
  bottom_ethnicities: string[];
  bottom_countries: string[];
  bottom_rating: RatingCriterion;
}

const modifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
  CriterionModifier.Excludes,
  CriterionModifier.IsNull,
  CriterionModifier.NotNull,
];

const defaultModifier = CriterionModifier.IncludesAll;

export class MarkerPerformersCriterion extends Criterion {
  public modifier: CriterionModifier = defaultModifier;
  public value: IMarkerPerformersValue = {
    tag_ids: [],
    include_subtags: false,
    top_performer_ids: [],
    top_ethnicities: [],
    top_countries: [],
    top_rating: null,
    bottom_performer_ids: [],
    bottom_ethnicities: [],
    bottom_countries: [],
    bottom_rating: null,
  };

  constructor(option?: CriterionOption) {
    super(option ?? MarkerPerformersCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      tag_ids: this.value.tag_ids.map((t) => ({ ...t })),
      include_subtags: this.value.include_subtags,
      top_performer_ids: this.value.top_performer_ids.map((p) => ({ ...p })),
      top_ethnicities: [...this.value.top_ethnicities],
      top_countries: [...this.value.top_countries],
      top_rating: this.value.top_rating ? { ...this.value.top_rating } : null,
      bottom_performer_ids: this.value.bottom_performer_ids.map((p) => ({
        ...p,
      })),
      bottom_ethnicities: [...this.value.bottom_ethnicities],
      bottom_countries: [...this.value.bottom_countries],
      bottom_rating: this.value.bottom_rating
        ? { ...this.value.bottom_rating }
        : null,
    };
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });
    const modifierString = ModifierCriterion.getModifierLabel(
      intl,
      this.modifier
    );

    if (
      this.modifier === CriterionModifier.IsNull ||
      this.modifier === CriterionModifier.NotNull
    ) {
      return intl.formatMessage(
        { id: "criterion_modifier.format_string" },
        { criterion, modifierString, valueString: "" }
      );
    }

    const parts: string[] = [];
    if (this.value.tag_ids.length > 0) {
      const tagNames = this.value.tag_ids.map((t) => t.label).join(", ");
      const subtagsSuffix = this.value.include_subtags ? " (+subs)" : "";
      parts.push(`Tags: ${tagNames}${subtagsSuffix}`);
    }
    if (this.value.top_performer_ids.length > 0) {
      const topNames = this.value.top_performer_ids
        .map((p) => p.label)
        .join(", ");
      parts.push(`Top: ${topNames}`);
    }
    if (this.value.top_ethnicities.length > 0) {
      parts.push(`Top Eth: ${this.value.top_ethnicities.join(", ")}`);
    }
    if (this.value.top_countries.length > 0) {
      parts.push(`Top Country: ${this.value.top_countries.join(", ")}`);
    }
    if (this.value.bottom_performer_ids.length > 0) {
      const bottomNames = this.value.bottom_performer_ids
        .map((p) => p.label)
        .join(", ");
      parts.push(`Bottom: ${bottomNames}`);
    }
    if (this.value.bottom_ethnicities.length > 0) {
      parts.push(`Bottom Eth: ${this.value.bottom_ethnicities.join(", ")}`);
    }
    if (this.value.bottom_countries.length > 0) {
      parts.push(`Bottom Country: ${this.value.bottom_countries.join(", ")}`);
    }

    // Includes = OR, IncludesAll = AND
    const modeLabel =
      this.modifier === CriterionModifier.IncludesAll ? "AND" : "OR";
    let valueString = parts.join(` ${modeLabel} `);
    if (parts.length > 1) {
      valueString = `(${valueString})`;
    }

    return intl.formatMessage(
      { id: "criterion_modifier.format_string" },
      { criterion, modifierString, valueString }
    );
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      modifier: this.modifier,
      tag_ids: this.value.tag_ids.map((t) => ({
        id: t.id,
        label: t.label,
      })),
      include_subtags: this.value.include_subtags,
      top_performer_ids: this.value.top_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      top_ethnicities: this.value.top_ethnicities,
      top_countries: this.value.top_countries,
      top_rating: this.value.top_rating,
      bottom_performer_ids: this.value.bottom_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      bottom_ethnicities: this.value.bottom_ethnicities,
      bottom_countries: this.value.bottom_countries,
      bottom_rating: this.value.bottom_rating,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      modifier?: CriterionModifier;
      tag_ids?: Array<{ id: string; label: string }>;
      include_subtags?: boolean;
      top_performer_ids?: Array<{ id: string; label: string }>;
      top_ethnicities?: string[];
      top_countries?: string[];
      top_rating?: RatingCriterion;
      bottom_performer_ids?: Array<{ id: string; label: string }>;
      bottom_ethnicities?: string[];
      bottom_countries?: string[];
      bottom_rating?: RatingCriterion;
    };

    if (raw.modifier) this.modifier = raw.modifier;
    if (raw.tag_ids) {
      this.value.tag_ids = raw.tag_ids.map((t) => ({
        id: t.id,
        label: t.label,
      }));
    }
    if (raw.include_subtags !== undefined)
      this.value.include_subtags = raw.include_subtags;
    if (raw.top_performer_ids) {
      this.value.top_performer_ids = raw.top_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (raw.top_ethnicities) this.value.top_ethnicities = raw.top_ethnicities;
    if (raw.top_countries) this.value.top_countries = raw.top_countries;
    if (raw.top_rating) this.value.top_rating = raw.top_rating;
    if (raw.bottom_performer_ids) {
      this.value.bottom_performer_ids = raw.bottom_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (raw.bottom_ethnicities)
      this.value.bottom_ethnicities = raw.bottom_ethnicities;
    if (raw.bottom_countries)
      this.value.bottom_countries = raw.bottom_countries;
    if (raw.bottom_rating) this.value.bottom_rating = raw.bottom_rating;
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (
      this.modifier === CriterionModifier.IsNull ||
      this.modifier === CriterionModifier.NotNull
    ) {
      // Use marker_performers for simple IS_NULL/NOT_NULL
      input.marker_performers = {
        modifier: this.modifier,
      };
      return;
    }

    // Build a scene_marker_tags group with performer attributes
    // Performer mode controls how top and bottom criteria combine:
    // - INCLUDES: OR mode - either top OR bottom can match
    // - INCLUDES ALL: AND mode - both top AND bottom must match
    // - EXCLUDES: AND mode - exclude markers where all criteria match
    const performerMode =
      this.modifier === CriterionModifier.Includes ? "OR" : "AND";

    // The GraphQL groups_extended only works with EQUALS/NOT_EQUALS modifiers
    // - EXCLUDES uses NOT_EQUALS to exclude matching markers
    // - INCLUDES/INCLUDES_ALL use EQUALS to include matching markers
    const sceneMarkerTagsModifier =
      this.modifier === CriterionModifier.Excludes
        ? CriterionModifier.NotEquals
        : CriterionModifier.Equals;

    const group: Record<string, unknown> = {
      tag_ids: this.value.tag_ids.map((t) => t.id), // Use selected tags or empty for any
      performer_mode: performerMode,
    };

    // Add depth for subtags if enabled
    if (this.value.include_subtags) {
      group.depth = -1; // -1 means all descendants
    }

    // Add top performer attributes if any
    if (this.value.top_performer_ids.length > 0) {
      group.top_performer_ids = this.value.top_performer_ids.map((p) => p.id);
    }
    if (this.value.top_ethnicities.length > 0) {
      group.top_ethnicities = this.value.top_ethnicities;
    }
    if (this.value.top_countries.length > 0) {
      group.top_countries = this.value.top_countries;
    }
    if (this.value.top_rating) {
      group.top_rating = this.value.top_rating;
    }

    // Add bottom performer attributes if any
    if (this.value.bottom_performer_ids.length > 0) {
      group.bottom_performer_ids = this.value.bottom_performer_ids.map(
        (p) => p.id
      );
    }
    if (this.value.bottom_ethnicities.length > 0) {
      group.bottom_ethnicities = this.value.bottom_ethnicities;
    }
    if (this.value.bottom_countries.length > 0) {
      group.bottom_countries = this.value.bottom_countries;
    }
    if (this.value.bottom_rating) {
      group.bottom_rating = this.value.bottom_rating;
    }

    // Output to scene_marker_tags with a single group
    input.scene_marker_tags = {
      modifier: sceneMarkerTagsModifier,
      groups_extended: [group],
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    // Preserve full performer objects with labels for restoration
    input[this.criterionOption.type] = {
      tag_ids: this.value.tag_ids.map((t) => ({
        id: t.id,
        label: t.label,
      })),
      include_subtags: this.value.include_subtags,
      top_performer_ids: this.value.top_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      top_ethnicities: this.value.top_ethnicities,
      top_countries: this.value.top_countries,
      top_rating: this.value.top_rating,
      bottom_performer_ids: this.value.bottom_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      bottom_ethnicities: this.value.bottom_ethnicities,
      bottom_countries: this.value.bottom_countries,
      bottom_rating: this.value.bottom_rating,
      modifier: this.modifier,
    };
  }

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    const data = savedCriterion[this.criterionOption.type] as {
      tag_ids?: Array<{ id: string; label: string }>;
      include_subtags?: boolean;
      top_performer_ids?: Array<{ id: string; label: string }>;
      top_ethnicities?: string[];
      top_countries?: string[];
      top_rating?: RatingCriterion;
      bottom_performer_ids?: Array<{ id: string; label: string }>;
      bottom_ethnicities?: string[];
      bottom_countries?: string[];
      bottom_rating?: RatingCriterion;
      modifier?: CriterionModifier;
    };

    if (!data) return;

    if (data.modifier) this.modifier = data.modifier;
    if (data.tag_ids) {
      this.value.tag_ids = data.tag_ids.map((t) => ({
        id: t.id,
        label: t.label,
      }));
    }
    if (data.include_subtags !== undefined)
      this.value.include_subtags = data.include_subtags;
    if (data.top_performer_ids) {
      this.value.top_performer_ids = data.top_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (data.top_ethnicities) this.value.top_ethnicities = data.top_ethnicities;
    if (data.top_countries) this.value.top_countries = data.top_countries;
    if (data.top_rating) this.value.top_rating = data.top_rating;
    if (data.bottom_performer_ids) {
      this.value.bottom_performer_ids = data.bottom_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (data.bottom_ethnicities)
      this.value.bottom_ethnicities = data.bottom_ethnicities;
    if (data.bottom_countries)
      this.value.bottom_countries = data.bottom_countries;
    if (data.bottom_rating) this.value.bottom_rating = data.bottom_rating;
  }
}

export const MarkerPerformersCriterionOption: CriterionOption =
  new CriterionOption({
    messageID: "marker_performers",
    type: "marker_performers",
    makeCriterion: () => new MarkerPerformersCriterion(),
  });

// Also export modifierOptions for use in CriterionEditor
export const markerPerformersModifierOptions = modifierOptions;

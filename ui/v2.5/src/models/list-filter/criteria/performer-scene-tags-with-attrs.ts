import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption, ModifierCriterion } from "./criterion";
import { IntlShape } from "react-intl";
import { ILabeledId } from "../types";
import { getCountryByISO } from "src/utils/country";

export type PerformerSceneTagGroupUI = {
  tags?: ILabeledId[];
  performer_country?: string;
  performer_ethnicity?: string;
  performer_rating?: {
    modifier: CriterionModifier;
    value: number;
    value2?: number;
  } | null;
};

export class PerformerSceneTagsWithAttrsCriterion extends Criterion {
  public groups: PerformerSceneTagGroupUI[] = [];
  public matchAny = false;

  constructor(option: CriterionOption) {
    super(option);
  }

  public cloneValues() {
    this.groups = this.groups.map((g) => ({
      tags: g.tags ? g.tags.map((t) => ({ ...t })) : undefined,
      performer_country: g.performer_country,
      performer_ethnicity: g.performer_ethnicity,
      performer_rating: g.performer_rating
        ? {
            modifier: g.performer_rating.modifier,
            value: g.performer_rating.value,
            value2: g.performer_rating.value2,
          }
        : null,
    }));
    this.matchAny = !!this.matchAny;
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({ id: this.criterionOption.messageID });
    const modeLabel = this.matchAny ? "ANY" : "ALL";
    // Build a concise summary per group
    const valueString = this.groups
      .map((g) => {
        const parts: string[] = [];
        if (g.tags?.length) parts.push(g.tags.map((t) => t.label).join(", "));
        if (g.performer_country) {
          const countryName = getCountryByISO(g.performer_country, intl.locale) ?? g.performer_country;
          parts.push(`country=${countryName}`);
        }
        if (g.performer_ethnicity) parts.push(`ethnicity=${g.performer_ethnicity}`);
        if (g.performer_rating) {
          const mod = ModifierCriterion.getModifierLabel(intl, g.performer_rating.modifier);
          if (g.performer_rating.modifier === CriterionModifier.Between || g.performer_rating.modifier === CriterionModifier.NotBetween) {
            parts.push(`rating ${mod} ${g.performer_rating.value}..${g.performer_rating.value2 ?? ""}`);
          } else {
            parts.push(`rating ${mod} ${g.performer_rating.value}`);
          }
        }
        return `(${parts.join(" ")})`;
      })
      .join("; ");
    // Include match mode for clarity
    return `${criterion} [${modeLabel}]: ${valueString}`;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      match_any: this.matchAny || undefined,
      groups: this.groups.map((g) => ({
        tags: g.tags?.map((t) => ({ id: t.id, label: t.label })),
        performer_country: g.performer_country,
        performer_ethnicity: g.performer_ethnicity,
        performer_rating: g.performer_rating
          ? {
              modifier: g.performer_rating.modifier,
              value: g.performer_rating.value,
              value2: g.performer_rating.value2,
            }
          : undefined,
      })),
    };
  }

  public fromDecodedParams(i: Record<string, unknown>): void {
    try {
      const raw = i as { 
        match_any?: boolean; 
        groups?: Array<{ 
          tag_ids?: string[]; 
          tags?: Array<{ id: string; label: string }>; 
          performer_country?: string; 
          performer_ethnicity?: string; 
          performer_rating?: { modifier: CriterionModifier; value: number; value2?: number } 
        }>; 
      };
      this.matchAny = !!raw.match_any;
      this.groups = (raw.groups ?? []).map((g) => {
        // Handle both old format (tag_ids array) and new format (tags with id+label)
        let tags: ILabeledId[] | undefined;
        if (g.tags && Array.isArray(g.tags)) {
          tags = g.tags.map((t) => ({ id: t.id, label: t.label }));
        } else if (g.tag_ids && Array.isArray(g.tag_ids)) {
          // Legacy fallback: use ID as label
          tags = g.tag_ids.map((id) => ({ id, label: id }));
        }
        
        return {
          tags,
          performer_country: g.performer_country,
          performer_ethnicity: g.performer_ethnicity,
          performer_rating: g.performer_rating ?? null,
        };
      });
    } catch {
      // ignore
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      match_any: this.matchAny || undefined,
      groups: this.groups
        .filter((g) => (g.tags?.length ?? 0) > 0)
        .map((g) => ({
          tag_ids: g.tags!.map((t) => t.id),
          performer_country: g.performer_country || undefined,
          performer_ethnicity: g.performer_ethnicity || undefined,
          performer_rating: g.performer_rating
            ? {
                modifier: g.performer_rating.modifier,
                value: g.performer_rating.value,
                value2: g.performer_rating.value2,
              }
            : undefined,
        })),
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    this.applyToCriterionInput(input);
  }

  public setFromSavedCriterion(criterion: unknown): void {
    this.fromDecodedParams(criterion as Record<string, unknown>);
  }
}

export const PerformerSceneTagsWithAttrsCriterionOption = new CriterionOption({
  messageID: "performer_scene_tags_with_attrs",
  type: "performer_scene_tags_with_attrs",
  makeCriterion: (o) => new PerformerSceneTagsWithAttrsCriterion(o),
});

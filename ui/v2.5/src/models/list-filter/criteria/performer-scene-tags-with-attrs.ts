import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption, ModifierCriterion } from "./criterion";
import { IntlShape } from "react-intl";
import { ILabeledId } from "../types";

export type PerformerSceneTagGroupUI = {
  tag?: ILabeledId;
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
      tag: g.tag ? { ...g.tag } : undefined,
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
        if (g.tag?.label) parts.push(g.tag.label);
        if (g.performer_country) parts.push(`country=${g.performer_country}`);
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
        tag_id: g.tag?.id,
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
      const raw = i as { match_any?: boolean; groups?: Array<{ tag_id?: string; performer_country?: string; performer_ethnicity?: string; performer_rating?: { modifier: CriterionModifier; value: number; value2?: number } }>; };
      this.matchAny = !!raw.match_any;
      this.groups = (raw.groups ?? []).map((g) => ({
        tag: g.tag_id ? { id: g.tag_id, label: g.tag_id } : undefined,
        performer_country: g.performer_country,
        performer_ethnicity: g.performer_ethnicity,
        performer_rating: g.performer_rating ?? null,
      }));
    } catch {
      // ignore
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      match_any: this.matchAny || undefined,
      groups: this.groups
        .filter((g) => g.tag?.id)
        .map((g) => ({
          tag_id: g.tag!.id,
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

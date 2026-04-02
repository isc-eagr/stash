import { CriterionModifier } from "src/core/generated-graphql";
import {
  Criterion,
  CriterionOption,
  ModifierCriterionOption,
} from "./criterion";
import { IntlShape } from "react-intl";
import { ILabeledId } from "../types";

/**
 * Filter performers by markers they share with partners having specific attributes.
 * Similar UI to Markers: Top/Bottom in Scenes but for performers.
 */

const modifierOptions = [
  CriterionModifier.Includes,
  CriterionModifier.Excludes,
];

export interface IRatingValue {
  modifier: CriterionModifier;
  value: number;
  value2?: number;
}

export interface IPerformerMarkerPartnersValue {
  /** Partner performer IDs to match */
  partner_performer_ids: ILabeledId[];
  /** Partner ethnicities to match (OR) */
  partner_ethnicities: string[];
  /** Partner countries to match (OR) */
  partner_countries: string[];
  /** Partner rating criterion */
  partner_rating: IRatingValue | null;
  /** Partner's role: 'top', 'bottom', or 'any' */
  partner_role: "top" | "bottom" | "any";
}

export class PerformerMarkerPartnersCriterion extends Criterion {
  public modifier: CriterionModifier = CriterionModifier.Includes;
  public value: IPerformerMarkerPartnersValue = {
    partner_performer_ids: [],
    partner_ethnicities: [],
    partner_countries: [],
    partner_rating: null,
    partner_role: "any",
  };

  constructor(option?: CriterionOption) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    super(option ?? PerformerMarkerPartnersCriterionOption);
  }

  private cloneRating(r: IRatingValue | null): IRatingValue | null {
    return r
      ? { modifier: r.modifier, value: r.value, value2: r.value2 }
      : null;
  }

  protected cloneValues() {
    this.value = {
      partner_performer_ids: this.value.partner_performer_ids.map((p) => ({
        ...p,
      })),
      partner_ethnicities: [...this.value.partner_ethnicities],
      partner_countries: [...this.value.partner_countries],
      partner_rating: this.cloneRating(this.value.partner_rating),
      partner_role: this.value.partner_role,
    };
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });
    const modifierString = intl.formatMessage({
      id: `criterion_modifier.${this.modifier}`,
    });

    const parts: string[] = [];

    if (this.value.partner_performer_ids.length > 0) {
      parts.push(
        this.value.partner_performer_ids.map((p) => p.label).join(", ")
      );
    }

    if (this.value.partner_ethnicities.length > 0) {
      parts.push(`ethnicity: ${this.value.partner_ethnicities.join("/")}`);
    }

    if (this.value.partner_countries.length > 0) {
      parts.push(`country: ${this.value.partner_countries.join("/")}`);
    }

    if (this.value.partner_rating) {
      const ratingModStr = intl.formatMessage({
        id: `criterion_modifier.${this.value.partner_rating.modifier}`,
      });
      if (
        this.value.partner_rating.modifier === CriterionModifier.Between ||
        this.value.partner_rating.modifier === CriterionModifier.NotBetween
      ) {
        parts.push(
          `rating ${ratingModStr} ${this.value.partner_rating.value}..${
            this.value.partner_rating.value2 ?? ""
          }`
        );
      } else {
        parts.push(`rating ${ratingModStr} ${this.value.partner_rating.value}`);
      }
    }

    if (this.value.partner_role !== "any") {
      parts.push(`as ${this.value.partner_role}`);
    }

    const valueString = parts.join(", ");

    if (!valueString) {
      return criterion;
    }

    return intl.formatMessage(
      { id: "criterion_modifier.format_string" },
      { criterion, modifierString, valueString }
    );
  }

  private serializeRating(
    r: IRatingValue | null
  ):
    | { modifier: CriterionModifier; value: number; value2?: number }
    | undefined {
    return r
      ? { modifier: r.modifier, value: r.value, value2: r.value2 }
      : undefined;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      modifier: this.modifier,
      value: {
        partner_performer_ids:
          this.value.partner_performer_ids.length > 0
            ? this.value.partner_performer_ids.map((p) => ({
                id: p.id,
                label: p.label,
              }))
            : undefined,
        partner_ethnicities:
          this.value.partner_ethnicities.length > 0
            ? this.value.partner_ethnicities
            : undefined,
        partner_countries:
          this.value.partner_countries.length > 0
            ? this.value.partner_countries
            : undefined,
        partner_rating: this.serializeRating(this.value.partner_rating),
        partner_role: this.value.partner_role,
      },
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      modifier?: CriterionModifier;
      value?: {
        partner_performer_ids?: Array<{ id: string; label: string }>;
        partner_ethnicities?: string[];
        partner_countries?: string[];
        partner_rating?: {
          modifier: CriterionModifier;
          value: number;
          value2?: number;
        };
        partner_role?: "top" | "bottom" | "any";
      };
    };

    if (raw.modifier) {
      this.modifier = raw.modifier;
    }

    if (raw.value) {
      this.value = {
        partner_performer_ids:
          raw.value.partner_performer_ids?.map((p) => ({
            id: p.id,
            label: p.label,
          })) ?? [],
        partner_ethnicities: raw.value.partner_ethnicities ?? [],
        partner_countries: raw.value.partner_countries ?? [],
        partner_rating: raw.value.partner_rating ?? null,
        partner_role: raw.value.partner_role ?? "any",
      };
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // Only apply if we have at least one filter criterion
    if (
      this.value.partner_performer_ids.length === 0 &&
      this.value.partner_ethnicities.length === 0 &&
      this.value.partner_countries.length === 0 &&
      !this.value.partner_rating &&
      this.value.partner_role === "any"
    ) {
      return;
    }

    input[this.criterionOption.type] = {
      partner_performer_ids:
        this.value.partner_performer_ids.length > 0
          ? this.value.partner_performer_ids.map((p) => p.id)
          : undefined,
      partner_ethnicities:
        this.value.partner_ethnicities.length > 0
          ? this.value.partner_ethnicities
          : undefined,
      partner_countries:
        this.value.partner_countries.length > 0
          ? this.value.partner_countries
          : undefined,
      partner_rating: this.serializeRating(this.value.partner_rating),
      partner_role:
        this.value.partner_role !== "any" ? this.value.partner_role : undefined,
      modifier: this.modifier,
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = this.toQueryParams();
  }

  public setFromSavedCriterion(criterion: unknown): void {
    this.fromDecodedParams(criterion as Record<string, unknown>);
  }
}

export const PerformerMarkerPartnersCriterionOption =
  new ModifierCriterionOption({
    messageID: "performer_marker_partners",
    type: "performer_marker_partners",
    modifierOptions,
    defaultModifier: CriterionModifier.Includes,
    inputType: undefined,
    makeCriterion: () => new PerformerMarkerPartnersCriterion(),
  });

import { CriterionModifier } from "src/core/generated-graphql";
import {
  Criterion,
  CriterionOption,
  ModifierCriterionOption,
} from "./criterion";
import { ILabeledId } from "../types";
import { IntlShape } from "react-intl";

/**
 * Filter performers by markers with specific tags and the performer's role on those markers.
 * Similar to Tags filter but specifically for marker tags with role (top/bottom/any).
 */

const modifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
  CriterionModifier.Excludes,
  CriterionModifier.IsNull,
  CriterionModifier.NotNull,
];

export interface IPerformerMarkerTagsValue {
  /** Tag IDs to match */
  tag_ids: ILabeledId[];
  /** Role of the performer: 'top', 'bottom', or 'any' */
  role: "top" | "bottom" | "any";
  /** Depth for hierarchical tags */
  depth?: number;
}

export class PerformerMarkerTagsCriterion extends Criterion {
  public modifier: CriterionModifier = CriterionModifier.IncludesAll;
  public value: IPerformerMarkerTagsValue = {
    tag_ids: [],
    role: "any",
    depth: 0,
  };

  constructor(option?: CriterionOption) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    super(option ?? PerformerMarkerTagsCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      tag_ids: this.value.tag_ids.map((t) => ({ ...t })),
      role: this.value.role,
      depth: this.value.depth,
    };
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });

    if (
      this.modifier === CriterionModifier.IsNull ||
      this.modifier === CriterionModifier.NotNull
    ) {
      const modifierString = intl.formatMessage({
        id: `criterion_modifier.${this.modifier}`,
      });
      return `${criterion} ${modifierString}`;
    }

    const modifierString = intl.formatMessage({
      id: `criterion_modifier.${this.modifier}`,
    });

    const parts: string[] = [];

    if (this.value.tag_ids.length > 0) {
      const tagStr = this.value.tag_ids.map((t) => t.label).join(", ");
      if (this.value.depth != null && this.value.depth !== 0) {
        parts.push(`${tagStr} (+subs)`);
      } else {
        parts.push(tagStr);
      }
    }

    if (this.value.role !== "any") {
      parts.push(`as ${this.value.role}`);
    }

    const valueString = parts.join(" ");

    return intl.formatMessage(
      { id: "criterion_modifier.format_string" },
      { criterion, modifierString, valueString }
    );
  }

  public toQueryParams(): Record<string, unknown> {
    const base: Record<string, unknown> = {
      type: this.criterionOption.type,
      modifier: this.modifier,
    };

    if (
      this.modifier !== CriterionModifier.IsNull &&
      this.modifier !== CriterionModifier.NotNull
    ) {
      base.value = {
        tag_ids: this.value.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        role: this.value.role,
        depth: this.value.depth,
      };
    }

    return base;
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      modifier?: CriterionModifier;
      value?: {
        tag_ids?: Array<{ id: string; label: string }>;
        role?: "top" | "bottom" | "any";
        depth?: number;
      };
    };

    if (raw.modifier) {
      this.modifier = raw.modifier;
    }

    if (raw.value) {
      this.value = {
        tag_ids:
          raw.value.tag_ids?.map((t) => ({ id: t.id, label: t.label })) ?? [],
        role: raw.value.role ?? "any",
        depth: raw.value.depth ?? 0,
      };
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // Only apply if we have tags or a role specified
    if (
      this.value.tag_ids.length === 0 &&
      this.modifier !== CriterionModifier.IsNull &&
      this.modifier !== CriterionModifier.NotNull
    ) {
      return;
    }

    input[this.criterionOption.type] = {
      tag_ids: this.value.tag_ids.map((t) => t.id),
      role: this.value.role !== "any" ? this.value.role : undefined,
      depth: this.value.depth,
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

export const PerformerMarkerTagsCriterionOption = new ModifierCriterionOption({
  messageID: "performer_marker_tags",
  type: "performer_marker_tags",
  modifierOptions,
  defaultModifier: CriterionModifier.IncludesAll,
  inputType: "tags",
  makeCriterion: () => new PerformerMarkerTagsCriterion(),
});

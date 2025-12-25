import { CriterionModifier } from "src/core/generated-graphql";
import {
  Criterion,
  CriterionOption,
  ModifierCriterion,
  ModifierCriterionOption,
} from "./criterion";
import { ILabeledId } from "../types";
import { IntlShape } from "react-intl";

// Value type for the marker performers criterion
export interface IMarkerPerformersValue {
  giver_performer_ids: ILabeledId[];
  receiver_performer_ids: ILabeledId[];
  mode: "AND" | "OR";
}

const modifierOptions = [
  CriterionModifier.Includes,
  CriterionModifier.IncludesAll,
  CriterionModifier.Excludes,
  CriterionModifier.IsNull,
  CriterionModifier.NotNull,
];

const defaultModifier = CriterionModifier.Includes;

export class MarkerPerformersCriterion extends Criterion {
  public modifier: CriterionModifier = defaultModifier;
  public value: IMarkerPerformersValue = {
    giver_performer_ids: [],
    receiver_performer_ids: [],
    mode: "OR",
  };

  constructor(option?: CriterionOption) {
    super(option ?? MarkerPerformersCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      giver_performer_ids: this.value.giver_performer_ids.map((p) => ({ ...p })),
      receiver_performer_ids: this.value.receiver_performer_ids.map((p) => ({ ...p })),
      mode: this.value.mode,
    };
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({ id: this.criterionOption.messageID });
    const modifierString = ModifierCriterion.getModifierLabel(intl, this.modifier);

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
    if (this.value.giver_performer_ids.length > 0) {
      const giverNames = this.value.giver_performer_ids.map((p) => p.label).join(", ");
      parts.push(`Giver: ${giverNames}`);
    }
    if (this.value.receiver_performer_ids.length > 0) {
      const receiverNames = this.value.receiver_performer_ids.map((p) => p.label).join(", ");
      parts.push(`Receiver: ${receiverNames}`);
    }

    let valueString = parts.join(` ${this.value.mode} `);
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
      giver_performer_ids: this.value.giver_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      receiver_performer_ids: this.value.receiver_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      mode: this.value.mode,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      modifier?: CriterionModifier;
      giver_performer_ids?: Array<{ id: string; label: string }>;
      receiver_performer_ids?: Array<{ id: string; label: string }>;
      mode?: "AND" | "OR";
    };

    if (raw.modifier) this.modifier = raw.modifier;
    if (raw.giver_performer_ids) {
      this.value.giver_performer_ids = raw.giver_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (raw.receiver_performer_ids) {
      this.value.receiver_performer_ids = raw.receiver_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (raw.mode) {
      this.value.mode = raw.mode;
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (
      this.modifier === CriterionModifier.IsNull ||
      this.modifier === CriterionModifier.NotNull
    ) {
      input[this.criterionOption.type] = {
        modifier: this.modifier,
      };
      return;
    }

    input[this.criterionOption.type] = {
      giver_performer_ids: this.value.giver_performer_ids.map((p) => p.id),
      receiver_performer_ids: this.value.receiver_performer_ids.map((p) => p.id),
      mode: this.value.mode,
      modifier: this.modifier,
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    // Preserve full performer objects with labels for restoration
    input[this.criterionOption.type] = {
      giver_performer_ids: this.value.giver_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      receiver_performer_ids: this.value.receiver_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      mode: this.value.mode,
      modifier: this.modifier,
    };
  }

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    const data = savedCriterion[this.criterionOption.type] as {
      giver_performer_ids?: Array<{ id: string; label: string }>;
      receiver_performer_ids?: Array<{ id: string; label: string }>;
      mode?: "AND" | "OR";
      modifier?: CriterionModifier;
    };

    if (!data) return;

    if (data.modifier) this.modifier = data.modifier;
    if (data.giver_performer_ids) {
      this.value.giver_performer_ids = data.giver_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (data.receiver_performer_ids) {
      this.value.receiver_performer_ids = data.receiver_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (data.mode) {
      this.value.mode = data.mode;
    }
  }
}

export const MarkerPerformersCriterionOption: CriterionOption = new CriterionOption({
  messageID: "marker_performers",
  type: "marker_performers",
  makeCriterion: () => new MarkerPerformersCriterion(),
});

// Also export modifierOptions for use in CriterionEditor
export const markerPerformersModifierOptions = modifierOptions;

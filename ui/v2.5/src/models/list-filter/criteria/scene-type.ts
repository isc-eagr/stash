import { ConfigDataFragment } from "src/core/generated-graphql";
import { IUIConfig } from "src/core/config";
import { Criterion, CriterionOption } from "./criterion";
import { CriterionType } from "../types";
import { IntlShape } from "react-intl";

// Helper to safely access roleTagIds from config
function getRoleTagIds(config?: ConfigDataFragment): IUIConfig["roleTagIds"] {
  const ui = config?.ui as IUIConfig | undefined;
  return ui?.roleTagIds ?? {};
}

// Primary options (mutually exclusive on scenes page, independent on performers)
const primaryOptions = ["sex", "oral", "solo"] as const;
// Secondary options (can be combined with any primary)
const secondaryOptions = ["facial"] as const;
const allOptions = [...primaryOptions, ...secondaryOptions] as const;

export type SceneTypeOption = (typeof allOptions)[number];

// ===================== Scene Scene Type Criterion =====================

export const SceneSceneTypeCriterionOption = new CriterionOption({
  messageID: "scene_type",
  type: "scene_type" as CriterionType,
  makeCriterion: (o, config) => new SceneSceneTypeCriterion(config),
});

export class SceneSceneTypeCriterion extends Criterion {
  public value: string[] = [];
  private roleTagIds: IUIConfig["roleTagIds"];

  public static readonly primaryOptions = [...primaryOptions];
  public static readonly secondaryOptions = [...secondaryOptions];
  public static readonly allOptions = [...allOptions];

  constructor(config?: ConfigDataFragment) {
    super(SceneSceneTypeCriterionOption);
    this.roleTagIds = getRoleTagIds(config);
  }

  protected cloneValues() {
    this.value = [...this.value];
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });
    const valueLabels = this.value
      .map((v) => intl.formatMessage({ id: `scene_type.${v}` }))
      .join(", ");
    return `${criterion}: ${valueLabels}`;
  }

  public isValid(): boolean {
    if (this.value.length === 0) return false;
    // At most one primary option
    const selectedPrimaries = this.value.filter((v) =>
      SceneSceneTypeCriterion.primaryOptions.some((option) => option === v)
    );
    return selectedPrimaries.length <= 1;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      value: this.value,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as { value?: string[] };
    if (raw.value && Array.isArray(raw.value)) {
      this.value = raw.value;
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (this.value.length === 0) return;

    input.scene_type = {
      types: this.value,
      sex_tag_id: this.roleTagIds?.sexTagId ?? null,
      oral_tag_id: this.roleTagIds?.oralTagId ?? null,
      solo_tag_id: this.roleTagIds?.soloTagId ?? null,
      facial_tag_id: this.roleTagIds?.facialTagId ?? null,
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      value: this.value,
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as { value?: string[] };
    if (data?.value && Array.isArray(data.value)) {
      this.value = data.value;
    }
  }
}

// ===================== Performer Scene Type Criterion =====================

export const PerformerSceneTypeCriterionOption = new CriterionOption({
  messageID: "scene_type",
  type: "scene_type" as CriterionType,
  makeCriterion: (o, config) => new PerformerSceneTypeCriterion(config),
});

export class PerformerSceneTypeCriterion extends Criterion {
  public value: string[] = [];
  private roleTagIds: IUIConfig["roleTagIds"];

  public static readonly allOptions = [...allOptions];

  constructor(config?: ConfigDataFragment) {
    super(PerformerSceneTypeCriterionOption);
    this.roleTagIds = getRoleTagIds(config);
  }

  protected cloneValues() {
    this.value = [...this.value];
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });
    const valueLabels = this.value
      .map((v) => intl.formatMessage({ id: `scene_type.${v}` }))
      .join(", ");
    return `${criterion}: ${valueLabels}`;
  }

  public isValid(): boolean {
    return this.value.length > 0;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      value: this.value,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as { value?: string[] };
    if (raw.value && Array.isArray(raw.value)) {
      this.value = raw.value;
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (this.value.length === 0) return;

    input.scene_type = {
      types: this.value,
      sex_tag_id: this.roleTagIds?.sexTagId ?? null,
      oral_tag_id: this.roleTagIds?.oralTagId ?? null,
      solo_tag_id: this.roleTagIds?.soloTagId ?? null,
      facial_tag_id: this.roleTagIds?.facialTagId ?? null,
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      value: this.value,
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as { value?: string[] };
    if (data?.value && Array.isArray(data.value)) {
      this.value = data.value;
    }
  }
}

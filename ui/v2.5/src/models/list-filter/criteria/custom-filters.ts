import {
  ConfigDataFragment,
} from "src/core/generated-graphql";
import { IUIConfig } from "src/core/config";
import {
  Criterion,
  CriterionOption,
} from "./criterion";
import { CriterionType } from "../types";
import { IntlShape } from "react-intl";

// Helper to safely access roleTagIds from config
function getRoleTagIds(config?: ConfigDataFragment): IUIConfig['roleTagIds'] {
  const ui = config?.ui as IUIConfig | undefined;
  return ui?.roleTagIds ?? {};
}

// Scene Custom Filters
export const SceneCustomFiltersCriterionOption = new CriterionOption({
  messageID: "custom_filters",
  type: "custom_filters" as CriterionType,
  makeCriterion: (o, config) => new SceneCustomFiltersCriterion(config),
});

export class SceneCustomFiltersCriterion extends Criterion {
  public value: string = "";
  private roleTagIds: IUIConfig['roleTagIds'];
  public static readonly options = ["versatile_scenes", "circular_oral"];

  constructor(config?: ConfigDataFragment) {
    super(SceneCustomFiltersCriterionOption);
    this.roleTagIds = getRoleTagIds(config);
  }

  protected cloneValues() {
    // value is a primitive string, no deep clone needed
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });
    const valueLabel = this.value
      ? intl.formatMessage({ id: `custom_filters.${this.value}` })
      : "";
    return `${criterion}: ${valueLabel}`;
  }

  public isValid(): boolean {
    return SceneCustomFiltersCriterion.options.includes(this.value);
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      value: this.value,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as { value?: string };
    if (raw.value) {
      this.value = raw.value;
    }
  }

  // Override to output the structured object with tag IDs
  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (!this.value) return;

    input.custom_filters = {
      type: this.value,
      sex_tag_id: this.roleTagIds?.sexTagId ?? null,
      orgasm_tag_id: this.roleTagIds?.orgasmTagId ?? null,
      oral_tag_id: this.roleTagIds?.oralTagId ?? null,
      facial_tag_id: this.roleTagIds?.facialTagId ?? null,
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      value: this.value,
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as { value?: string };
    if (data?.value) {
      this.value = data.value;
    }
  }
}

// Scene Marker Custom Filters
export const SceneMarkerCustomFiltersCriterionOption = new CriterionOption({
  messageID: "custom_filters",
  type: "custom_filters" as CriterionType,
  makeCriterion: (o, config) => new SceneMarkerCustomFiltersCriterion(config),
});

export class SceneMarkerCustomFiltersCriterion extends Criterion {
  public value: string = "";
  private roleTagIds: IUIConfig['roleTagIds'];
  public static readonly options = ["circular_oral"];

  constructor(config?: ConfigDataFragment) {
    super(SceneMarkerCustomFiltersCriterionOption);
    this.roleTagIds = getRoleTagIds(config);
  }

  protected cloneValues() {
    // value is a primitive string, no deep clone needed
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });
    const valueLabel = this.value
      ? intl.formatMessage({ id: `custom_filters.${this.value}` })
      : "";
    return `${criterion}: ${valueLabel}`;
  }

  public isValid(): boolean {
    return SceneMarkerCustomFiltersCriterion.options.includes(this.value);
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      value: this.value,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as { value?: string };
    if (raw.value) {
      this.value = raw.value;
    }
  }

  // Override to output the structured object with tag IDs
  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (!this.value) return;

    input.custom_filters = {
      type: this.value,
      oral_tag_id: this.roleTagIds?.oralTagId ?? null,
      orgasm_tag_id: this.roleTagIds?.orgasmTagId ?? null,
      facial_tag_id: this.roleTagIds?.facialTagId ?? null,
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      value: this.value,
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as { value?: string };
    if (data?.value) {
      this.value = data.value;
    }
  }
}

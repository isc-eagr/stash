import { Criterion, CriterionOption } from "./criterion";
import { ILabeledId, CriterionType } from "../types";
import { IntlShape } from "react-intl";
import { generateGroupId } from "./marker-tags";

export interface IExcludeMarkerTagsValue {
  tags: ILabeledId[];
  targetGroupId?: string; // Optional: if set, excludes only from that group; if not, global exclusion
}

export const ExcludeMarkerTagsCriterionOption: CriterionOption =
  new CriterionOption({
    messageID: "markers_filter.exclude_tags",
    type: "exclude_marker_tags" as CriterionType,
    makeCriterion: () => new ExcludeMarkerTagsCriterion(),
  });

/**
 * ExcludeMarkerTagsCriterion - Exclude scenes that have markers with these tags.
 * Can be global (no targetGroupId) or group-specific.
 */
export class ExcludeMarkerTagsCriterion extends Criterion {
  public groupId: string; // Own ID for this exclusion criterion
  public value: IExcludeMarkerTagsValue = {
    tags: [],
    targetGroupId: undefined,
  };

  constructor(option?: CriterionOption, groupId?: string) {
    super(option ?? ExcludeMarkerTagsCriterionOption);
    this.groupId = groupId ?? generateGroupId();
  }

  protected cloneValues() {
    this.value = {
      tags: this.value.tags.map((t) => ({ ...t })),
      targetGroupId: this.value.targetGroupId,
    };
  }

  public getId(): string {
    return `${this.criterionOption.type}-${this.groupId}`;
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });

    if (this.value.tags.length === 0) {
      return `❌ ${criterion}: ${intl.formatMessage({ id: "none" })}`;
    }

    const tagNames = this.value.tags.map((t) => t.label).join(", ");
    const groupSuffix = this.value.targetGroupId
      ? ` (from ${this.value.targetGroupId})`
      : "";

    return `❌ ${criterion}: ${tagNames}${groupSuffix}`;
  }

  public isValid(): boolean {
    return this.value.tags.length > 0;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      groupId: this.groupId,
      tags: this.value.tags.map((t) => ({ id: t.id, label: t.label })),
      targetGroupId: this.value.targetGroupId,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      groupId?: string;
      tags?: Array<{ id: string; label: string }>;
      targetGroupId?: string;
    };

    if (raw.groupId) this.groupId = raw.groupId;
    if (raw.tags) {
      this.value.tags = raw.tags.map((t) => ({ id: t.id, label: t.label }));
    }
    if (raw.targetGroupId !== undefined) {
      this.value.targetGroupId = raw.targetGroupId;
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // Store in a special key for aggregation
    if (!input._excludeMarkerTagsCriteria) {
      input._excludeMarkerTagsCriteria = [];
    }
    (
      input._excludeMarkerTagsCriteria as Array<{
        groupId: string;
        tags: string[];
        targetGroupId?: string;
      }>
    ).push({
      groupId: this.groupId,
      tags: this.value.tags.map((t) => t.id),
      targetGroupId: this.value.targetGroupId,
    });
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    const key = this.getId();
    input[key] = {
      groupId: this.groupId,
      tags: this.value.tags.map((t) => ({ id: t.id, label: t.label })),
      targetGroupId: this.value.targetGroupId,
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as {
      groupId?: string;
      tags?: Array<{ id: string; label: string }>;
      targetGroupId?: string;
    };

    if (!data) return;

    if (data.groupId) this.groupId = data.groupId;
    if (data.tags) {
      this.value.tags = data.tags.map((t) => ({ id: t.id, label: t.label }));
    }
    if (data.targetGroupId !== undefined) {
      this.value.targetGroupId = data.targetGroupId;
    }
  }
}

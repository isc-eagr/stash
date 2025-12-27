import { Criterion, CriterionOption } from "./criterion";
import { ILabeledId, CriterionType } from "../types";
import { IntlShape } from "react-intl";

// Generate a simple alphanumeric group ID (A, B, C, ...)
let groupIdCounter = 0;
export function generateGroupId(): string {
  const id = String.fromCharCode(65 + (groupIdCounter % 26)); // A-Z
  groupIdCounter++;
  return id;
}

export function resetGroupIdCounter(): void {
  groupIdCounter = 0;
}

/**
 * A single marker tag group within the criterion.
 */
export interface IMarkerTagGroup {
  groupId: string;
  tags: ILabeledId[];
  depth: number; // 0 = no sub-tags, -1 = all sub-tags
  performerMode: "AND" | "OR"; // How to combine Top + Bottom for this group
}

/**
 * The value for MarkerTagsCriterion - contains multiple groups.
 */
export interface IMarkerTagsValue {
  groups: IMarkerTagGroup[];
}

/**
 * MarkerTagsCriterion - A criterion for selecting marker tags.
 * Contains multiple groups, each with its own tags and settings.
 * Top/Bottom criteria can target specific groups by groupId.
 */
export class MarkerTagsCriterion extends Criterion {
  public value: IMarkerTagsValue = {
    groups: [],
  };

  constructor(option?: CriterionOption) {
    super(option ?? MarkerTagsCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      groups: this.value.groups.map((g) => ({
        groupId: g.groupId,
        tags: g.tags.map((t) => ({ ...t })),
        depth: g.depth,
        performerMode: g.performerMode,
      })),
    };
  }

  public getId(): string {
    return this.criterionOption.type;
  }

  /**
   * Add a new group and return its ID.
   */
  public addGroup(): string {
    const groupId = generateGroupId();
    this.value.groups.push({
      groupId,
      tags: [],
      depth: 0,
      performerMode: "AND",
    });
    return groupId;
  }

  /**
   * Remove a group by its ID.
   */
  public removeGroup(groupId: string): void {
    this.value.groups = this.value.groups.filter((g) => g.groupId !== groupId);
  }

  /**
   * Get a group by its ID.
   */
  public getGroup(groupId: string): IMarkerTagGroup | undefined {
    return this.value.groups.find((g) => g.groupId === groupId);
  }

  /**
   * Update a group's properties.
   */
  public updateGroup(
    groupId: string,
    updates: Partial<Omit<IMarkerTagGroup, "groupId">>
  ): void {
    const group = this.getGroup(groupId);
    if (group) {
      if (updates.tags !== undefined) group.tags = updates.tags;
      if (updates.depth !== undefined) group.depth = updates.depth;
      if (updates.performerMode !== undefined)
        group.performerMode = updates.performerMode;
    }
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });

    if (this.value.groups.length === 0) {
      return `${criterion}: ${intl.formatMessage({ id: "none" })}`;
    }

    const groupLabels = this.value.groups.map((g) => {
      const tagNames = g.tags.map((t) => t.label).join(", ");
      return `${g.groupId}: ${tagNames || "..."}`;
    });

    return `${criterion}: ${groupLabels.join(" | ")}`;
  }

  public isValid(): boolean {
    // Valid if at least one group has tags
    return this.value.groups.some((g) => g.tags.length > 0);
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      groups: this.value.groups.map((g) => ({
        groupId: g.groupId,
        tags: g.tags.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        performerMode: g.performerMode,
      })),
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      groups?: Array<{
        groupId: string;
        tags: Array<{ id: string; label: string }>;
        depth: number;
        performerMode: "AND" | "OR";
      }>;
    };

    if (raw.groups) {
      this.value.groups = raw.groups.map((g) => ({
        groupId: g.groupId,
        tags: g.tags.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        performerMode: g.performerMode,
      }));
      // Update counter to avoid ID collisions
      const maxChar = Math.max(
        ...this.value.groups.map((g) => g.groupId.charCodeAt(0))
      );
      if (maxChar >= 65) {
        groupIdCounter = maxChar - 64; // A=1, B=2, etc.
      }
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // Store groups for aggregation
    if (!input._markerTagsCriteria) {
      input._markerTagsCriteria = [];
    }
    for (const g of this.value.groups) {
      (
        input._markerTagsCriteria as Array<{
          groupId: string;
          tags: string[];
          depth: number;
          performerMode: string;
        }>
      ).push({
        groupId: g.groupId,
        tags: g.tags.map((t) => t.id),
        depth: g.depth,
        performerMode: g.performerMode,
      });
    }
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      groups: this.value.groups.map((g) => ({
        groupId: g.groupId,
        tags: g.tags.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        performerMode: g.performerMode,
      })),
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as {
      groups?: Array<{
        groupId: string;
        tags: Array<{ id: string; label: string }>;
        depth: number;
        performerMode: "AND" | "OR";
      }>;
    };

    if (!data) return;

    if (data.groups) {
      this.value.groups = data.groups.map((g) => ({
        groupId: g.groupId,
        tags: g.tags.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        performerMode: g.performerMode,
      }));
      // Update counter to avoid ID collisions
      const maxChar = Math.max(
        ...this.value.groups.map((g) => g.groupId.charCodeAt(0)),
        64
      );
      groupIdCounter = maxChar - 64;
    }
  }
}

export const MarkerTagsCriterionOption: CriterionOption = new CriterionOption({
  messageID: "markers_filter.tags",
  type: "marker_tags" as CriterionType,
  makeCriterion: () => new MarkerTagsCriterion(),
});

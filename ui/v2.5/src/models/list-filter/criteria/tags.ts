import { CriterionModifier } from "src/core/generated-graphql";
import {
  ModifierCriterionOption,
  IHierarchicalLabeledIdCriterion,
  Criterion,
  CriterionOption,
  ModifierCriterion,
} from "./criterion";
import { IntlShape } from "react-intl";
import { CriterionType } from "../types";
import { ILabeledId } from "../types";

const defaultModifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
  CriterionModifier.Equals,
  CriterionModifier.IsNull,
  CriterionModifier.NotNull,
];

const withoutEqualsModifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
  CriterionModifier.IsNull,
  CriterionModifier.NotNull,
];

const defaultModifier = CriterionModifier.IncludesAll;
const inputType = "tags";

class BaseTagsCriterionOption extends ModifierCriterionOption {
  constructor(
    messageID: string,
    type: CriterionType,
    modifierOptions: CriterionModifier[]
  ) {
    super({
      messageID,
      type,
      modifierOptions,
      defaultModifier,
      inputType,
      makeCriterion: () => new TagsCriterion(this),
    });
  }
}

export const TagsCriterionOption = new BaseTagsCriterionOption(
  "tags",
  "tags",
  defaultModifierOptions
);

export const SceneTagsCriterionOption = new BaseTagsCriterionOption(
  "scene_tags",
  "scene_tags",
  defaultModifierOptions
);

export const PerformerTagsCriterionOption = new BaseTagsCriterionOption(
  "performer_tags",
  "performer_tags",
  withoutEqualsModifierOptions
);

export const PerformerSceneTagsCriterionOption = new BaseTagsCriterionOption(
  "performer_scene_tags",
  "performer_scene_tags",
  withoutEqualsModifierOptions
);

export const MarkerTagsCriterionOption = new BaseTagsCriterionOption(
  "marker_tags",
  "marker_tags",
  defaultModifierOptions
);

// Criterion option for the compact performer+tag pair input
export const PerformerSceneTagPairCriterionOption = new CriterionOption({
  messageID: "performer_scene_tag_pair",
  type: "performer_scene_tag_pair",
  hidden: true,
  makeCriterion: () => new PerformerSceneTagsPairCriterion("", ""),
});

// Scene Marker Tags use grouped semantics for EQUALS (IS). Allow EQUALS here.
// Supports extended groups with performer attributes (IDs, countries, ethnicities, rating)
export type SceneMarkerTagGroupUI = {
  tags?: ILabeledId[];
  performer_ids?: ILabeledId[];
  performer_countries?: string[];
  performer_ethnicities?: string[];
  performer_rating?: {
    modifier: CriterionModifier;
    value: number;
    value2?: number;
  } | null;
};

export class SceneMarkerTagsCriterion extends Criterion {
  // groups used when modifier = EQUALS (legacy simple tag-only groups)
  public groups: ILabeledId[][] = [];
  // extended groups with performer attributes
  public extendedGroups: SceneMarkerTagGroupUI[] = [];
  // flat items used when modifier = INCLUDES / INCLUDES_ALL
  public items: ILabeledId[] = [];
  public modifier: CriterionModifier = CriterionModifier.Equals;

  constructor(option: CriterionOption) {
    super(option);
  }

  public cloneValues() {
    this.groups = this.groups.map((g) => g.map((v) => ({ ...v })));
    this.extendedGroups = this.extendedGroups.map((g) => ({
      tags: g.tags ? g.tags.map((t) => ({ ...t })) : undefined,
      performer_ids: g.performer_ids ? g.performer_ids.map((p) => ({ ...p })) : undefined,
      performer_countries: g.performer_countries ? [...g.performer_countries] : undefined,
      performer_ethnicities: g.performer_ethnicities ? [...g.performer_ethnicities] : undefined,
      performer_rating: g.performer_rating
        ? {
            modifier: g.performer_rating.modifier,
            value: g.performer_rating.value,
            value2: g.performer_rating.value2,
          }
        : null,
    }));
    this.items = this.items.map((v) => ({ ...v }));
  }

  // Check if extended groups have any performer attributes set
  private hasExtendedGroupAttrs(): boolean {
    return this.extendedGroups.some(
      (g) =>
        (g.performer_ids?.length ?? 0) > 0 ||
        (g.performer_countries?.length ?? 0) > 0 ||
        (g.performer_ethnicities?.length ?? 0) > 0 ||
        g.performer_rating != null
    );
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({ id: this.criterionOption.messageID });
    const modifierString = ModifierCriterion.getModifierLabel(intl, this.modifier);

    let valueString = "";
    if (
      this.modifier === CriterionModifier.Equals ||
      this.modifier === CriterionModifier.NotEquals
    ) {
      // Use extendedGroups if they have performer attributes, otherwise use simple groups
      if (this.hasExtendedGroupAttrs()) {
        valueString = this.extendedGroups
          .map((g) => {
            const parts: string[] = [];
            if (g.tags?.length) parts.push(g.tags.map((t) => t.label).join(" + "));
            if (g.performer_ids?.length) parts.push(`performers=${g.performer_ids.map((p) => p.label).join(",")}`);
            if (g.performer_countries?.length) parts.push(`country=${g.performer_countries.join(",")}`);
            if (g.performer_ethnicities?.length) parts.push(`ethnicity=${g.performer_ethnicities.join(",")}`);
            if (g.performer_rating) {
              const mod = ModifierCriterion.getModifierLabel(intl, g.performer_rating.modifier);
              if (
                g.performer_rating.modifier === CriterionModifier.Between ||
                g.performer_rating.modifier === CriterionModifier.NotBetween
              ) {
                parts.push(`rating ${mod} ${g.performer_rating.value}..${g.performer_rating.value2 ?? ""}`);
              } else {
                parts.push(`rating ${mod} ${g.performer_rating.value}`);
              }
            }
            return `(${parts.join(" ")})`;
          })
          .join("; ");
      } else {
        valueString = this.groups
          .map((g) => `(${g.map((v) => v.label).join(" + ")})`)
          .join("; ");
      }
    } else if (
      this.modifier !== CriterionModifier.IsNull &&
      this.modifier !== CriterionModifier.NotNull
    ) {
      valueString = this.items.map((v) => v.label).join(", ");
    }

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
      if (
        this.modifier === CriterionModifier.Equals ||
        this.modifier === CriterionModifier.NotEquals
      ) {
        // Use extendedGroups if they have performer attributes
        if (this.hasExtendedGroupAttrs()) {
          base.extendedGroups = this.extendedGroups.map((g) => ({
            tags: g.tags?.map((t) => ({ id: t.id, label: t.label })),
            performer_ids: g.performer_ids?.map((p) => ({ id: p.id, label: p.label })),
            performer_countries: g.performer_countries?.length ? g.performer_countries : undefined,
            performer_ethnicities: g.performer_ethnicities?.length ? g.performer_ethnicities : undefined,
            performer_rating: g.performer_rating
              ? {
                  modifier: g.performer_rating.modifier,
                  value: g.performer_rating.value,
                  value2: g.performer_rating.value2,
                }
              : undefined,
          }));
        } else {
          base.groups = this.groups.map((g) => g.map((v) => v.id));
        }
      } else {
        base.value = this.items.map((v) => v.id);
      }
    }
    return base;
  }

  public fromDecodedParams(i: Record<string, unknown>): void {
    try {
      const raw = i as {
        modifier?: CriterionModifier;
        value?: string[] | { groups?: string[][] };
        groups?: string[][];
        extendedGroups?: Array<{
          tags?: Array<{ id: string; label: string }>;
          performer_ids?: Array<{ id: string; label: string }>;
          performer_countries?: string[];
          performer_ethnicities?: string[];
          performer_rating?: { modifier: CriterionModifier; value: number; value2?: number };
        }>;
      };
      if (raw.modifier) this.modifier = raw.modifier;
      
      if (raw.extendedGroups) {
        this.extendedGroups = raw.extendedGroups.map((g) => ({
          tags: g.tags?.map((t) => ({ id: t.id, label: t.label })),
          performer_ids: g.performer_ids?.map((p) => ({ id: p.id, label: p.label })),
          performer_countries: g.performer_countries,
          performer_ethnicities: g.performer_ethnicities,
          performer_rating: g.performer_rating ?? null,
        }));
        // Sync tags to simple groups for backwards compatibility
        this.groups = this.extendedGroups
          .filter((g) => g.tags?.length)
          .map((g) => g.tags!.map((t) => ({ id: t.id, label: t.label })));
      } else {
        const groupIds = (raw.groups as string[][]) ?? undefined;
        const valueIds = (raw.value as string[]) ?? undefined;
        if (
          this.modifier === CriterionModifier.Equals ||
          this.modifier === CriterionModifier.NotEquals
        ) {
          this.groups = (groupIds ?? []).map((g) => g.map((id) => ({ id, label: id })));
          // Sync to extendedGroups
          this.extendedGroups = this.groups.map((g) => ({ tags: g }));
        } else if (valueIds) {
          this.items = valueIds.map((id) => ({ id, label: id }));
        }
      }
    } catch {
      // ignore
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (
      this.modifier === CriterionModifier.IsNull ||
      this.modifier === CriterionModifier.NotNull
    ) {
      input[this.criterionOption.type] = { modifier: this.modifier };
      return;
    }

    if (
      this.modifier === CriterionModifier.Equals ||
      this.modifier === CriterionModifier.NotEquals
    ) {
      // Use groups_extended if any performer attributes are set
      if (this.hasExtendedGroupAttrs()) {
        input[this.criterionOption.type] = {
          modifier: this.modifier,
          groups_extended: this.extendedGroups
            .filter((g) => (g.tags?.length ?? 0) > 0 || (g.performer_ids?.length ?? 0) > 0 || (g.performer_countries?.length ?? 0) > 0 || (g.performer_ethnicities?.length ?? 0) > 0 || g.performer_rating != null)
            .map((g) => ({
              tag_ids: g.tags?.map((t) => t.id) ?? [],
              performer_ids: g.performer_ids?.map((p) => p.id) ?? undefined,
              performer_countries: g.performer_countries?.length ? g.performer_countries : undefined,
              performer_ethnicities: g.performer_ethnicities?.length ? g.performer_ethnicities : undefined,
              performer_rating: g.performer_rating
                ? {
                    modifier: g.performer_rating.modifier,
                    value: g.performer_rating.value,
                    value2: g.performer_rating.value2,
                  }
                : undefined,
            })),
        };
      } else {
        input[this.criterionOption.type] = {
          modifier: this.modifier,
          groups: this.groups.map((g) => g.map((v) => v.id)),
        };
      }
    } else {
      input[this.criterionOption.type] = {
        modifier: this.modifier,
        value: this.items.map((v) => v.id),
      };
    }
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    // Save the same shape as applyToCriterionInput for consistency
    this.applyToCriterionInput(input);
  }

  public setFromSavedCriterion(criterion: unknown): void {
    try {
      const c = criterion as {
        modifier: CriterionModifier;
        value?: string[];
        groups?: string[][];
        groups_extended?: Array<{
          tag_ids?: string[];
          performer_ids?: string[];
          performer_countries?: string[];
          performer_ethnicities?: string[];
          performer_rating?: { modifier: CriterionModifier; value: number; value2?: number };
        }>;
      };
      this.modifier = c.modifier;
      if (
        this.modifier === CriterionModifier.Equals ||
        this.modifier === CriterionModifier.NotEquals
      ) {
        if (c.groups_extended) {
          this.extendedGroups = c.groups_extended.map((g) => ({
            tags: g.tag_ids?.map((id) => ({ id, label: id })),
            performer_ids: g.performer_ids?.map((id) => ({ id, label: id })),
            performer_countries: g.performer_countries,
            performer_ethnicities: g.performer_ethnicities,
            performer_rating: g.performer_rating ?? null,
          }));
          // Sync to simple groups
          this.groups = this.extendedGroups
            .filter((g) => g.tags?.length)
            .map((g) => g.tags!.map((t) => ({ id: t.id, label: t.label })));
        } else {
          this.groups = (c.groups ?? []).map((g) => g.map((id) => ({ id, label: id })));
          this.extendedGroups = this.groups.map((g) => ({ tags: g }));
        }
        this.items = [];
      } else if (c.value) {
        this.items = c.value.map((id) => ({ id, label: id }));
        this.groups = [];
        this.extendedGroups = [];
      } else {
        this.items = [];
        this.groups = [];
        this.extendedGroups = [];
      }
    } catch {
      // ignore
    }
  }
}

export const SceneMarkerTagsCriterionOption = new ModifierCriterionOption({
  messageID: "scene_marker_tags",
  type: "scene_marker_tags",
  // Order: IS, INCLUDES ALL, INCLUDES. Remove IS NULL/NOT NULL for this criterion.
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.NotEquals,
    CriterionModifier.IncludesAll,
    CriterionModifier.Includes,
  ],
  defaultModifier: CriterionModifier.Equals,
  inputType: "scene_tags", // custom UI component will be selected by instance type in editor
  makeCriterion: (o) => new SceneMarkerTagsCriterion(o),
});

// TODO - this requires using a nested studios_filter which needs to be added separately
// export const StudioTagsCriterionOption = new BaseTagsCriterionOption(
//   "studio_tags",
//   "studio_tags",
//   withoutEqualsModifierOptions
// );

export const ParentTagsCriterionOption = new BaseTagsCriterionOption(
  "parent_tags",
  "parents",
  withoutEqualsModifierOptions
);

export const ChildTagsCriterionOption = new BaseTagsCriterionOption(
  "sub_tags",
  "children",
  withoutEqualsModifierOptions
);

export class TagsCriterion extends IHierarchicalLabeledIdCriterion {}

// Top-level variant for the Performers page: applies performer_scene_tags directly on performer filter
class PerformerSceneTagsInPerformerFilterCriterion extends TagsCriterion {
  public applyToCriterionInput(input: Record<string, unknown>): void {
    type PerformerFilterInput = Record<string, unknown> & {
      performer_scene_tags?: unknown;
    };
    (input as PerformerFilterInput).performer_scene_tags =
      this.toCriterionInput();
  }
}

// Criterion option exposed on /performers, using the same label as /scenes
class PerformerSceneTagsInPerformerFilterOptionCls extends ModifierCriterionOption {
  constructor() {
    super({
      messageID: "performer_scene_tags",
      type: "performer_scene_tags",
      inputType: "tags",
      modifierOptions: withoutEqualsModifierOptions,
      defaultModifier,
      makeCriterion: () => new PerformerSceneTagsInPerformerFilterCriterion(this),
    });
  }
}

export const PerformerSceneTagsInPerformerFilterOption =
  new PerformerSceneTagsInPerformerFilterOptionCls();

// A lightweight criterion used to encode a performer+tag pair for the
// performer_scene_tags criterion. This emits a value object of the form
// { performerId, tagId } which the backend can interpret to filter scenes
// by the performer/tag combination without requiring a separate performers
// criterion.
export class PerformerSceneTagsPairCriterion extends Criterion {
  private _performerId: string;
  private _tagId: string;

  constructor(performerId: string, tagId: string) {
    super(PerformerSceneTagPairCriterionOption);
    this._performerId = performerId;
    this._tagId = tagId;
  }

  public getLabel(_intl: IntlShape): string {
    // mark parameter as used to satisfy @typescript-eslint/no-unused-vars
    void _intl;
    return "";
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      modifier: CriterionModifier.IncludesAll,
      value: { performer_id: this._performerId, tag_id: this._tagId },
    };
  }

  public fromDecodedParams(i: Record<string, unknown>): void {
    try {
      const raw = i as { value?: unknown };
      type PairInputShape = {
        performer_id?: string;
        performerId?: string;
        tag_id?: string;
        tagId?: string;
      };
      const v = (raw.value ?? i) as PairInputShape;
      const performerId = v.performer_id ?? v.performerId;
      const tagId = v.tag_id ?? v.tagId;
      if (performerId) this._performerId = performerId;
      if (tagId) this._tagId = tagId;
    } catch {
      // ignore decode errors
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      performer_id: this._performerId,
      tag_id: this._tagId,
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      value: { performer_id: this._performerId, tag_id: this._tagId },
      modifier: CriterionModifier.IncludesAll,
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    this.fromDecodedParams(criterion as Record<string, unknown>);
  }
}


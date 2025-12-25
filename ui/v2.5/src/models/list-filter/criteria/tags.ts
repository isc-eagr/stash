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

export const MarkerTagsCriterionOption = new BaseTagsCriterionOption(
  "marker_tags",
  "marker_tags",
  defaultModifierOptions
);

// Scene Marker Tags use grouped semantics for EQUALS (IS). Allow EQUALS here.
// Supports extended groups with performer attributes (IDs, countries, ethnicities, rating)
// Now with separate giver/receiver attribute fields and both_roles support
export type RatingCriterion = {
  modifier: CriterionModifier;
  value: number;
  value2?: number;
} | null;

export type SceneMarkerTagGroupUI = {
  tags?: ILabeledId[];
  exclude_tags?: ILabeledId[];  // Tags that must NOT be present on any marker
  depth?: number;
  
  // Giver criteria
  giver_performer_ids?: ILabeledId[];
  giver_ethnicities?: string[];
  giver_countries?: string[];
  giver_rating?: RatingCriterion;
  
  // Receiver criteria
  receiver_performer_ids?: ILabeledId[];
  receiver_ethnicities?: string[];
  receiver_countries?: string[];
  receiver_rating?: RatingCriterion;
  
  // Both-roles criteria (performer must be BOTH giver AND receiver)
  both_roles_performer_ids?: ILabeledId[];
  both_roles_ethnicities?: string[];
  both_roles_countries?: string[];
  both_roles_rating?: RatingCriterion;
  
  // Mode for performer matching
  performer_mode?: "AND" | "OR";
  
  // DEPRECATED: Use role-specific fields instead
  performer_countries?: string[];
  performer_ethnicities?: string[];
  performer_rating?: RatingCriterion;
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

  private cloneRating(r: RatingCriterion): RatingCriterion {
    return r ? { modifier: r.modifier, value: r.value, value2: r.value2 } : null;
  }

  public cloneValues() {
    this.groups = this.groups.map((g) => g.map((v) => ({ ...v })));
    this.extendedGroups = this.extendedGroups.map((g) => ({
      tags: g.tags ? g.tags.map((t) => ({ ...t })) : undefined,
      exclude_tags: g.exclude_tags ? g.exclude_tags.map((t) => ({ ...t })) : undefined,
      depth: g.depth,
      // Giver criteria
      giver_performer_ids: g.giver_performer_ids ? g.giver_performer_ids.map((p) => ({ ...p })) : undefined,
      giver_ethnicities: g.giver_ethnicities ? [...g.giver_ethnicities] : undefined,
      giver_countries: g.giver_countries ? [...g.giver_countries] : undefined,
      giver_rating: this.cloneRating(g.giver_rating ?? null),
      // Receiver criteria
      receiver_performer_ids: g.receiver_performer_ids ? g.receiver_performer_ids.map((p) => ({ ...p })) : undefined,
      receiver_ethnicities: g.receiver_ethnicities ? [...g.receiver_ethnicities] : undefined,
      receiver_countries: g.receiver_countries ? [...g.receiver_countries] : undefined,
      receiver_rating: this.cloneRating(g.receiver_rating ?? null),
      // Both-roles criteria
      both_roles_performer_ids: g.both_roles_performer_ids ? g.both_roles_performer_ids.map((p) => ({ ...p })) : undefined,
      both_roles_ethnicities: g.both_roles_ethnicities ? [...g.both_roles_ethnicities] : undefined,
      both_roles_countries: g.both_roles_countries ? [...g.both_roles_countries] : undefined,
      both_roles_rating: this.cloneRating(g.both_roles_rating ?? null),
      // Mode
      performer_mode: g.performer_mode,
      // DEPRECATED fields
      performer_countries: g.performer_countries ? [...g.performer_countries] : undefined,
      performer_ethnicities: g.performer_ethnicities ? [...g.performer_ethnicities] : undefined,
      performer_rating: this.cloneRating(g.performer_rating ?? null),
    }));
    this.items = this.items.map((v) => ({ ...v }));
  }

  // Check if extended groups have any performer attributes or depth set
  private hasExtendedGroupAttrs(): boolean {
    return this.extendedGroups.some(
      (g) =>
        (g.exclude_tags?.length ?? 0) > 0 ||
        (g.giver_performer_ids?.length ?? 0) > 0 ||
        (g.giver_ethnicities?.length ?? 0) > 0 ||
        (g.giver_countries?.length ?? 0) > 0 ||
        g.giver_rating != null ||
        (g.receiver_performer_ids?.length ?? 0) > 0 ||
        (g.receiver_ethnicities?.length ?? 0) > 0 ||
        (g.receiver_countries?.length ?? 0) > 0 ||
        g.receiver_rating != null ||
        (g.both_roles_performer_ids?.length ?? 0) > 0 ||
        (g.both_roles_ethnicities?.length ?? 0) > 0 ||
        (g.both_roles_countries?.length ?? 0) > 0 ||
        g.both_roles_rating != null ||
        // DEPRECATED fields
        (g.performer_countries?.length ?? 0) > 0 ||
        (g.performer_ethnicities?.length ?? 0) > 0 ||
        g.performer_rating != null ||
        (g.depth != null && g.depth !== 0)
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
            if (g.tags?.length) {
              const tagStr = g.tags.map((t) => t.label).join(" + ");
              if (g.depth != null && g.depth !== 0) {
                parts.push(`${tagStr} (+subs)`);
              } else {
                parts.push(tagStr);
              }
            }
            // Giver info
            if (g.giver_performer_ids?.length) parts.push(`giver=${g.giver_performer_ids.map((p) => p.label).join(",")}`);
            if (g.giver_ethnicities?.length) parts.push(`giver_eth=${g.giver_ethnicities.join(",")}`);
            if (g.giver_countries?.length) parts.push(`giver_ctry=${g.giver_countries.join(",")}`);
            // Receiver info
            if (g.receiver_performer_ids?.length) parts.push(`receiver=${g.receiver_performer_ids.map((p) => p.label).join(",")}`);
            if (g.receiver_ethnicities?.length) parts.push(`receiver_eth=${g.receiver_ethnicities.join(",")}`);
            if (g.receiver_countries?.length) parts.push(`receiver_ctry=${g.receiver_countries.join(",")}`);
            // Both-roles info
            if (g.both_roles_performer_ids?.length) parts.push(`both=${g.both_roles_performer_ids.map((p) => p.label).join(",")}`);
            if (g.both_roles_ethnicities?.length) parts.push(`both_eth=${g.both_roles_ethnicities.join(",")}`);
            if (g.both_roles_countries?.length) parts.push(`both_ctry=${g.both_roles_countries.join(",")}`);
            // DEPRECATED fields for backwards compatibility display
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

  private serializeRating(r: RatingCriterion): { modifier: CriterionModifier; value: number; value2?: number } | undefined {
    return r ? { modifier: r.modifier, value: r.value, value2: r.value2 } : undefined;
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
            exclude_tags: g.exclude_tags?.map((t) => ({ id: t.id, label: t.label })),
            depth: g.depth,
            // Giver
            giver_performer_ids: g.giver_performer_ids?.map((p) => ({ id: p.id, label: p.label })),
            giver_ethnicities: g.giver_ethnicities?.length ? g.giver_ethnicities : undefined,
            giver_countries: g.giver_countries?.length ? g.giver_countries : undefined,
            giver_rating: this.serializeRating(g.giver_rating ?? null),
            // Receiver
            receiver_performer_ids: g.receiver_performer_ids?.map((p) => ({ id: p.id, label: p.label })),
            receiver_ethnicities: g.receiver_ethnicities?.length ? g.receiver_ethnicities : undefined,
            receiver_countries: g.receiver_countries?.length ? g.receiver_countries : undefined,
            receiver_rating: this.serializeRating(g.receiver_rating ?? null),
            // Both-roles
            both_roles_performer_ids: g.both_roles_performer_ids?.map((p) => ({ id: p.id, label: p.label })),
            both_roles_ethnicities: g.both_roles_ethnicities?.length ? g.both_roles_ethnicities : undefined,
            both_roles_countries: g.both_roles_countries?.length ? g.both_roles_countries : undefined,
            both_roles_rating: this.serializeRating(g.both_roles_rating ?? null),
            // Mode
            performer_mode: g.performer_mode,
            // DEPRECATED
            performer_countries: g.performer_countries?.length ? g.performer_countries : undefined,
            performer_ethnicities: g.performer_ethnicities?.length ? g.performer_ethnicities : undefined,
            performer_rating: this.serializeRating(g.performer_rating ?? null),
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
      type ExtendedGroupRaw = {
        tags?: Array<{ id: string; label: string }>;
        exclude_tags?: Array<{ id: string; label: string }>;
        depth?: number;
        giver_performer_ids?: Array<{ id: string; label: string }>;
        giver_ethnicities?: string[];
        giver_countries?: string[];
        giver_rating?: { modifier: CriterionModifier; value: number; value2?: number };
        receiver_performer_ids?: Array<{ id: string; label: string }>;
        receiver_ethnicities?: string[];
        receiver_countries?: string[];
        receiver_rating?: { modifier: CriterionModifier; value: number; value2?: number };
        both_roles_performer_ids?: Array<{ id: string; label: string }>;
        both_roles_ethnicities?: string[];
        both_roles_countries?: string[];
        both_roles_rating?: { modifier: CriterionModifier; value: number; value2?: number };
        performer_mode?: "AND" | "OR";
        // DEPRECATED
        performer_countries?: string[];
        performer_ethnicities?: string[];
        performer_rating?: { modifier: CriterionModifier; value: number; value2?: number };
      };
      const raw = i as {
        modifier?: CriterionModifier;
        value?: string[] | { groups?: string[][] };
        groups?: string[][];
        extendedGroups?: ExtendedGroupRaw[];
      };
      if (raw.modifier) this.modifier = raw.modifier;
      
      if (raw.extendedGroups) {
        this.extendedGroups = raw.extendedGroups.map((g) => ({
          tags: g.tags?.map((t) => ({ id: t.id, label: t.label })),
          exclude_tags: g.exclude_tags?.map((t) => ({ id: t.id, label: t.label })),
          depth: g.depth,
          // Giver
          giver_performer_ids: g.giver_performer_ids?.map((p) => ({ id: p.id, label: p.label })),
          giver_ethnicities: g.giver_ethnicities,
          giver_countries: g.giver_countries,
          giver_rating: g.giver_rating ?? null,
          // Receiver
          receiver_performer_ids: g.receiver_performer_ids?.map((p) => ({ id: p.id, label: p.label })),
          receiver_ethnicities: g.receiver_ethnicities,
          receiver_countries: g.receiver_countries,
          receiver_rating: g.receiver_rating ?? null,
          // Both-roles
          both_roles_performer_ids: g.both_roles_performer_ids?.map((p) => ({ id: p.id, label: p.label })),
          both_roles_ethnicities: g.both_roles_ethnicities,
          both_roles_countries: g.both_roles_countries,
          both_roles_rating: g.both_roles_rating ?? null,
          // Mode
          performer_mode: g.performer_mode,
          // DEPRECATED
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

  private hasGroupContent(g: SceneMarkerTagGroupUI): boolean {
    return (
      (g.tags?.length ?? 0) > 0 ||
      (g.exclude_tags?.length ?? 0) > 0 ||
      (g.giver_performer_ids?.length ?? 0) > 0 ||
      (g.giver_ethnicities?.length ?? 0) > 0 ||
      (g.giver_countries?.length ?? 0) > 0 ||
      g.giver_rating != null ||
      (g.receiver_performer_ids?.length ?? 0) > 0 ||
      (g.receiver_ethnicities?.length ?? 0) > 0 ||
      (g.receiver_countries?.length ?? 0) > 0 ||
      g.receiver_rating != null ||
      (g.both_roles_performer_ids?.length ?? 0) > 0 ||
      (g.both_roles_ethnicities?.length ?? 0) > 0 ||
      (g.both_roles_countries?.length ?? 0) > 0 ||
      g.both_roles_rating != null ||
      // DEPRECATED
      (g.performer_countries?.length ?? 0) > 0 ||
      (g.performer_ethnicities?.length ?? 0) > 0 ||
      g.performer_rating != null ||
      (g.depth != null && g.depth !== 0)
    );
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
            .filter((g) => this.hasGroupContent(g))
            .map((g) => ({
              tag_ids: g.tags?.map((t) => t.id) ?? [],
              exclude_tag_ids: g.exclude_tags?.map((t) => t.id) ?? undefined,
              depth: g.depth != null && g.depth !== 0 ? g.depth : undefined,
              // Giver
              giver_performer_ids: g.giver_performer_ids?.map((p) => p.id) ?? undefined,
              giver_ethnicities: g.giver_ethnicities?.length ? g.giver_ethnicities : undefined,
              giver_countries: g.giver_countries?.length ? g.giver_countries : undefined,
              giver_rating: this.serializeRating(g.giver_rating ?? null),
              // Receiver
              receiver_performer_ids: g.receiver_performer_ids?.map((p) => p.id) ?? undefined,
              receiver_ethnicities: g.receiver_ethnicities?.length ? g.receiver_ethnicities : undefined,
              receiver_countries: g.receiver_countries?.length ? g.receiver_countries : undefined,
              receiver_rating: this.serializeRating(g.receiver_rating ?? null),
              // Both-roles
              both_roles_performer_ids: g.both_roles_performer_ids?.map((p) => p.id) ?? undefined,
              both_roles_ethnicities: g.both_roles_ethnicities?.length ? g.both_roles_ethnicities : undefined,
              both_roles_countries: g.both_roles_countries?.length ? g.both_roles_countries : undefined,
              both_roles_rating: this.serializeRating(g.both_roles_rating ?? null),
              // Mode
              performer_mode: g.performer_mode,
              // DEPRECATED
              performer_countries: g.performer_countries?.length ? g.performer_countries : undefined,
              performer_ethnicities: g.performer_ethnicities?.length ? g.performer_ethnicities : undefined,
              performer_rating: this.serializeRating(g.performer_rating ?? null),
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
      type SavedGroupExtended = {
        tag_ids?: string[];
        exclude_tag_ids?: string[];
        depth?: number;
        giver_performer_ids?: string[];
        giver_ethnicities?: string[];
        giver_countries?: string[];
        giver_rating?: { modifier: CriterionModifier; value: number; value2?: number };
        receiver_performer_ids?: string[];
        receiver_ethnicities?: string[];
        receiver_countries?: string[];
        receiver_rating?: { modifier: CriterionModifier; value: number; value2?: number };
        both_roles_performer_ids?: string[];
        both_roles_ethnicities?: string[];
        both_roles_countries?: string[];
        both_roles_rating?: { modifier: CriterionModifier; value: number; value2?: number };
        performer_mode?: "AND" | "OR";
        // DEPRECATED
        performer_countries?: string[];
        performer_ethnicities?: string[];
        performer_rating?: { modifier: CriterionModifier; value: number; value2?: number };
      };
      const c = criterion as {
        modifier: CriterionModifier;
        value?: string[];
        groups?: string[][];
        groups_extended?: SavedGroupExtended[];
      };
      this.modifier = c.modifier;
      if (
        this.modifier === CriterionModifier.Equals ||
        this.modifier === CriterionModifier.NotEquals
      ) {
        if (c.groups_extended) {
          this.extendedGroups = c.groups_extended.map((g) => ({
            tags: g.tag_ids?.map((id) => ({ id, label: id })),
            exclude_tags: g.exclude_tag_ids?.map((id) => ({ id, label: id })),
            depth: g.depth,
            // Giver
            giver_performer_ids: g.giver_performer_ids?.map((id) => ({ id, label: id })),
            giver_ethnicities: g.giver_ethnicities,
            giver_countries: g.giver_countries,
            giver_rating: g.giver_rating ?? null,
            // Receiver
            receiver_performer_ids: g.receiver_performer_ids?.map((id) => ({ id, label: id })),
            receiver_ethnicities: g.receiver_ethnicities,
            receiver_countries: g.receiver_countries,
            receiver_rating: g.receiver_rating ?? null,
            // Both-roles
            both_roles_performer_ids: g.both_roles_performer_ids?.map((id) => ({ id, label: id })),
            both_roles_ethnicities: g.both_roles_ethnicities,
            both_roles_countries: g.both_roles_countries,
            both_roles_rating: g.both_roles_rating ?? null,
            // Mode
            performer_mode: g.performer_mode,
            // DEPRECATED
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

// Marker Tags with Performers: used on the Markers page to filter markers by tags + performer attributes
export const MarkerTagsWithPerformersCriterionOption = new ModifierCriterionOption({
  messageID: "marker_tags_with_performers",
  type: "marker_tags_with_performers",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.NotEquals,
    CriterionModifier.IncludesAll,
    CriterionModifier.Includes,
  ],
  defaultModifier: CriterionModifier.Equals,
  inputType: "scene_tags",
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


import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { ILabeledId } from "../types";
import { IntlShape } from "react-intl";

// Simple rating value - not a full Criterion class
export interface IRatingValue {
  modifier: CriterionModifier;
  value: number;
  value2?: number;
}

// Single condition for performer marker filtering
export interface IPerformerMarkerCondition {
  tags: ILabeledId[];
  role: "giver" | "receiver" | "any";
  self_ethnicities: string[];
  self_countries: string[];
  self_rating: IRatingValue | null;
  partner_ethnicities: string[];
  partner_countries: string[];
  partner_rating: IRatingValue | null;
}

// Value type for performer markers criterion
export interface IPerformerMarkersValue {
  include: IPerformerMarkerCondition[];
  exclude: IPerformerMarkerCondition[];
}

export const makeEmptyCondition = (): IPerformerMarkerCondition => ({
  tags: [],
  role: "any",
  self_ethnicities: [],
  self_countries: [],
  self_rating: null,
  partner_ethnicities: [],
  partner_countries: [],
  partner_rating: null,
});

export class PerformerMarkersCriterion extends Criterion {
  public modifier: CriterionModifier = CriterionModifier.Equals;
  public value: IPerformerMarkersValue = {
    include: [],
    exclude: [],
  };

  constructor(option?: CriterionOption) {
    super(option ?? PerformerMarkersCriterionOption);
  }

  private cloneRating(r: IRatingValue | null): IRatingValue | null {
    return r ? { modifier: r.modifier, value: r.value, value2: r.value2 } : null;
  }

  private cloneCondition(c: IPerformerMarkerCondition): IPerformerMarkerCondition {
    return {
      tags: c.tags.map((t) => ({ ...t })),
      role: c.role,
      self_ethnicities: [...c.self_ethnicities],
      self_countries: [...c.self_countries],
      self_rating: this.cloneRating(c.self_rating),
      partner_ethnicities: [...c.partner_ethnicities],
      partner_countries: [...c.partner_countries],
      partner_rating: this.cloneRating(c.partner_rating),
    };
  }

  protected cloneValues() {
    this.value = {
      include: this.value.include.map((c) => this.cloneCondition(c)),
      exclude: this.value.exclude.map((c) => this.cloneCondition(c)),
    };
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({ id: this.criterionOption.messageID });

    const formatCondition = (c: IPerformerMarkerCondition, prefix: string): string => {
      const parts: string[] = [];
      if (c.tags.length) {
        parts.push(c.tags.map((t) => t.label).join("/"));
      }
      if (c.role !== "any") {
        parts.push(c.role === "giver" ? "as top" : "as bottom");
      }
      if (c.self_ethnicities.length) {
        parts.push(`self: ${c.self_ethnicities.join("/")}`);
      }
      if (c.self_countries.length) {
        parts.push(`self country: ${c.self_countries.join("/")}`);
      }
      if (c.self_rating) {
        parts.push(`self rating`);
      }
      if (c.partner_ethnicities.length) {
        parts.push(`partner: ${c.partner_ethnicities.join("/")}`);
      }
      if (c.partner_countries.length) {
        parts.push(`partner: ${c.partner_countries.join("/")}`);
      }
      if (c.partner_rating) {
        parts.push(`partner rating`);
      }
      return `${prefix}(${parts.join(" ")})`;
    };

    const includeParts = this.value.include.map((c) => formatCondition(c, "+"));
    const excludeParts = this.value.exclude.map((c) => formatCondition(c, "-"));
    const allParts = [...includeParts, ...excludeParts];

    if (allParts.length === 0) {
      return criterion;
    }

    return `${criterion}: ${allParts.join(", ")}`;
  }

  private serializeRating(r: IRatingValue | null): { modifier: CriterionModifier; value: number; value2?: number } | undefined {
    return r ? { modifier: r.modifier, value: r.value, value2: r.value2 } : undefined;
  }

  private serializeCondition(c: IPerformerMarkerCondition) {
    return {
      tags: c.tags.map((t) => ({ id: t.id, label: t.label })),
      role: c.role,
      self_ethnicities: c.self_ethnicities.length ? c.self_ethnicities : undefined,
      self_countries: c.self_countries.length ? c.self_countries : undefined,
      self_rating: this.serializeRating(c.self_rating),
      partner_ethnicities: c.partner_ethnicities.length ? c.partner_ethnicities : undefined,
      partner_countries: c.partner_countries.length ? c.partner_countries : undefined,
      partner_rating: this.serializeRating(c.partner_rating),
    };
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      include: this.value.include.map((c) => this.serializeCondition(c)),
      exclude: this.value.exclude.map((c) => this.serializeCondition(c)),
    };
  }

  private deserializeCondition(raw: unknown): IPerformerMarkerCondition {
    const c = raw as {
      tags?: Array<{ id: string; label: string }>;
      role?: string;
      self_ethnicities?: string[];
      self_countries?: string[];
      self_rating?: { modifier: CriterionModifier; value: number; value2?: number };
      partner_ethnicities?: string[];
      partner_countries?: string[];
      partner_rating?: { modifier: CriterionModifier; value: number; value2?: number };
    };
    return {
      tags: c.tags?.map((t) => ({ id: t.id, label: t.label })) ?? [],
      role: (c.role as "giver" | "receiver" | "any") ?? "any",
      self_ethnicities: c.self_ethnicities ?? [],
      self_countries: c.self_countries ?? [],
      self_rating: c.self_rating ?? null,
      partner_ethnicities: c.partner_ethnicities ?? [],
      partner_countries: c.partner_countries ?? [],
      partner_rating: c.partner_rating ?? null,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      include?: unknown[];
      exclude?: unknown[];
    };
    if (raw.include) {
      this.value.include = raw.include.map((c) => this.deserializeCondition(c));
    }
    if (raw.exclude) {
      this.value.exclude = raw.exclude.map((c) => this.deserializeCondition(c));
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    const serializeForAPI = (c: IPerformerMarkerCondition) => ({
      tag_ids: c.tags.map((t) => t.id),
      role: c.role !== "any" ? c.role : undefined,
      self_ethnicities: c.self_ethnicities.length ? c.self_ethnicities : undefined,
      self_countries: c.self_countries.length ? c.self_countries : undefined,
      self_rating: this.serializeRating(c.self_rating),
      partner_ethnicities: c.partner_ethnicities.length ? c.partner_ethnicities : undefined,
      partner_countries: c.partner_countries.length ? c.partner_countries : undefined,
      partner_rating: this.serializeRating(c.partner_rating),
    });

    input[this.criterionOption.type] = {
      include: this.value.include.length ? this.value.include.map(serializeForAPI) : undefined,
      exclude: this.value.exclude.length ? this.value.exclude.map(serializeForAPI) : undefined,
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    // Save the full labeled version for restoration
    input[this.criterionOption.type] = {
      include: this.value.include.map((c) => this.serializeCondition(c)),
      exclude: this.value.exclude.map((c) => this.serializeCondition(c)),
    };
  }

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    const data = savedCriterion[this.criterionOption.type] as {
      include?: unknown[];
      exclude?: unknown[];
    };
    if (!data) return;

    if (data.include) {
      this.value.include = data.include.map((c) => this.deserializeCondition(c));
    }
    if (data.exclude) {
      this.value.exclude = data.exclude.map((c) => this.deserializeCondition(c));
    }
  }
}

export const PerformerMarkersCriterionOption: CriterionOption = new CriterionOption({
  messageID: "performer_markers",
  type: "performer_markers",
  makeCriterion: () => new PerformerMarkersCriterion(),
});

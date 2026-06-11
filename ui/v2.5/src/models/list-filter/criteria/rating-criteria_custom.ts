import { IntlShape } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { CriterionType, INumberValue } from "../types";

// CUSTOM: begin - combined rating criteria filters
export type RatingPresenceSection = "bonuses" | "penalties";

export interface RatingCriteriaNumericDefinition {
  key: string;
  label: string;
  choices: RatingCriteriaChoice[];
}

export interface RatingCriteriaChoice {
  value: number;
  label: string;
}

export interface RatingCriteriaPresenceDefinition {
  key: string;
  label: string;
  section: RatingPresenceSection;
}

export interface RatingCriteriaNumericValue {
  modifier: CriterionModifier;
  value: INumberValue;
}

export interface RatingCriteriaValue {
  criteria: Record<string, RatingCriteriaNumericValue | undefined>;
  bonuses: Record<string, boolean | undefined>;
  penalties: Record<string, boolean | undefined>;
}

interface RatingCriteriaCriterionOptionParams {
  type: CriterionType;
  messageID: string;
  criteria: RatingCriteriaNumericDefinition[];
  bonuses: RatingCriteriaPresenceDefinition[];
  penalties: RatingCriteriaPresenceDefinition[];
}

interface RatingCriteriaCriterionInput {
  criteria?: {
    key: string;
    value: {
      modifier: CriterionModifier;
      value?: number;
      value2?: number;
    };
  }[];
  bonuses?: {
    key: string;
    value: boolean;
  }[];
  penalties?: {
    key: string;
    value: boolean;
  }[];
}

export const ratingCriteriaModifierOptions = [
  CriterionModifier.Equals,
  CriterionModifier.GreaterThanEquals,
  CriterionModifier.LessThanEquals,
  CriterionModifier.Between,
];

const appealChoices = [
  "Not attractive",
  "Very low",
  "Mostly not your type",
  "Some appeal",
  "Decent",
  "Good",
  "Clearly attractive",
  "Very attractive",
  "Extremely attractive",
  "Elite attractiveness",
  "Near-perfect",
].map((label, value) => ({ value, label }));

const faceChoices = [
  "Not facially attractive",
  "Very low",
  "Mostly not your type",
  "Some appeal",
  "Decent",
  "Good",
  "Clearly attractive",
  "Very attractive",
  "Extremely attractive",
  "Elite face",
  "Near-perfect",
].map((label, value) => ({ value, label }));

const bodyChoices = [
  "Works against preference",
  "Very low",
  "Mostly not your type",
  "Some appeal",
  "Decent",
  "Good",
  "Clearly attractive",
  "Very attractive",
  "Extremely attractive",
  "Elite body",
  "Near-perfect",
].map((label, value) => ({ value, label }));

const energyChoices = [
  "No energy",
  "Very low quality",
  "Low quality",
  "Serviceable",
  "Decent",
  "Good",
  "Strong",
  "Very strong",
  "Excellent",
  "Elite",
  "All-time sex quality",
].map((label, value) => ({ value, label }));

const performanceChoices = [
  "Weak",
  "Very low",
  "Below average",
  "Serviceable",
  "Decent",
  "Good",
  "Strong",
  "Very strong",
  "Excellent",
  "Elite",
  "Scene-selling",
].map((label, value) => ({ value, label }));

const payoffChoices = [
  {
    value: 0,
    label: "Unremarkable orgasms",
  },
  {
    value: 2,
    label: "Standard orgasms",
  },
  {
    value: 3,
    label: "Above average",
  },
  {
    value: 4,
    label: "Outstanding orgasms",
  },
];

const standoutChoices = [
  {
    value: 0,
    label: "No standout moment",
  },
  {
    value: 1,
    label: "One noticeable moment",
  },
  {
    value: 2,
    label: "Multiple defining moments",
  },
];

const ethnicityChoices = [
  {
    value: 0,
    label: "Negative ethnic appeal",
  },
  {
    value: 1,
    label: "Neutral background",
  },
  {
    value: 2,
    label: "Partial ethnic appeal",
  },
  {
    value: 3,
    label: "Full ethnic appeal",
  },
];

const masculinityChoices = [
  {
    value: 0,
    label: "No masculine appeal",
  },
  {
    value: 1,
    label: "Some masculine appeal",
  },
  {
    value: 2,
    label: "Strong",
  },
  {
    value: 3,
    label: "Core ideal",
  },
];

function emptyRatingCriteriaValue(): RatingCriteriaValue {
  return {
    criteria: {},
    bonuses: {},
    penalties: {},
  };
}

function normalizeNumberValue(value: unknown): INumberValue {
  if (typeof value === "number") {
    return {
      value,
      value2: undefined,
    };
  }

  if (typeof value === "object" && value !== null) {
    const data = value as { value?: unknown; value2?: unknown };
    return {
      value: typeof data.value === "number" ? data.value : undefined,
      value2: typeof data.value2 === "number" ? data.value2 : undefined,
    };
  }

  return {
    value: undefined,
    value2: undefined,
  };
}

function normalizeValue(value: unknown): RatingCriteriaValue {
  const ret = emptyRatingCriteriaValue();
  if (typeof value !== "object" || value === null) {
    return ret;
  }

  const data = value as RatingCriteriaValue;
  for (const [key, criterion] of Object.entries(data.criteria ?? {})) {
    if (!criterion) continue;

    ret.criteria[key] = {
      modifier: ratingCriteriaModifierOptions.includes(criterion.modifier)
        ? criterion.modifier
        : CriterionModifier.GreaterThanEquals,
      value: normalizeNumberValue(criterion.value),
    };
  }

  for (const section of ["bonuses", "penalties"] as const) {
    for (const [key, presence] of Object.entries(data[section] ?? {})) {
      if (typeof presence === "boolean") {
        ret[section][key] = presence;
      }
    }
  }

  return ret;
}

function isNumberCriterionValid(criterion: RatingCriteriaNumericValue) {
  const { value, value2 } = criterion.value;
  if (value === undefined) {
    return false;
  }

  if (
    criterion.modifier === CriterionModifier.Between &&
    value2 === undefined
  ) {
    return false;
  }

  return true;
}

export class RatingCriteriaCriterionOption extends CriterionOption {
  public readonly criteria: RatingCriteriaNumericDefinition[];
  public readonly bonuses: RatingCriteriaPresenceDefinition[];
  public readonly penalties: RatingCriteriaPresenceDefinition[];

  constructor(options: RatingCriteriaCriterionOptionParams) {
    super({
      messageID: options.messageID,
      type: options.type,
      makeCriterion: (o) =>
        new RatingCriteriaCriterion(o as RatingCriteriaCriterionOption),
    });
    this.criteria = options.criteria;
    this.bonuses = options.bonuses;
    this.penalties = options.penalties;
  }
}

export class RatingCriteriaCriterion extends Criterion {
  public value: RatingCriteriaValue = emptyRatingCriteriaValue();

  constructor(option: RatingCriteriaCriterionOption) {
    super(option);
  }

  public get ratingCriteriaOption() {
    return this.criterionOption as RatingCriteriaCriterionOption;
  }

  protected cloneValues() {
    this.value = {
      criteria: Object.fromEntries(
        Object.entries(this.value.criteria).map(([key, criterion]) => [
          key,
          criterion
            ? {
                modifier: criterion.modifier,
                value: { ...criterion.value },
              }
            : undefined,
        ])
      ),
      bonuses: { ...this.value.bonuses },
      penalties: { ...this.value.penalties },
    };
  }

  public getLabel(intl: IntlShape): string {
    const count = this.selectedCount();
    return `${intl.formatMessage({
      id: this.criterionOption.messageID,
    })}: ${count}`;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      value: this.value,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    this.value = normalizeValue(params.value);
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (!this.isValid()) {
      return;
    }

    const criteria = Object.entries(this.value.criteria)
      .filter(
        (
          entry
        ): entry is [string, RatingCriteriaNumericValue] =>
          !!entry[1] && isNumberCriterionValid(entry[1])
      )
      .map(([key, criterion]) => ({
        key,
        value: {
          modifier: criterion.modifier,
          value: criterion.value.value ?? 0,
          value2: criterion.value.value2,
        },
      }));

    const bonuses = Object.entries(this.value.bonuses)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        key,
        value: value ?? false,
      }));

    const penalties = Object.entries(this.value.penalties)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        key,
        value: value ?? false,
      }));

    const ratingCriteriaInput: RatingCriteriaCriterionInput = {
      criteria,
      bonuses,
      penalties,
    };
    input.rating_criteria = ratingCriteriaInput;
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      value: this.value,
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as { value?: unknown };
    this.value = normalizeValue(data?.value);
  }

  public isValid(): boolean {
    return this.selectedCount() > 0;
  }

  private selectedCount() {
    const criteriaCount = Object.values(this.value.criteria).filter(
      (criterion): criterion is RatingCriteriaNumericValue =>
        !!criterion && isNumberCriterionValid(criterion)
    ).length;

    const bonusCount = Object.values(this.value.bonuses).filter(
      (value) => value !== undefined
    ).length;

    const penaltyCount = Object.values(this.value.penalties).filter(
      (value) => value !== undefined
    ).length;

    return criteriaCount + bonusCount + penaltyCount;
  }
}

export const SceneRatingCriteriaCriterionOption =
  new RatingCriteriaCriterionOption({
    type: "rating_criteria",
    messageID: "rating_criteria",
    criteria: [
      {
        key: "performerAppeal",
        label: "Performer Attractiveness",
        choices: appealChoices,
      },
      {
        key: "chemistry",
        label: "Energy / Sex Quality",
        choices: energyChoices,
      },
      {
        key: "payoff",
        label: "Orgasm Quality",
        choices: payoffChoices,
      },
      {
        key: "standout",
        label: "Standout Moment",
        choices: standoutChoices,
      },
    ],
    bonuses: [
      {
        key: "theme",
        label: "Theme Bonus",
        section: "bonuses",
      },
      {
        key: "oralOnly",
        label: "Oral-Only Bonus",
        section: "bonuses",
      },
      {
        key: "standoutAct",
        label: "Standout Act Bonus",
        section: "bonuses",
      },
      {
        key: "largeGroup",
        label: "Large Group Bonus",
        section: "bonuses",
      },
      {
        key: "godTierOrgasm",
        label: "God-Tier Orgasm Bonus",
        section: "bonuses",
      },
    ],
    penalties: [
      {
        key: "noOrgasm",
        label: "No Orgasm Penalty",
        section: "penalties",
      },
      {
        key: "production",
        label: "Production Penalty",
        section: "penalties",
      },
    ],
  });

export const PerformerRatingCriteriaCriterionOption =
  new RatingCriteriaCriterionOption({
    type: "rating_criteria",
    messageID: "rating_criteria",
    criteria: [
      {
        key: "face",
        label: "Face",
        choices: faceChoices,
      },
      {
        key: "body",
        label: "Body",
        choices: bodyChoices,
      },
      {
        key: "performance",
        label: "Sexual Performance",
        choices: performanceChoices,
      },
      {
        key: "ethnicity",
        label: "Ethnicity",
        choices: ethnicityChoices,
      },
      {
        key: "masculinity",
        label: "Masculinity",
        choices: masculinityChoices,
      },
    ],
    bonuses: [
      {
        key: "consistency",
        label: "Consistency Bonus",
        section: "bonuses",
      },
      {
        key: "dick",
        label: "Dick Bonus",
        section: "bonuses",
      },
      {
        key: "tattoosBonus",
        label: "Tattoos Bonus",
        section: "bonuses",
      },
      {
        key: "unlikelyTop",
        label: "Unlikely Top Bonus",
        section: "bonuses",
      },
    ],
    penalties: [],
  });
// CUSTOM: end

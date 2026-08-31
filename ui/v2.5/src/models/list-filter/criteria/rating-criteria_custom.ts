import { IntlShape } from "react-intl";
import { GROUP_SCENE_RATING_KEYS_CUSTOM } from "src/components/Shared/groupSceneRating_custom";
import {
  getSceneGoatElementBonusFilterChoicesCustom,
  getSceneOrgasmQualityFilterChoicesCustom,
} from "src/components/Shared/ratingAdvisorScales_custom";
import { SOLO_SCENE_RATING_KEYS_CUSTOM } from "src/components/Shared/soloSceneRating_custom";
import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { CriterionType, INumberValue } from "../types";

// CUSTOM: begin - combined rating criteria filters
export type RatingPresenceSection = "bonuses" | "penalties";

export interface IRatingCriteriaNumericDefinition {
  key: string;
  label: string;
  choices: IRatingCriteriaChoice[];
  showRawValue?: boolean;
}

export interface IRatingCriteriaChoice {
  value: number;
  label: string;
}

export interface IRatingCriteriaPresenceDefinition {
  key: string;
  label: string;
  section: RatingPresenceSection;
}

export interface IRatingCriteriaNumericValue {
  modifier: CriterionModifier;
  value: INumberValue;
}

export interface IRatingCriteriaValue {
  criteria: Record<string, IRatingCriteriaNumericValue | undefined>;
  bonusValues: Record<string, IRatingCriteriaNumericValue | undefined>;
  bonuses: Record<string, boolean | undefined>;
  penalties: Record<string, boolean | undefined>;
}

interface IRatingCriteriaCriterionOptionParams {
  type: CriterionType;
  messageID: string;
  inputField?: "rating_criteria" | "performer_rating_criteria";
  criteria: IRatingCriteriaNumericDefinition[];
  bonusValues: IRatingCriteriaNumericDefinition[];
  bonuses: IRatingCriteriaPresenceDefinition[];
  penalties: IRatingCriteriaPresenceDefinition[];
}

export interface IRatingCriteriaCriterionInput {
  criteria?: {
    key: string;
    value: {
      modifier: CriterionModifier;
      value: number;
      value2?: number;
    };
  }[];
  bonus_values?: {
    key: string;
    value: {
      modifier: CriterionModifier;
      value: number;
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
  "Some appeal",
  "Decent",
  "Attractive",
  "Very attractive",
  "Perfect",
].map((label, value) => ({ value, label }));

const faceChoices = [
  "Not Attractive",
  "Some Appeal",
  "Decent",
  "Attractive",
  "Very Attractive",
  "Perfect",
].map((label, value) => ({ value, label }));

const bodyChoices = [
  "Not Appealing",
  "Some Appeal",
  "Decent",
  "Attractive",
  "Very Attractive",
  "Perfect",
].map((label, value) => ({ value, label }));

const energyChoices = [
  "No energy",
  "Serviceable",
  "Decent",
  "Strong",
  "Excellent",
  "Perfect quality",
].map((label, value) => ({ value, label }));

const groupEnergyCoordinationChoices = [
  "Disconnected",
  "Weak",
  "Uneven",
  "Strong",
  "Excellent",
  "Perfect execution",
].map((label, value) => ({ value, label }));

const performanceChoices = [
  "Weak",
  "Serviceable",
  "Good",
  "Strong",
  "Excellent",
  "Perfect",
].map((label, value) => ({ value, label }));

const payoffChoices = getSceneOrgasmQualityFilterChoicesCustom();

const usableFactorChoices = [
  {
    value: 0,
    label: "Mostly unusable",
  },
  {
    value: 1,
    label: "Limited use",
  },
  {
    value: 2,
    label: "Standard or mixed",
  },
  {
    value: 3,
    label: "Highly usable",
  },
  {
    value: 4,
    label: "Nearly unskippable",
  },
];

const soloPerformanceChoices = [
  "Clocked out",
  "Going through it",
  "Into it",
  "Excited",
  "Loving it",
].map((label, value) => ({ value, label }));

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

function emptyRatingCriteriaValue(): IRatingCriteriaValue {
  return {
    criteria: {},
    bonusValues: {},
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

function normalizeValue(value: unknown): IRatingCriteriaValue {
  const ret = emptyRatingCriteriaValue();
  if (typeof value !== "object" || value === null) {
    return ret;
  }

  const data = value as IRatingCriteriaValue;
  for (const section of ["criteria", "bonusValues"] as const) {
    for (const [key, criterion] of Object.entries(data[section] ?? {})) {
      if (!criterion) continue;

      ret[section][key] = {
        modifier: ratingCriteriaModifierOptions.includes(criterion.modifier)
          ? criterion.modifier
          : CriterionModifier.GreaterThanEquals,
        value: normalizeNumberValue(criterion.value),
      };
    }
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

function isNumberCriterionValid(criterion: IRatingCriteriaNumericValue) {
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

export function ratingCriteriaValueToCriterionInput(
  value: IRatingCriteriaValue | null | undefined
): IRatingCriteriaCriterionInput | undefined {
  if (!value) {
    return undefined;
  }

  const criteria = Object.entries(value.criteria)
    .filter(
      (entry): entry is [string, IRatingCriteriaNumericValue] =>
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

  const bonus_values = Object.entries(value.bonusValues ?? {})
    .filter(
      (entry): entry is [string, IRatingCriteriaNumericValue] =>
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

  const bonuses = Object.entries(value.bonuses)
    .filter(([, presence]) => presence !== undefined)
    .map(([key, presence]) => ({
      key,
      value: presence ?? false,
    }));

  const penalties = Object.entries(value.penalties)
    .filter(([, presence]) => presence !== undefined)
    .map(([key, presence]) => ({
      key,
      value: presence ?? false,
    }));

  if (
    criteria.length === 0 &&
    bonus_values.length === 0 &&
    bonuses.length === 0 &&
    penalties.length === 0
  ) {
    return undefined;
  }

  return {
    criteria,
    bonus_values,
    bonuses,
    penalties,
  };
}

export class RatingCriteriaCriterionOption extends CriterionOption {
  public readonly criteria: IRatingCriteriaNumericDefinition[];
  public readonly bonusValues: IRatingCriteriaNumericDefinition[];
  public readonly bonuses: IRatingCriteriaPresenceDefinition[];
  public readonly penalties: IRatingCriteriaPresenceDefinition[];
  public readonly inputField: "rating_criteria" | "performer_rating_criteria";

  constructor(options: IRatingCriteriaCriterionOptionParams) {
    super({
      messageID: options.messageID,
      type: options.type,
      makeCriterion: (o) =>
        new RatingCriteriaCriterion(o as RatingCriteriaCriterionOption),
    });
    this.criteria = options.criteria;
    this.bonusValues = options.bonusValues;
    this.bonuses = options.bonuses;
    this.penalties = options.penalties;
    this.inputField = options.inputField ?? "rating_criteria";
  }
}

export class RatingCriteriaCriterion extends Criterion {
  public value: IRatingCriteriaValue = emptyRatingCriteriaValue();

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
      bonusValues: Object.fromEntries(
        Object.entries(this.value.bonusValues ?? {}).map(([key, criterion]) => [
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

    const ratingCriteriaInput = ratingCriteriaValueToCriterionInput(this.value);
    if (!ratingCriteriaInput) {
      return;
    }
    input[this.ratingCriteriaOption.inputField] = ratingCriteriaInput;
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
      (criterion): criterion is IRatingCriteriaNumericValue =>
        !!criterion && isNumberCriterionValid(criterion)
    ).length;

    const bonusCount = Object.values(this.value.bonuses).filter(
      (value) => value !== undefined
    ).length;

    const bonusValueCount = Object.values(this.value.bonusValues ?? {}).filter(
      (criterion): criterion is IRatingCriteriaNumericValue =>
        !!criterion && isNumberCriterionValid(criterion)
    ).length;

    const penaltyCount = Object.values(this.value.penalties).filter(
      (value) => value !== undefined
    ).length;

    return criteriaCount + bonusValueCount + bonusCount + penaltyCount;
  }
}

export const SceneRatingCriteriaCriterionOption =
  new RatingCriteriaCriterionOption({
    type: "rating_criteria",
    messageID: "rating_criteria",
    criteria: [
      {
        key: "topAttractiveness",
        label: "Standard Top(s) Attractiveness",
        choices: appealChoices,
      },
      {
        key: "bottomAttractiveness",
        label: "Standard Bottom(s) Attractiveness",
        choices: appealChoices,
      },
      {
        key: "chemistry",
        label: "Standard Energy / Quality",
        choices: energyChoices,
      },
      {
        key: "payoff",
        label: "Standard Orgasm Quality",
        choices: payoffChoices,
      },
      {
        key: "standout",
        label: "Standard Usable Factor",
        choices: usableFactorChoices,
      },
      {
        key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.topAttractiveness,
        label: "Group Top Lineup Attractiveness",
        choices: appealChoices,
      },
      {
        key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.energyCoordination,
        label: "Group Energy / Coordination",
        choices: groupEnergyCoordinationChoices,
      },
      {
        key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.payoff,
        label: "Group Orgasm Quality",
        choices: payoffChoices,
      },
      {
        key: GROUP_SCENE_RATING_KEYS_CUSTOM.criteria.usability,
        label: "Group Usability",
        choices: usableFactorChoices,
      },
      {
        key: SOLO_SCENE_RATING_KEYS_CUSTOM.attractiveness,
        label: "Solo Vato Attractiveness",
        choices: appealChoices,
      },
      {
        key: SOLO_SCENE_RATING_KEYS_CUSTOM.performance,
        label: "Solo Performance",
        choices: soloPerformanceChoices,
      },
      {
        key: SOLO_SCENE_RATING_KEYS_CUSTOM.usability,
        label: "Solo Usability",
        choices: usableFactorChoices,
      },
    ],
    bonusValues: [
      {
        key: "goatElement",
        label: "GOAT Element Bonus Amount",
        choices: getSceneGoatElementBonusFilterChoicesCustom(),
        showRawValue: false,
      },
    ],
    bonuses: [
      {
        key: "theme",
        label: "Theme / Fantasy / Uniform Bonus",
        section: "bonuses",
      },
      {
        key: "oralOnly",
        label: "Oral-Only Bonus",
        section: "bonuses",
      },
      {
        key: GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses.bottomAttractiveness,
        label: "Group Attractive Bottom Bonus",
        section: "bonuses",
      },
      {
        key: GROUP_SCENE_RATING_KEYS_CUSTOM.bonuses.oralOnly,
        label: "Group Oral-Only Bonus",
        section: "bonuses",
      },
      {
        key: "godTierOrgasm",
        label: "God-Tier Orgasm Bonus",
        section: "bonuses",
      },
      {
        key: "goatElement",
        label: "GOAT Element Presence",
        section: "bonuses",
      },
      {
        key: "unlikelyTop",
        label: "Standard Unlikely Top Bonus",
        section: "bonuses",
      },
      {
        key: "orgasmBonus",
        label: "Solo Orgasm Bonus",
        section: "bonuses",
      },
      {
        key: "feetBonus",
        label: "Solo Feet Bonus",
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
        label: "Production / Visual Quality Penalty",
        section: "penalties",
      },
      {
        key: "extremelyPolished",
        label: "Extremely Polished Penalty",
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
        label: "Ethnicity / Racial Appeal",
        choices: ethnicityChoices,
      },
      {
        key: "masculinity",
        label: "Masculinity",
        choices: masculinityChoices,
      },
    ],
    bonusValues: [],
    bonuses: [
      {
        key: "consistency",
        label: "Consistency Bonus",
        section: "bonuses",
      },
      {
        key: "dick",
        label: "Pito Bonus",
        section: "bonuses",
      },
      {
        key: "tattoosBonus",
        label: "Tattoos Bonus",
        section: "bonuses",
      },
    ],
    penalties: [
      {
        key: "feminine",
        label: "Feminine Penalty",
        section: "penalties",
      },
    ],
  });

export const StudioRatingCriteriaCriterionOption =
  new RatingCriteriaCriterionOption({
    type: "rating_criteria",
    messageID: "studio_average_rating_criteria",
    criteria: SceneRatingCriteriaCriterionOption.criteria,
    bonusValues: SceneRatingCriteriaCriterionOption.bonusValues,
    bonuses: SceneRatingCriteriaCriterionOption.bonuses,
    penalties: SceneRatingCriteriaCriterionOption.penalties,
  });

export const StudioPerformerRatingCriteriaCriterionOption =
  new RatingCriteriaCriterionOption({
    type: "performer_rating_criteria",
    messageID: "studio_average_performer_rating_criteria",
    inputField: "performer_rating_criteria",
    criteria: PerformerRatingCriteriaCriterionOption.criteria,
    bonusValues: PerformerRatingCriteriaCriterionOption.bonusValues,
    bonuses: PerformerRatingCriteriaCriterionOption.bonuses,
    penalties: PerformerRatingCriteriaCriterionOption.penalties,
  });
// CUSTOM: end

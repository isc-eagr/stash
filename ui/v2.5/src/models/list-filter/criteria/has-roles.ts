import { IntlShape } from "react-intl";
import { CriterionOption, Criterion } from "./criterion";
import { CriterionType } from "../types";
import { HasRolesCriterionInput } from "src/core/generated-graphql";

// Interface for the HasRoles filter value
export interface IHasRolesValue {
  hasTops: boolean;
  hasBottoms: boolean;
}

export class HasRolesCriterionOption extends CriterionOption {
  constructor() {
    super({
      messageID: "has_roles",
      type: "has_roles" as CriterionType,
      makeCriterion: () => new HasRolesCriterion(),
    });
  }
}

export const HasRolesCriterionOptionInstance = new HasRolesCriterionOption();

export class HasRolesCriterion extends Criterion {
  public value: IHasRolesValue = {
    hasTops: false,
    hasBottoms: false,
  };

  constructor() {
    super(HasRolesCriterionOptionInstance);
  }

  protected cloneValues() {
    this.value = { ...this.value };
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({ id: "has_roles" });
    const parts: string[] = [];

    if (this.value.hasTops) {
      parts.push(intl.formatMessage({ id: "has_tops" }));
    }
    if (this.value.hasBottoms) {
      parts.push(intl.formatMessage({ id: "has_bottoms" }));
    }

    if (parts.length === 0) {
      return `${criterion}: ${intl.formatMessage({ id: "none" })}`;
    }

    return `${criterion}: ${parts.join(", ")}`;
  }

  public isValid(): boolean {
    // Always valid
    return true;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      value: this.value,
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as { value?: IHasRolesValue };
    if (raw.value) {
      this.value = {
        hasTops: raw.value.hasTops ?? false,
        hasBottoms: raw.value.hasBottoms ?? false,
      };
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    const criterionInput: HasRolesCriterionInput = {
      has_tops: this.value.hasTops,
      has_bottoms: this.value.hasBottoms,
    };
    input.has_roles = criterionInput;
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      value: this.value,
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as { value?: IHasRolesValue };
    if (data?.value) {
      this.value = {
        hasTops: data.value.hasTops ?? false,
        hasBottoms: data.value.hasBottoms ?? false,
      };
    }
  }
}


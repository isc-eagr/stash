/**
 * Unnamed Performer - A virtual performer defined by criteria (ethnicity, country, rating)
 * that can be used in filters to search for markers/scenes with performers matching
 * specific attributes without knowing their identity.
 *
 * Use cases:
 * - "Find markers where the same Black 5-star performer is both top and bottom"
 * - "Find markers where Performer A (Mexican, 4-star) is top and Performer B (Black, 5-star) is also top"
 */

import { CriterionModifier } from "src/core/generated-graphql";
import { IRatingCriteriaValue } from "./rating-criteria_custom";

// Rating criterion for unnamed performers
export interface IUnnamedPerformerRating {
  modifier: CriterionModifier;
  value: number;
  value2?: number;
}

// The definition of an unnamed performer
export interface IUnnamedPerformer {
  // Unique identifier within the filter context (e.g., "unnamed-A", "unnamed-B")
  id: string;
  // Display label (e.g., "Performer A", "Performer B")
  label: string;
  // Single letter identifier (A, B, C, etc.)
  letter: string;
  // Criteria
  ethnicities: string[];
  countries: string[];
  rating: IUnnamedPerformerRating | null;
  rating_criteria: IRatingCriteriaValue | null;
}

// Generate the next available letter for an unnamed performer
export function getNextUnnamedPerformerLetter(
  existing: IUnnamedPerformer[]
): string {
  const usedLetters = new Set(existing.map((p) => p.letter));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const letter of alphabet) {
    if (!usedLetters.has(letter)) {
      return letter;
    }
  }
  // Fallback to numbered if we run out of letters
  return `${existing.length + 1}`;
}

// Create a new unnamed performer with the next available letter
export function createUnnamedPerformer(
  existing: IUnnamedPerformer[]
): IUnnamedPerformer {
  const letter = getNextUnnamedPerformerLetter(existing);
  return {
    id: `unnamed-${letter}`,
    label: `Performer ${letter}`,
    letter,
    ethnicities: [],
    countries: [],
    rating: null,
    rating_criteria: null,
  };
}

// Check if a performer ID represents an unnamed performer
export function isUnnamedPerformerId(id: string): boolean {
  return id.startsWith("unnamed-");
}

// Format the unnamed performer's criteria as a summary string
export function formatUnnamedPerformerSummary(
  performer: IUnnamedPerformer
): string {
  const parts: string[] = [];

  if (performer.ethnicities.length > 0) {
    parts.push(performer.ethnicities.join("/"));
  }

  if (performer.countries.length > 0) {
    parts.push(performer.countries.join("/"));
  }

  if (performer.rating) {
    const modSymbol = getModifierSymbol(performer.rating.modifier);
    if (
      performer.rating.modifier === CriterionModifier.Between ||
      performer.rating.modifier === CriterionModifier.NotBetween
    ) {
      parts.push(
        `${modSymbol}${performer.rating.value}-${performer.rating.value2}★`
      );
    } else {
      parts.push(`${modSymbol}${performer.rating.value}★`);
    }
  }

  const ratingCriteriaCount = getRatingCriteriaCount(performer.rating_criteria);
  if (ratingCriteriaCount > 0) {
    parts.push(`${ratingCriteriaCount} rating criteria`);
  }

  if (parts.length === 0) {
    return "Any performer";
  }

  return parts.join(", ");
}

export function cloneUnnamedPerformer(
  performer: IUnnamedPerformer
): IUnnamedPerformer {
  return {
    ...performer,
    ethnicities: [...(performer.ethnicities ?? [])],
    countries: [...(performer.countries ?? [])],
    rating: performer.rating ? { ...performer.rating } : null,
    rating_criteria: cloneRatingCriteriaValue(performer.rating_criteria),
  };
}

function cloneRatingCriteriaValue(
  value: IRatingCriteriaValue | null | undefined
): IRatingCriteriaValue | null {
  if (!value) {
    return null;
  }

  return {
    criteria: Object.fromEntries(
      Object.entries(value.criteria ?? {}).map(([key, criterion]) => [
        key,
        criterion
          ? {
              modifier: criterion.modifier,
              value: { ...criterion.value },
            }
          : undefined,
      ])
    ),
    bonuses: { ...(value.bonuses ?? {}) },
    penalties: { ...(value.penalties ?? {}) },
  };
}

function getRatingCriteriaCount(value: IRatingCriteriaValue | null) {
  if (!value) {
    return 0;
  }

  return (
    Object.values(value.criteria ?? {}).filter((criterion) => !!criterion)
      .length +
    Object.values(value.bonuses ?? {}).filter(
      (presence) => presence !== undefined
    ).length +
    Object.values(value.penalties ?? {}).filter(
      (presence) => presence !== undefined
    ).length
  );
}

function getModifierSymbol(modifier: CriterionModifier): string {
  switch (modifier) {
    case CriterionModifier.Equals:
      return "";
    case CriterionModifier.NotEquals:
      return "≠";
    case CriterionModifier.GreaterThan:
      return ">";
    case CriterionModifier.GreaterThanEquals:
      return ">=";
    case CriterionModifier.LessThan:
      return "<";
    case CriterionModifier.LessThanEquals:
      return "<=";
    case CriterionModifier.Between:
      return "";
    case CriterionModifier.NotBetween:
      return "!";
    default:
      return "";
  }
}

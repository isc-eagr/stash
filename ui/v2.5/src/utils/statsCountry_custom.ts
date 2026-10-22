import { getCountryByISO } from "src/utils/country";
import { getAppLocaleCustom } from "./appLocale_custom";
import { cleanStatsValueCustom } from "./statsValues_custom";

// CUSTOM: Same catalog and locale as country selectors/details; keys stay ISO codes.
export function statsCountryName(value?: string | null) {
  const cleaned = cleanStatsValueCustom(value);
  if (!cleaned) return "Unknown";
  return getCountryByISO(cleaned, getAppLocaleCustom()) ?? cleaned;
}

// CUSTOM: Display formatting follows the app locale, independently of the browser.
let applicationLocale = "en-GB";
export function setAppLocaleCustom(locale: string) {
  try {
    applicationLocale = new Intl.NumberFormat(locale).resolvedOptions().locale;
  } catch {
    applicationLocale = "en-GB";
  }
}
export function getAppLocaleCustom() {
  return applicationLocale;
}
export function formatAppDecimalCustom(value: number, digits: number) {
  return value.toLocaleString(applicationLocale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatAppDateTimeCustom(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(applicationLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// A date-only value (YYYY-MM-DD) keeps its calendar day in every time zone.
export function formatAppDateCustom(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(applicationLocale, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

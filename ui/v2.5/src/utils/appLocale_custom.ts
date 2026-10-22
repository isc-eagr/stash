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

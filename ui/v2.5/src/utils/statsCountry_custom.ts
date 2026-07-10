const englishRegionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function statsCountryName(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "Unknown";
  if (!/^[a-z]{2}$/i.test(trimmed)) return trimmed;

  const code = trimmed.toUpperCase();
  const name = englishRegionNames.of(code);
  return !name || name === code || name === "Unknown Region" ? trimmed : name;
}

export type ApplicationTheme = "default" | "masculine-black";

export const defaultApplicationTheme: ApplicationTheme = "default";

export const masculineBlackThemeClass = "application-theme-masculine-black";

const applicationThemeClasses = [masculineBlackThemeClass];

interface IThemeClassList {
  add(...tokens: string[]): void;
  remove(...tokens: string[]): void;
}

export function normalizeApplicationTheme(
  value?: string | null
): ApplicationTheme {
  return value === "masculine-black" ? value : defaultApplicationTheme;
}

export function applyApplicationThemeClass(
  classList: IThemeClassList,
  value?: string | null
) {
  classList.remove(...applicationThemeClasses);

  if (normalizeApplicationTheme(value) === "masculine-black") {
    classList.add(masculineBlackThemeClass);
  }
}

export function shouldPreventCreateOptionEnter(
  key: string,
  selectRoot: HTMLElement
): boolean {
  if (key !== "Enter") {
    return false;
  }

  const activeOptionId = selectRoot
    .querySelector<HTMLElement>("[aria-activedescendant]")
    ?.getAttribute("aria-activedescendant");
  if (!activeOptionId) {
    return false;
  }

  return (
    selectRoot.ownerDocument
      .getElementById(activeOptionId)
      ?.getAttribute("data-tag-create-option") === "true"
  );
}

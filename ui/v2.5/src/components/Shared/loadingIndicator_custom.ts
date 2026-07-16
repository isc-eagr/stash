export interface ILoadingIndicatorDisplayMode {
  card: boolean;
  inline: boolean;
  messageVisible: boolean;
  small: boolean;
}

export function shouldUseLoadingOverlay({
  card,
  inline,
  messageVisible,
  small,
}: ILoadingIndicatorDisplayMode): boolean {
  return messageVisible && !card && !inline && !small;
}

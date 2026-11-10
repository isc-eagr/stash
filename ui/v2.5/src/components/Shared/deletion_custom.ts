// CUSTOM: Failed deletions keep their dialog and selection available for retry.
export async function runDeletionCustom({
  action,
  onSuccess,
  onError,
  setRunning,
  onApplied,
}: {
  action: () => Promise<unknown>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
  setRunning: (running: boolean) => void;
  onApplied: (applied: boolean) => void;
}): Promise<void> {
  setRunning(true);
  try {
    await action();
    onSuccess();
  } catch (error) {
    onError(error);
    return;
  } finally {
    setRunning(false);
  }
  onApplied(true);
}

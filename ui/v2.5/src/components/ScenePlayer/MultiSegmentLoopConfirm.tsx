import { useCallback } from "react";
import type { IConfirmActionRequestCustom } from "src/components/Shared/useConfirmAction_custom";
import { useConfirmActionCustom } from "src/components/Shared/useConfirmAction_custom";

export interface IMultiSegmentLoopConfirmRequest
  extends IConfirmActionRequestCustom {
  onConfirm: () => void;
}
// CUSTOM: Loop confirmations share the app dialog and retain fullscreen support.
export function useMultiSegmentLoopConfirm(container?: HTMLElement | null) {
  const { confirm: requestConfirmation, confirmModal } =
    useConfirmActionCustom(container);
  const confirm = useCallback(
    (request: IMultiSegmentLoopConfirmRequest) => {
      void requestConfirmation(request).then((accepted) => {
        if (accepted) request.onConfirm();
      });
    },
    [requestConfirmation]
  );
  return { confirm, confirmModal };
}

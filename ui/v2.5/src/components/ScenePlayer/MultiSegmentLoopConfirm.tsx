import React, { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { ModalComponent } from "src/components/Shared/Modal";

// Confirmation dialog for destructive loop actions. A container keeps the
// dialog visible while the player is fullscreen.
interface IConfirmRequest {
  header: string;
  message: React.ReactNode;
  confirmText: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
}

export function useMultiSegmentLoopConfirm(container?: HTMLElement | null) {
  const intl = useIntl();
  const [request, setRequest] = useState<IConfirmRequest>();
  const close = useCallback(() => setRequest(undefined), []);

  const confirmModal = (
    <ModalComponent
      show={!!request}
      header={request?.header}
      onHide={close}
      accept={{
        text: request?.confirmText,
        variant: request?.variant ?? "danger",
        onClick: () => {
          request?.onConfirm();
          close();
        },
      }}
      cancel={{
        text: intl.formatMessage({ id: "actions.cancel" }),
        variant: "secondary",
        onClick: close,
      }}
      modalProps={container ? { container } : undefined}
    >
      {request?.message}
    </ModalComponent>
  );

  return { confirm: setRequest, confirmModal };
}

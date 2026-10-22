import React, { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ModalComponent } from "./Modal";

export interface IConfirmActionRequestCustom {
  header: string;
  message: React.ReactNode;
  confirmText: string;
  variant?: "danger" | "primary";
}

// CUSTOM: The same themed, keyboard-accessible confirmation for every action.
export function useConfirmActionCustom(container?: HTMLElement | null) {
  const intl = useIntl();
  const [request, setRequest] = useState<IConfirmActionRequestCustom>();
  const resolve = useRef<(accepted: boolean) => void>();
  useEffect(
    () => () => {
      resolve.current?.(false);
    },
    []
  );
  const finish = useCallback((accepted: boolean) => {
    resolve.current?.(accepted);
    resolve.current = undefined;
    setRequest(undefined);
  }, []);
  const confirm = useCallback((next: IConfirmActionRequestCustom) => {
    resolve.current?.(false);
    return new Promise<boolean>((accept) => {
      resolve.current = accept;
      setRequest(next);
    });
  }, []);
  const target =
    container ??
    (typeof document === "undefined"
      ? undefined
      : (document.fullscreenElement as HTMLElement | null)) ??
    undefined;
  const confirmModal = request ? (
    <ModalComponent
      show
      header={request.header}
      onHide={() => finish(false)}
      accept={{
        text: request.confirmText,
        variant: request.variant ?? "danger",
        onClick: () => finish(true),
      }}
      cancel={{
        text: intl.formatMessage({ id: "actions.cancel" }),
        variant: "secondary",
        onClick: () => finish(false),
      }}
      modalProps={{ container: target }}
    >
      {request.message}
    </ModalComponent>
  ) : null;
  return { confirm, confirmModal };
}

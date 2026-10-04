import {
  faArrowUpRightFromSquare,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import React, { useState, useContext, createContext, useMemo } from "react";
import { Button, Toast } from "react-bootstrap";
import { FormattedMessage } from "react-intl";
import { Icon } from "src/components/Shared/Icon";
import { ModalComponent } from "src/components/Shared/Modal";
import { errorToString } from "src/utils";
import cx from "classnames";
import { useToastQueueCustom } from "./toastQueue_custom"; // CUSTOM

export interface IToast {
  content: JSX.Element | string;
  delay?: number;
  variant?: "success" | "danger" | "warning";
  priority?: number; // higher is more important
  enqueue?: boolean; // CUSTOM: Queue behind equal/higher priorities; interrupt lower priorities.
  className?: string; // CUSTOM: Optional achievement color, retaining the standard toast layout.
}
// CUSTOM: Active toast IDs and optional queues are managed in toastQueue_custom.ts.

// errors are always more important than regular toasts
const errorPriority = 100;
// errors should stay on screen longer
const errorDelay = 5000;

type ToastFn = (item: IToast) => void;

const ToastContext = createContext<ToastFn | null>(null);

export const ToastProvider: React.FC = ({ children }) => {
  const { toast, addToast, closeToast } = useToastQueueCustom(); // CUSTOM
  const [expanded, setExpanded] = useState(false);

  function expand() {
    setExpanded(true);
  }

  const toastItem = useMemo(() => {
    if (!toast || expanded) return null;

    return (
      <Toast
        autohide
        key={toast.id}
        onClose={closeToast} // CUSTOM: Dismiss and advance optional queued notifications.
        className={cx(toast.variant ?? "success", toast.className)} // CUSTOM
        delay={toast.delay ?? 3000}
      >
        <Toast.Header>
          <span className="mr-auto" onClick={() => expand()}>
            {toast.content}
          </span>
          {toast.variant === "danger" && (
            <Button
              variant="minimal"
              className="expand-error-button"
              onClick={() => expand()}
            >
              <Icon icon={faArrowUpRightFromSquare} />
            </Button>
          )}
        </Toast.Header>
      </Toast>
    );
  }, [toast, expanded, closeToast]); // CUSTOM

  function copyToClipboard() {
    const { content } = toast ?? {};

    if (!!content && typeof content === "string" && navigator.clipboard) {
      navigator.clipboard.writeText(content);
    }
  }

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      {expanded && (
        <ModalComponent
          dialogClassName="toast-expanded-dialog"
          show={expanded}
          accept={{
            onClick: () => {
              closeToast(); // CUSTOM: Resume queued achievements after closing the expanded toast.
              setExpanded(false);
            },
          }}
          header={<FormattedMessage id="errors.header" />}
          icon={faTriangleExclamation}
          footerButtons={
            <>
              {!!navigator.clipboard && (
                <Button variant="secondary" onClick={() => copyToClipboard()}>
                  <FormattedMessage id="actions.copy_to_clipboard" />
                </Button>
              )}
            </>
          }
        >
          {toast?.content}
        </ModalComponent>
      )}
      {/* CUSTOM: Queued notifications share the native toast container. */}
      <div className={cx("toast-container row", { hidden: !toast })}>
        {toastItem}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const addToast = useContext(ToastContext);

  if (!addToast) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return useMemo(
    () => ({
      toast: addToast,
      success(message: JSX.Element | string) {
        addToast({
          content: message,
        });
      },
      error(error: unknown) {
        const message = errorToString(error);

        console.error(error);
        addToast({
          variant: "danger",
          content: message,
          priority: errorPriority,
          delay: errorDelay,
        });
      },
    }),
    [addToast]
  );
};

export function toastOperation(
  toast: ReturnType<typeof useToast>,
  o: () => Promise<void>,
  successMessage: string
) {
  async function operation() {
    try {
      await o();

      toast.success(successMessage);
    } catch (e) {
      toast.error(e);
    }
  }

  return operation;
}

import React from "react";
import { Spinner } from "react-bootstrap";
import cx from "classnames";
import { useIntl } from "react-intl";
import { PatchComponent } from "src/patch";
import { createPortal } from "react-dom"; // CUSTOM
import { shouldUseLoadingOverlay } from "./loadingIndicator_custom"; // CUSTOM

interface ILoadingProps {
  message?: JSX.Element | string;
  inline?: boolean;
  small?: boolean;
  card?: boolean;
}

const CLASSNAME = "LoadingIndicator";
const CLASSNAME_MESSAGE = `${CLASSNAME}-message`;

export const LoadingIndicator: React.FC<ILoadingProps> = PatchComponent(
  "LoadingIndicator",
  ({ message, inline = false, small = false, card = false }) => {
    const intl = useIntl();

    const text = intl.formatMessage({ id: "loading.generic" });
    const isOverlay = shouldUseLoadingOverlay({
      card,
      inline,
      messageVisible: message !== "",
      small,
    }); // CUSTOM

    const indicatorContent = (
      <>
        <Spinner
          animation="border"
          role="status"
          size={small ? "sm" : undefined}
        >
          <span className="sr-only">{text}</span>
        </Spinner>
        {message !== "" && (
          <h4 className={CLASSNAME_MESSAGE}>{message ?? text}</h4>
        )}
      </>
    );

    // CUSTOM: begin - full-page loading treatment for non-compact indicators
    const indicator = (
      <div
        aria-busy="true"
        aria-live={isOverlay ? "polite" : undefined}
        className={cx(CLASSNAME, {
          inline,
          small,
          "card-based": card,
          "loading-overlay": isOverlay,
        })}
      >
        {isOverlay ? (
          <div className="LoadingIndicator-overlay-card">
            {indicatorContent}
          </div>
        ) : (
          indicatorContent
        )}
      </div>
    );

    return isOverlay && typeof document !== "undefined"
      ? createPortal(indicator, document.body)
      : indicator;
    // CUSTOM: end
  }
);

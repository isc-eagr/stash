import React from "react";
import { useConfigurationContext } from "src/hooks/Config";
import { applyApplicationThemeClass } from "src/utils/applicationTheme_custom";

export const ApplicationThemeCustom: React.FC = () => {
  const { configuration } = useConfigurationContext();

  React.useEffect(() => {
    applyApplicationThemeClass(
      document.documentElement.classList,
      configuration.ui.applicationTheme
    );

    return () => {
      applyApplicationThemeClass(document.documentElement.classList);
    };
  }, [configuration.ui.applicationTheme]);

  return null;
};

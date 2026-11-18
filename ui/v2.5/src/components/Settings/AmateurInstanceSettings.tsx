// CUSTOM: the amateur Stash instance that O Stats and Year in Review can
// include. The backend bridges requests to it with this URL and API key.
import React from "react";
import { Form } from "react-bootstrap";
import { SettingSection } from "./SettingSection";
import { BooleanSetting, ModalSetting, StringSetting } from "./Inputs";
import { useSettings } from "./context";

export const AmateurInstanceSettings: React.FC = () => {
  const { ui, saveUI } = useSettings();
  const settings = ui.amateurInstance ?? {};
  const save = (change: Partial<typeof settings>) =>
    saveUI({ amateurInstance: { ...settings, ...change } });

  return (
    <SettingSection headingID="config.ui.amateur_instance.section">
      <BooleanSetting
        id="amateur-instance-include"
        headingID="config.ui.amateur_instance.include"
        subHeadingID="config.ui.amateur_instance.include_desc"
        checked={settings.includeInOStats ?? false}
        onChange={(v) => save({ includeInOStats: v })}
      />
      <StringSetting
        id="amateur-instance-url"
        headingID="config.ui.amateur_instance.url"
        subHeadingID="config.ui.amateur_instance.url_desc"
        value={settings.url}
        onChange={(v) => save({ url: v.trim() })}
      />
      <ModalSetting<string>
        id="amateur-instance-api-key"
        headingID="config.ui.amateur_instance.api_key"
        subHeadingID="config.ui.amateur_instance.api_key_desc"
        value={settings.apiKey}
        onChange={(v) => save({ apiKey: v.trim() })}
        renderField={(value, setValue) => (
          <Form.Control
            className="text-input"
            type="password"
            autoComplete="off"
            value={value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setValue(e.currentTarget.value)
            }
          />
        )}
        renderValue={(value) => <span>{value ? "••••••••" : ""}</span>}
      />
    </SettingSection>
  );
};

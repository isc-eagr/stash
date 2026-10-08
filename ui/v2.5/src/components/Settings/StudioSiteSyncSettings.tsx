// CUSTOM: Settings > Custom section for the studio site sync logins and
// pictures folders. The backend task reads them from the UI configuration.
import React from "react";
import { Form } from "react-bootstrap";
import type { IStudioSiteSyncConfig } from "src/core/config";
import { SettingSection } from "./SettingSection";
import { ModalSetting, StringSetting } from "./Inputs";
import { useSettings } from "./context";

// Keys match sitesync.SiteKey on the backend. LatinBoyz reads only public
// pages and its picture folders are added by hand.
const sites = [
  {
    key: "bilatinmen",
    name: "Bilatinmen",
    members: true,
    picsHint:
      "Holds one folder per scene code, e.g. D:\\Content\\Latino\\Bilatinmen\\Pics",
  },
  {
    key: "nakedpapis",
    name: "NakedPapis",
    members: true,
    picsHint:
      "Holds one folder per scene code, e.g. D:\\Content\\Latino\\NakedPapis\\Pics",
  },
  {
    key: "latinboyz",
    name: "LatinBoyz",
    members: false,
    picsHint:
      "Holds the unzipped picture sets, each named with its code like latinboyz-model-brian-am2224",
  },
];

export const StudioSiteSyncSettings: React.FC = () => {
  const { ui, saveUI } = useSettings();
  const config = ui.studioSiteSync ?? {};

  function save(site: string, field: keyof IStudioSiteSyncConfig, v: string) {
    saveUI({
      studioSiteSync: {
        ...config,
        [site]: { ...config[site], [field]: v.trim() || undefined },
      },
    });
  }

  return (
    <SettingSection
      headingID="config.ui.studio_site_sync.heading"
      subHeadingID="config.ui.studio_site_sync.description"
    >
      {sites.map(({ key, name, members, picsHint }) => (
        <React.Fragment key={key}>
          {members && (
            <>
              <StringSetting
                id={`studio-site-sync-${key}-username`}
                heading={`${name} username`}
                value={config[key]?.username}
                onChange={(v) => save(key, "username", v)}
              />
              <ModalSetting<string>
                id={`studio-site-sync-${key}-password`}
                heading={`${name} password`}
                value={config[key]?.password}
                onChange={(v) => save(key, "password", v)}
                renderField={(value, setValue) => (
                  <Form.Control
                    className="text-input"
                    type="password"
                    autoComplete="new-password"
                    value={value ?? ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setValue(e.currentTarget.value)
                    }
                  />
                )}
                renderValue={(value) => <span>{value ? "••••••••" : ""}</span>}
              />
            </>
          )}
          <StringSetting
            id={`studio-site-sync-${key}-pics-path`}
            heading={`${name} pictures folder`}
            subHeading={picsHint}
            value={config[key]?.picsPath}
            onChange={(v) => save(key, "picsPath", v)}
          />
        </React.Fragment>
      ))}
    </SettingSection>
  );
};

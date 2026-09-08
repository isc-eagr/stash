import React from "react";
import { Button } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { TagIDSelect, Tag as TagOption } from "src/components/Tags/TagSelect";
import { mutateMetadataGenerate } from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import { normalizeApplicationTheme } from "src/utils/applicationTheme_custom";
import type { ApplicationTheme } from "src/utils/applicationTheme_custom";
import {
  defaultRatingCardTheme,
  getRatingCardThresholdsForEntity,
  normalizeRatingCardThresholds,
} from "src/utils/ratingCardStyles_custom";
import {
  normalizeSceneCardInsightThresholds,
  type ISceneCardInsight,
  type SceneCardInsightThresholdKey,
} from "src/components/Scenes/sceneCardInsightsData_custom"; // CUSTOM
import { SceneCardInsightChip } from "src/components/Scenes/SceneCardInsights_custom"; // CUSTOM
import { SettingSection } from "./SettingSection";
import {
  BooleanSetting,
  NumberSetting,
  SelectSetting,
  Setting,
} from "./Inputs";
import { useSettings } from "./context";

type RoleTagKey =
  | "sexTagId"
  | "oralTagId"
  | "soloTagId"
  | "facialTagId"
  | "orgasmTagId"
  | "feetTagId"
  | "secondCameraTagId"
  | "reallyHotTagId"
  | "goatTagId";

function sceneCardInsightSettingHeading(
  label: string,
  chipLabel: string,
  tone: ISceneCardInsight["tone"]
) {
  return (
    <span className="scene-card-insight-setting-heading">
      <span>{label}</span>
      <SceneCardInsightChip label={chipLabel} tone={tone} />
    </span>
  );
}

export const SettingsCustomPanel: React.FC = () => {
  const intl = useIntl();
  const Toast = useToast();
  const { general, ui, loading, error, saveGeneral, saveUI } = useSettings();

  if (error) return <h1>{error.message}</h1>;
  if (loading) return <LoadingIndicator />;

  const sceneRatingCardThresholds = getRatingCardThresholdsForEntity(
    ui.ratingCardThresholds,
    "scene"
  );
  const performerRatingCardThresholds = getRatingCardThresholdsForEntity(
    ui.ratingCardThresholds,
    "performer"
  );
  const sceneCardInsightThresholds = normalizeSceneCardInsightThresholds(
    ui.sceneCardInsightThresholds
  ); // CUSTOM

  function saveRatingCardThreshold(
    entityType: "scene" | "performer",
    key: "bronze" | "silver" | "gold" | "royalSapphire",
    value: number
  ) {
    const currentThresholds = ui.ratingCardThresholds ?? {};
    const currentEntityThresholds = normalizeRatingCardThresholds(
      entityType === "performer"
        ? currentThresholds.performer ?? currentThresholds
        : currentThresholds.scene ?? currentThresholds
    );

    saveUI({
      ratingCardThresholds: {
        ...currentThresholds,
        [entityType]: {
          ...currentEntityThresholds,
          [key]: value,
        },
      },
    });
  }

  function saveRatingCardOverrideTag(
    key: "bronzeTagId" | "silverTagId" | "goldTagId" | "royalSapphireTagId",
    items: TagOption[]
  ) {
    saveUI({
      ratingCardOverrideTagIds: {
        ...(ui.ratingCardOverrideTagIds ?? {}),
        [key]: items[0]?.id ?? undefined,
      },
    });
  }

  function saveRoleTag(key: RoleTagKey, items: TagOption[]) {
    saveUI({
      roleTagIds: {
        ...(ui.roleTagIds ?? {}),
        [key]: items[0]?.id ?? undefined,
      },
    });
  }

  // CUSTOM: begin - configurable scene card insight thresholds
  function saveSceneCardInsightThreshold(
    key: SceneCardInsightThresholdKey,
    value: number
  ) {
    saveUI({
      sceneCardInsightThresholds: {
        ...sceneCardInsightThresholds,
        [key]: value,
      },
    });
  }
  // CUSTOM: end

  async function deleteSimpleMarkerPreviews() {
    try {
      await mutateMetadataGenerate({
        deleteSimpleMarkerPreviews: true,
      });

      Toast.success(
        intl.formatMessage(
          { id: "config.tasks.added_job_to_queue" },
          { operation_name: intl.formatMessage({ id: "actions.generate" }) }
        )
      );
    } catch (e) {
      Toast.error(e);
    }
  }

  return (
    <>
      <SettingSection headingID="config.ui.application_theme.section">
        <SelectSetting
          id="application-theme"
          headingID="config.ui.application_theme.heading"
          subHeadingID="config.ui.application_theme.description"
          value={normalizeApplicationTheme(ui.applicationTheme)}
          onChange={(v) => saveUI({ applicationTheme: v as ApplicationTheme })}
        >
          <option value="default">
            {intl.formatMessage({
              id: "config.ui.application_theme.options.default",
            })}
          </option>
          <option value="masculine-black">
            {intl.formatMessage({
              id: "config.ui.application_theme.options.masculine_black",
            })}
          </option>
        </SelectSetting>
      </SettingSection>

      <SettingSection headingID="config.categories.custom">
        <BooleanSetting
          id="show-multi-segment-loop"
          headingID="config.ui.scene_player.options.show_multi_segment_loop_controls"
          subHeadingID="config.ui.scene_player.options.show_multi_segment_loop_controls_desc"
          checked={ui.showMultiSegmentLoopControls ?? undefined}
          onChange={(v) => saveUI({ showMultiSegmentLoopControls: v })}
        />
        <BooleanSetting
          id="show-official-scene-marker-layout"
          headingID="config.ui.scene_player.options.show_official_scene_marker_layout"
          subHeadingID="config.ui.scene_player.options.show_official_scene_marker_layout_desc"
          checked={ui.showOfficialSceneMarkerLayout ?? undefined}
          onChange={(v) => saveUI({ showOfficialSceneMarkerLayout: v })}
        />
        <BooleanSetting
          id="enable-scene-o-hotkey"
          headingID="config.ui.scene_player.options.enable_scene_o_hotkey"
          subHeadingID="config.ui.scene_player.options.enable_scene_o_hotkey_desc"
          checked={ui.enableSceneOHotkey ?? true}
          onChange={(v) => saveUI({ enableSceneOHotkey: v })}
        />
        <Setting
          id="delete-simple-marker-previews-task"
          headingID="dialogs.scene_gen.delete_simple_marker_previews"
          subHeadingID="dialogs.scene_gen.delete_simple_marker_previews_tooltip"
        >
          <Button
            variant="secondary"
            onClick={() => deleteSimpleMarkerPreviews()}
          >
            <FormattedMessage id="dialogs.scene_gen.delete_simple_marker_previews" />
          </Button>
        </Setting>
        <Setting
          id="simple-marker-preview-excluded-tags"
          headingID="config.ui.simple_marker_preview_excluded_tags.heading"
          subHeadingID="config.ui.simple_marker_preview_excluded_tags.description"
        >
          <TagIDSelect
            isMulti
            creatable={false}
            ids={ui.simpleMarkerPreviewExcludedTagIds ?? []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveUI({
                simpleMarkerPreviewExcludedTagIds: items.map((item) => item.id),
              })
            }
          />
        </Setting>
      </SettingSection>

      <SettingSection headingID="config.general.preview_generation">
        <BooleanSetting
          id="marker-preview-source-quality"
          headingID="config.general.marker_preview_source_quality_head"
          subHeadingID="config.general.marker_preview_source_quality_desc"
          checked={general.markerPreviewSourceQuality ?? false}
          onChange={(v) => saveGeneral({ markerPreviewSourceQuality: v })}
        />
        <BooleanSetting
          id="marker-preview-skip-quality-check"
          headingID="config.general.marker_preview_skip_quality_check_head"
          subHeadingID="config.general.marker_preview_skip_quality_check_desc"
          checked={general.markerPreviewSkipQualityCheck ?? false}
          onChange={(v) => saveGeneral({ markerPreviewSkipQualityCheck: v })}
        />
      </SettingSection>

      <SettingSection headingID="config.ui.role_tags.heading">
        <div className="setting-group">
          <div className="setting">
            <div>
              <h3>{intl.formatMessage({ id: "config.ui.role_tags.title" })}</h3>
              <div className="sub-heading">
                {intl.formatMessage({ id: "config.ui.role_tags.description" })}
              </div>
            </div>
            <div />
          </div>
        </div>

        <Setting id="role-tag-sex" headingID="config.ui.role_tags.sex">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.sexTagId ? [ui.roleTagIds.sexTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("sexTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-oral" headingID="config.ui.role_tags.oral">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.oralTagId ? [ui.roleTagIds.oralTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("oralTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-solo" headingID="config.ui.role_tags.solo">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.soloTagId ? [ui.roleTagIds.soloTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("soloTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-facial" headingID="config.ui.role_tags.facial">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.facialTagId ? [ui.roleTagIds.facialTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("facialTagId", items)}
          />
        </Setting>
        <Setting
          id="role-tag-really-hot"
          headingID="config.ui.role_tags.really_hot"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.roleTagIds?.reallyHotTagId
                ? [ui.roleTagIds.reallyHotTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRoleTag("reallyHotTagId", items)
            }
          />
        </Setting>
        <Setting id="role-tag-goat" headingID="config.ui.role_tags.goat">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.goatTagId ? [ui.roleTagIds.goatTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("goatTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-orgasm" headingID="config.ui.role_tags.orgasm">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.orgasmTagId ? [ui.roleTagIds.orgasmTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("orgasmTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-feet" headingID="config.ui.role_tags.feet">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.feetTagId ? [ui.roleTagIds.feetTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("feetTagId", items)}
          />
        </Setting>
        <Setting
          id="role-tag-second-camera"
          headingID="config.ui.role_tags.second_camera"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.roleTagIds?.secondCameraTagId
                ? [ui.roleTagIds.secondCameraTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRoleTag("secondCameraTagId", items)
            }
          />
        </Setting>
        <Setting
          id="role-tag-o-stats-exclusions"
          headingID="config.ui.role_tags.o_stats_exclusions"
        >
          <TagIDSelect
            isMulti
            creatable={false}
            ids={ui.roleTagIds?.oStatsExcludedTagIds ?? []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveUI({
                roleTagIds: {
                  ...(ui.roleTagIds ?? {}),
                  oStatsExcludedTagIds: items.map((item) => item.id),
                },
              })
            }
          />
        </Setting>
      </SettingSection>

      {/* CUSTOM: begin - configurable scene card insight thresholds */}
      <SettingSection headingID="config.ui.scene_card_insights.heading">
        <Setting
          id="scene-card-insights-common-activity-tags"
          headingID="config.ui.scene_card_insights.common_activity_tags.heading"
          subHeadingID="config.ui.scene_card_insights.common_activity_tags.description"
        >
          <TagIDSelect
            isMulti
            creatable={false}
            ids={ui.roleTagIds?.outstandingActivityCommonTagIds ?? []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveUI({
                roleTagIds: {
                  ...(ui.roleTagIds ?? {}),
                  outstandingActivityCommonTagIds: items.map((item) => item.id),
                },
              })
            }
          />
        </Setting>
        <NumberSetting
          id="scene-card-insights-visible-limit"
          headingID="config.ui.scene_card_insights.visible_limit.heading"
          subHeadingID="config.ui.scene_card_insights.visible_limit.description"
          value={sceneCardInsightThresholds.visibleInsightLimit}
          onChange={(value) =>
            saveSceneCardInsightThreshold("visibleInsightLimit", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-tag-good-amount"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.tag_good_amount.heading",
            }),
            "Good amount of pito",
            "tag"
          )}
          subHeadingID="config.ui.scene_card_insights.tag_good_amount.description"
          value={sceneCardInsightThresholds.tagGoodAmountMinPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("tagGoodAmountMinPercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-tag-lots"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.tag_lots.heading",
            }),
            "Lots of pito",
            "tag"
          )}
          subHeadingID="config.ui.scene_card_insights.tag_lots.description"
          value={sceneCardInsightThresholds.tagLotsMinPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("tagLotsMinPercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-tag-eye-can-see"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.tag_eye_can_see.heading",
            }),
            "pito as far as the eye can see",
            "tag"
          )}
          subHeadingID="config.ui.scene_card_insights.tag_eye_can_see.description"
          value={sceneCardInsightThresholds.tagEyeCanSeeMinPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("tagEyeCanSeeMinPercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-good"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.good.heading",
            }),
            "Good oral",
            "activity"
          )}
          subHeadingID="config.ui.scene_card_insights.good.description"
          value={sceneCardInsightThresholds.goodOutstandingPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("goodOutstandingPercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-great"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.great.heading",
            }),
            "Great oral",
            "activity"
          )}
          subHeadingID="config.ui.scene_card_insights.great.description"
          value={sceneCardInsightThresholds.greatOutstandingPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("greatOutstandingPercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-amazing"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.amazing.heading",
            }),
            "Amazing oral",
            "activity"
          )}
          subHeadingID="config.ui.scene_card_insights.amazing.description"
          value={sceneCardInsightThresholds.amazingOutstandingPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("amazingOutstandingPercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-near-perfect"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.near_perfect.heading",
            }),
            "Near-perfect oral",
            "activity"
          )}
          subHeadingID="config.ui.scene_card_insights.near_perfect.description"
          value={sceneCardInsightThresholds.nearPerfectOutstandingPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold(
              "nearPerfectOutstandingPercent",
              value
            )
          }
        />
        <NumberSetting
          id="scene-card-insights-rare-role-maximum"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.rare_role_maximum.heading",
            }),
            "Rare instance of a vato taking dick",
            "rare"
          )}
          subHeadingID="config.ui.scene_card_insights.rare_role_maximum.description"
          value={sceneCardInsightThresholds.rareRoleMaximumPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("rareRoleMaximumPercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-few-highlights-episodes"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.few_highlights_episodes.heading",
            }),
            "Few highlights",
            "negative"
          )}
          subHeadingID="config.ui.scene_card_insights.few_highlights_episodes.description"
          value={sceneCardInsightThresholds.fewHighlightsMaxEpisodes}
          onChange={(value) =>
            saveSceneCardInsightThreshold("fewHighlightsMaxEpisodes", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-few-highlights-percent"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.few_highlights_percent.heading",
            }),
            "Few highlights",
            "negative"
          )}
          subHeadingID="config.ui.scene_card_insights.few_highlights_percent.description"
          value={sceneCardInsightThresholds.fewHighlightsMaxPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("fewHighlightsMaxPercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-filler-total"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.filler_percent.heading",
            }),
            "Lots of filler",
            "negative"
          )}
          subHeadingID="config.ui.scene_card_insights.filler_percent.description"
          value={sceneCardInsightThresholds.fillerTotalPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("fillerTotalPercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-lackluster-negative"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.lackluster_negative.heading",
            }),
            "Lackluster sex/oral",
            "negative"
          )}
          subHeadingID="config.ui.scene_card_insights.lackluster_negative.description"
          value={sceneCardInsightThresholds.lacklusterNegativePercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("lacklusterNegativePercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-lackluster-outstanding-suppress"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.lackluster_outstanding_suppress.heading",
            }),
            "Lackluster sex/oral",
            "negative"
          )}
          subHeadingID="config.ui.scene_card_insights.lackluster_outstanding_suppress.description"
          value={
            sceneCardInsightThresholds.lacklusterOutstandingSuppressPercent
          }
          onChange={(value) =>
            saveSceneCardInsightThreshold(
              "lacklusterOutstandingSuppressPercent",
              value
            )
          }
        />
        <NumberSetting
          id="scene-card-insights-lackluster-non-outstanding"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.lackluster_non_outstanding.heading",
            }),
            "Lackluster sex/oral",
            "negative"
          )}
          subHeadingID="config.ui.scene_card_insights.lackluster_non_outstanding.description"
          value={sceneCardInsightThresholds.lacklusterNonOutstandingPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold(
              "lacklusterNonOutstandingPercent",
              value
            )
          }
        />
        <NumberSetting
          id="scene-card-insights-leaning-balance-tolerance"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.leaning_balance_tolerance.heading",
            }),
            "Balanced Scene",
            "activity"
          )}
          subHeadingID="config.ui.scene_card_insights.leaning_balance_tolerance.description"
          value={sceneCardInsightThresholds.leaningBalanceTolerancePercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold(
              "leaningBalanceTolerancePercent",
              value
            )
          }
        />
        <NumberSetting
          id="scene-card-insights-leaning-minority-some"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.leaning_minority_some.heading",
            }),
            "Sex Leaning Scene with some oral",
            "activity"
          )}
          subHeadingID="config.ui.scene_card_insights.leaning_minority_some.description"
          value={sceneCardInsightThresholds.leaningMinoritySomePercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("leaningMinoritySomePercent", value)
          }
        />
        <NumberSetting
          id="scene-card-insights-leaning-minority-good-amount"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.leaning_minority_good_amount.heading",
            }),
            "Sex Leaning Scene with a good amount of oral",
            "activity"
          )}
          subHeadingID="config.ui.scene_card_insights.leaning_minority_good_amount.description"
          value={sceneCardInsightThresholds.leaningMinorityGoodAmountPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold(
              "leaningMinorityGoodAmountPercent",
              value
            )
          }
        />
        <NumberSetting
          id="scene-card-insights-leaning-minority-a-lot"
          heading={sceneCardInsightSettingHeading(
            intl.formatMessage({
              id: "config.ui.scene_card_insights.leaning_minority_a_lot.heading",
            }),
            "Sex Leaning Scene with a lot of oral",
            "activity"
          )}
          subHeadingID="config.ui.scene_card_insights.leaning_minority_a_lot.description"
          value={sceneCardInsightThresholds.leaningMinorityALotPercent}
          onChange={(value) =>
            saveSceneCardInsightThreshold("leaningMinorityALotPercent", value)
          }
        />
      </SettingSection>
      {/* CUSTOM: end */}

      <SettingSection headingID="config.ui.card_rating_styles.heading">
        <SelectSetting
          id="rating-card-theme"
          headingID="config.ui.card_rating_styles.theme.heading"
          subHeadingID="config.ui.card_rating_styles.theme.description"
          value={ui.ratingCardTheme ?? defaultRatingCardTheme}
          onChange={(v) =>
            saveUI({ ratingCardTheme: v as "premium" | "classic" })
          }
        >
          <option value="premium">
            {intl.formatMessage({
              id: "config.ui.card_rating_styles.theme.options.premium",
            })}
          </option>
          <option value="classic">
            {intl.formatMessage({
              id: "config.ui.card_rating_styles.theme.options.classic",
            })}
          </option>
        </SelectSetting>
        <Setting
          headingID="config.ui.card_rating_styles.override_tags.bronze.heading"
          subHeadingID="config.ui.card_rating_styles.override_tags.description"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.ratingCardOverrideTagIds?.bronzeTagId
                ? [ui.ratingCardOverrideTagIds.bronzeTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRatingCardOverrideTag("bronzeTagId", items)
            }
          />
        </Setting>
        <Setting
          headingID="config.ui.card_rating_styles.override_tags.silver.heading"
          subHeadingID="config.ui.card_rating_styles.override_tags.description"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.ratingCardOverrideTagIds?.silverTagId
                ? [ui.ratingCardOverrideTagIds.silverTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRatingCardOverrideTag("silverTagId", items)
            }
          />
        </Setting>
        <Setting
          headingID="config.ui.card_rating_styles.override_tags.gold.heading"
          subHeadingID="config.ui.card_rating_styles.override_tags.description"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.ratingCardOverrideTagIds?.goldTagId
                ? [ui.ratingCardOverrideTagIds.goldTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRatingCardOverrideTag("goldTagId", items)
            }
          />
        </Setting>
        <Setting
          headingID="config.ui.card_rating_styles.override_tags.royalSapphire.heading"
          subHeadingID="config.ui.card_rating_styles.override_tags.description"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.ratingCardOverrideTagIds?.royalSapphireTagId
                ? [ui.ratingCardOverrideTagIds.royalSapphireTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRatingCardOverrideTag("royalSapphireTagId", items)
            }
          />
        </Setting>
        <NumberSetting
          id="scene-rating-card-threshold-bronze"
          headingID="config.ui.card_rating_styles.thresholds.scene.bronze.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={sceneRatingCardThresholds.bronze}
          onChange={(v) => saveRatingCardThreshold("scene", "bronze", v)}
        />
        <NumberSetting
          id="scene-rating-card-threshold-silver"
          headingID="config.ui.card_rating_styles.thresholds.scene.silver.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={sceneRatingCardThresholds.silver}
          onChange={(v) => saveRatingCardThreshold("scene", "silver", v)}
        />
        <NumberSetting
          id="scene-rating-card-threshold-gold"
          headingID="config.ui.card_rating_styles.thresholds.scene.gold.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={sceneRatingCardThresholds.gold}
          onChange={(v) => saveRatingCardThreshold("scene", "gold", v)}
        />
        <NumberSetting
          id="scene-rating-card-threshold-royalSapphire"
          headingID="config.ui.card_rating_styles.thresholds.scene.royalSapphire.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={sceneRatingCardThresholds.royalSapphire}
          onChange={(v) => saveRatingCardThreshold("scene", "royalSapphire", v)}
        />
        <NumberSetting
          id="performer-rating-card-threshold-bronze"
          headingID="config.ui.card_rating_styles.thresholds.performer.bronze.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={performerRatingCardThresholds.bronze}
          onChange={(v) => saveRatingCardThreshold("performer", "bronze", v)}
        />
        <NumberSetting
          id="performer-rating-card-threshold-silver"
          headingID="config.ui.card_rating_styles.thresholds.performer.silver.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={performerRatingCardThresholds.silver}
          onChange={(v) => saveRatingCardThreshold("performer", "silver", v)}
        />
        <NumberSetting
          id="performer-rating-card-threshold-gold"
          headingID="config.ui.card_rating_styles.thresholds.performer.gold.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={performerRatingCardThresholds.gold}
          onChange={(v) => saveRatingCardThreshold("performer", "gold", v)}
        />
        <NumberSetting
          id="performer-rating-card-threshold-royalSapphire"
          headingID="config.ui.card_rating_styles.thresholds.performer.royalSapphire.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={performerRatingCardThresholds.royalSapphire}
          onChange={(v) =>
            saveRatingCardThreshold("performer", "royalSapphire", v)
          }
        />
      </SettingSection>
    </>
  );
};

export default SettingsCustomPanel;

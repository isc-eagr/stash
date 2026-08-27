import { IntlShape } from "react-intl";
import { ITypename } from "src/utils/data";
import { ImageWallOptions } from "src/utils/imageWall";
import { RatingSystemOptions } from "src/utils/rating";
import {
  FilterMode,
  SavedFilterDataFragment,
  SortDirectionEnum,
} from "./generated-graphql";
import { View } from "src/components/List/views";
import { ITaggerConfig } from "src/components/Tagger/constants";

// NOTE: double capitals aren't converted correctly in the backend

export interface ISavedFilterRow extends ITypename {
  __typename: "SavedFilter";
  savedFilterId: number;
}

export interface IMessage {
  id: string;
  values: { [key: string]: string };
}

export interface ICustomFilter extends ITypename {
  __typename: "CustomFilter";
  message?: IMessage;
  title?: string;
  mode: FilterMode;
  sortBy: string;
  direction: SortDirectionEnum;
}

export type DefaultFilters = {
  [P in View]?: SavedFilterDataFragment;
};

export type FrontPageContent = ISavedFilterRow | ICustomFilter;

export const defaultMaxOptionsShown = 200;
export const defaultPreviewVolume = 25;

export interface IUIConfig {
  // unknown to prevent direct access - use getFrontPageContent
  frontPageContent?: unknown;

  showChildTagContent?: boolean;
  showChildStudioContent?: boolean;
  showLinksOnPerformerCard?: boolean;
  showTagCardOnHover?: boolean;

  showStudioText?: boolean;

  previewVolume?: number;

  abbreviateCounters?: boolean;

  ratingSystemOptions?: RatingSystemOptions;

  // if true a background image will be display on header
  enableMovieBackgroundImage?: boolean;
  // if true a background image will be display on header
  enablePerformerBackgroundImage?: boolean;
  // if true a background image will be display on header
  enableStudioBackgroundImage?: boolean;
  // if true a background image will be display on header
  enableTagBackgroundImage?: boolean;
  // if true view expanded details compact
  compactExpandedDetails?: boolean;
  // if true show all content details by default
  showAllDetails?: boolean;

  // if true the chromecast option will enabled
  enableChromecast?: boolean;

  // if true the fullscreen mobile media auto-rotate option will be disabled
  disableMobileMediaAutoRotateEnabled?: boolean;

  // if true markers with end times will display with a horizontal bar in the scene player
  showRangeMarkers?: boolean;
  // if true continue scene will always play from the beginning
  alwaysStartFromBeginning?: boolean;
  // if true enable activity tracking
  trackActivity?: boolean;
  // the minimum percentage of scene duration which a scene must be played
  // before the play count is incremented
  minimumPlayPercent?: number;

  showAbLoopControls?: boolean;

  // CUSTOM: begin
  // if true, multi-segment loop controls will be shown below the scene player
  showMultiSegmentLoopControls?: boolean;
  // if true, the scene Markers tab uses the upstream grouped primary-tag layout
  showOfficialSceneMarkerLayout?: boolean;
  // if false, the O keyboard shortcut is disabled on scene details
  enableSceneOHotkey?: boolean;
  // CUSTOM: end

  // maximum number of items to shown in the dropdown list - defaults to 200
  // upper limit of 1000
  maxOptionsShown?: number;

  imageWallOptions?: ImageWallOptions;

  lastNoteSeen?: number;

  vrTag?: string;

  pinnedFilters?: Record<string, string[]>;
  tableColumns?: Record<string, string[]>;

  advancedMode?: boolean;

  taskDefaults?: Record<string, {}>;

  defaultFilters?: DefaultFilters;

  taggerConfig?: ITaggerConfig;

  title?: string;

  // CUSTOM: begin
  // Selectable application-wide visual theme
  applicationTheme?: "default" | "masculine-black";
  // Styling option for rating-highlighted scene and performer cards
  ratingCardTheme?: "premium" | "classic";
  ratingCardThresholds?: {
    scene?: {
      bronze?: number;
      silver?: number;
      gold?: number;
      royalSapphire?: number;
    };
    performer?: {
      bronze?: number;
      silver?: number;
      gold?: number;
      royalSapphire?: number;
    };
    // Legacy flat shape from early configurable threshold builds.
    bronze?: number;
    silver?: number;
    gold?: number;
    royalSapphire?: number;
  };
  ratingCardOverrideTagIds?: {
    bronzeTagId?: string;
    silverTagId?: string;
    goldTagId?: string;
    royalSapphireTagId?: string;
  };
  // CUSTOM: begin - scene card insight thresholds
  sceneCardInsightThresholds?: {
    goodOutstandingPercent?: number;
    greatOutstandingPercent?: number;
    amazingOutstandingPercent?: number;
    nearPerfectOutstandingPercent?: number;
    rareRoleMaximumPercent?: number;
    fewHighlightsMaxEpisodes?: number;
    fewHighlightsMaxPercent?: number;
    fillerTotalPercent?: number;
    lacklusterNegativePercent?: number;
    lacklusterOutstandingSuppressPercent?: number;
    lacklusterNonOutstandingPercent?: number;
    tagGoodAmountMinPercent?: number;
    tagLotsMinPercent?: number;
    tagEyeCanSeeMinPercent?: number;
    leaningBalanceTolerancePercent?: number;
    leaningMinoritySomePercent?: number;
    leaningMinorityGoodAmountPercent?: number;
    leaningMinorityALotPercent?: number;
  };
  // CUSTOM: end
  simpleMarkerPreviewExcludedTagIds?: string[]; // Extra primary-only marker tags that skip video/webp preview generation

  // Tag IDs used for scene marker role categorization
  // These determine which marker tags represent each role category
  roleTagIds?: {
    sexTagId?: string; // Tag ID for sex markers
    oralTagId?: string; // Tag ID for oral markers
    soloTagId?: string; // Tag ID for solo markers
    facialTagId?: string; // Tag ID for facial markers
    orgasmTagId?: string; // Tag ID for orgasm markers
    feetTagId?: string; // Tag ID for feet markers
    secondCameraTagId?: string; // Tag ID for 2nd camera markers (excluded from orgasm/facial counts)
    reallyHotTagId?: string; // Tag ID for "really hot" qualifier (gold facial icon when combined with facial)
    goatTagId?: string; // Tag ID for GOAT card styling override
    oStatsExcludedTagIds?: string[]; // Tag IDs hidden from O Stats marker-tag charts
    outstandingActivityCommonTagIds?: string[]; // CUSTOM: common tags eligible for the amount-based Outstanding Activity chip
  };
  // CUSTOM: end
}

export function getFrontPageContent(
  ui: IUIConfig | undefined
): FrontPageContent[] | undefined {
  return ui?.frontPageContent as FrontPageContent[] | undefined;
}

function recentlyReleased(
  intl: IntlShape,
  mode: FilterMode,
  objectsID: string
): ICustomFilter {
  return {
    __typename: "CustomFilter",
    message: {
      id: "recently_released_objects",
      values: { objects: intl.formatMessage({ id: objectsID }) },
    },
    mode,
    sortBy: "date",
    direction: SortDirectionEnum.Desc,
  };
}

function recentlyAdded(
  intl: IntlShape,
  mode: FilterMode,
  objectsID: string
): ICustomFilter {
  return {
    __typename: "CustomFilter",
    message: {
      id: "recently_added_objects",
      values: { objects: intl.formatMessage({ id: objectsID }) },
    },
    mode,
    sortBy: "created_at",
    direction: SortDirectionEnum.Desc,
  };
}

export function generateDefaultFrontPageContent(intl: IntlShape) {
  return [
    recentlyReleased(intl, FilterMode.Scenes, "scenes"),
    recentlyAdded(intl, FilterMode.Studios, "studios"),
    recentlyReleased(intl, FilterMode.Groups, "groups"),
    recentlyAdded(intl, FilterMode.Performers, "performers"),
    recentlyReleased(intl, FilterMode.Galleries, "galleries"),
  ];
}

export function generatePremadeFrontPageContent(intl: IntlShape) {
  return [
    recentlyReleased(intl, FilterMode.Scenes, "scenes"),
    recentlyAdded(intl, FilterMode.Scenes, "scenes"),
    recentlyReleased(intl, FilterMode.Galleries, "galleries"),
    recentlyAdded(intl, FilterMode.Galleries, "galleries"),
    recentlyAdded(intl, FilterMode.Images, "images"),
    recentlyReleased(intl, FilterMode.Groups, "groups"),
    recentlyAdded(intl, FilterMode.Groups, "groups"),
    recentlyAdded(intl, FilterMode.Studios, "studios"),
    recentlyAdded(intl, FilterMode.Performers, "performers"),
    recentlyAdded(intl, FilterMode.SceneMarkers, "markers"),
  ];
}

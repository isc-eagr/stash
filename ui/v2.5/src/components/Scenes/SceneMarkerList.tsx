import cloneDeep from "lodash-es/cloneDeep";
import React, { useCallback, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { FormattedMessage, useIntl } from "react-intl";
import Mousetrap from "mousetrap";
import * as GQL from "src/core/generated-graphql";
import {
  queryFindSceneMarkers,
  useFindSceneMarkers,
} from "src/core/StashService";
import NavUtils from "src/utils/navigation";
import { useFilteredItemList } from "../List/ItemList";
import { ListFilterModel } from "src/models/list-filter/filter";
import { DisplayMode } from "src/models/list-filter/types";
import { MarkerWallPanel } from "./SceneMarkerWallPanel";
import { View } from "../List/views";
import { SceneMarkerCardGrid } from "./SceneMarkerCardGrid";
import { DeleteSceneMarkersDialog } from "./DeleteSceneMarkersDialog";
import { EditSceneMarkersDialog } from "./EditSceneMarkersDialog";
import { PatchComponent, PatchContainerComponent } from "src/patch";
import {
  FilteredListToolbar,
  IItemListOperation,
} from "../List/FilteredListToolbar";
import {
  Sidebar,
  SidebarPane,
  SidebarPaneContent,
  SidebarStateContext,
  useSidebarState,
} from "../Shared/Sidebar";
import { useCloseEditDelete, useFilterOperations } from "../List/util";
import {
  FilteredSidebarHeader,
  useFilteredSidebarKeybinds,
} from "../List/Filters/FilterSidebar";
import { useZoomKeybinds } from "../List/ZoomSlider";
import {
  IListFilterOperation,
  ListOperations,
} from "../List/ListOperationButtons";
import cx from "classnames";
import { FilterTags } from "../List/FilterTags";
import { Pagination, PaginationIndex } from "../List/Pagination";
import { LoadedContent } from "../List/PagedList";
import useFocus from "src/utils/focus";
import { SidebarPerformersFilter } from "../List/Filters/PerformersFilter";
import { SidebarTagsFilter } from "../List/Filters/TagsFilter";
import { SceneTagsCriterionOption } from "src/models/list-filter/criteria/tags"; // CUSTOM
import { Button } from "react-bootstrap";
import TextUtils from "src/utils/text"; // CUSTOM
// CUSTOM: begin - marker queue imports
import { useMarkerQueue } from "src/hooks/MarkerQueue";
import { MarkerQueueIndicator } from "./MarkerQueueIndicator";
import { useToast } from "src/hooks/Toast";
// CUSTOM: end

const SceneMarkerList: React.FC<{
  markers: GQL.SceneMarkerDataFragment[];
  filter: ListFilterModel;
  selectedIds: Set<string>;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
}> = PatchComponent(
  "SceneMarkerList",
  ({ markers, filter, selectedIds, onSelectChange }) => {
    if (markers.length === 0) {
      return null;
    }

    if (filter.displayMode === DisplayMode.Wall) {
      return (
        <MarkerWallPanel
          markers={markers}
          zoomIndex={filter.zoomIndex}
          selectedIds={selectedIds}
          onSelectChange={onSelectChange}
        />
      );
    }

    if (filter.displayMode === DisplayMode.Grid) {
      return (
        <SceneMarkerCardGrid
          markers={markers}
          zoomIndex={filter.zoomIndex}
          selectedIds={selectedIds}
          onSelectChange={onSelectChange}
          activeSortBy={filter.sortBy} // CUSTOM
          activeSortDirection={filter.sortDirection} // CUSTOM
        />
      );
    }

    return null;
  }
);

function usePlayRandom(filter: ListFilterModel, count: number) {
  const history = useHistory();

  const playRandom = useCallback(async () => {
    // query for a random scene
    if (count === 0) {
      return;
    }

    const pages = Math.ceil(count / filter.itemsPerPage);
    const page = Math.floor(Math.random() * pages) + 1;

    const indexMax = Math.min(filter.itemsPerPage, count);
    const index = Math.floor(Math.random() * indexMax);
    const filterCopy = cloneDeep(filter);
    filterCopy.currentPage = page;
    filterCopy.sortBy = "random";
    const queryResults = await queryFindSceneMarkers(filterCopy);
    const marker = queryResults.data.findSceneMarkers.scene_markers[index];
    if (marker) {
      // navigate to the scene player page
      const url = NavUtils.makeSceneMarkerUrl(marker);
      history.push(url);
    }
  }, [filter, count, history]);

  return playRandom;
}

function useAddKeybinds(filter: ListFilterModel, count: number) {
  const playRandom = usePlayRandom(filter, count);

  useEffect(() => {
    Mousetrap.bind("p r", () => {
      playRandom();
    });

    return () => {
      Mousetrap.unbind("p r");
    };
  }, [playRandom]);
}

const ScenesFilterSidebarSections = PatchContainerComponent(
  "FilteredSceneMarkerList.SidebarSections"
);

const SidebarContent: React.FC<{
  filter: ListFilterModel;
  setFilter: (filter: ListFilterModel) => void;
  filterHook?: (filter: ListFilterModel) => ListFilterModel;
  view?: View;
  sidebarOpen: boolean;
  onClose?: () => void;
  showEditFilter: (editingCriterion?: string) => void;
  count?: number;
  focus?: ReturnType<typeof useFocus>;
}> = ({
  filter,
  setFilter,
  filterHook,
  view,
  showEditFilter,
  sidebarOpen,
  onClose,
  count,
  focus,
}) => {
  const showResultsId =
    count !== undefined ? "actions.show_count_results" : "actions.show_results";

  return (
    <>
      <FilteredSidebarHeader
        sidebarOpen={sidebarOpen}
        showEditFilter={showEditFilter}
        filter={filter}
        setFilter={setFilter}
        view={view}
        focus={focus}
      />

      <ScenesFilterSidebarSections>
        <SidebarPerformersFilter
          filter={filter}
          setFilter={setFilter}
          filterHook={filterHook}
        />
        <SidebarTagsFilter
          option={SceneTagsCriterionOption} // CUSTOM
          filter={filter}
          setFilter={setFilter}
          filterHook={filterHook}
        />
      </ScenesFilterSidebarSections>

      <div className="sidebar-footer">
        <Button className="sidebar-close-button" onClick={onClose}>
          <FormattedMessage id={showResultsId} values={{ count }} />
        </Button>
      </div>
    </>
  );
};

interface ISceneMarkerList {
  filterHook?: (filter: ListFilterModel) => ListFilterModel;
  view?: View;
  alterQuery?: boolean;
  defaultSort?: string;
  extraOperations?: IItemListOperation<GQL.FindSceneMarkersQueryResult>[];
}

// CUSTOM: mirror the scene-list duration byline on filtered marker lists.
function renderMarkerMetadataByline(result: GQL.FindSceneMarkersQueryResult) {
  const duration = result.data?.findSceneMarkers.duration;
  if (duration === undefined) return null;

  return (
    <span className="scene-markers-stats">
      &nbsp;({TextUtils.secondsAsTimeString(duration, 3)})
    </span>
  );
}

export const FilteredSceneMarkerList = PatchComponent(
  "FilteredSceneMarkerList",
  (props: ISceneMarkerList) => {
    const intl = useIntl();
    // CUSTOM: begin - marker queue
    const { addToQueue, clearQueue } = useMarkerQueue();
    const Toast = useToast();

    // Clear the marker queue when navigating away from this page
    useEffect(() => {
      return () => {
        clearQueue();
      };
    }, [clearQueue]);
    // CUSTOM: end

    const searchFocus = useFocus();

    const {
      filterHook,
      defaultSort,
      view,
      alterQuery,
      extraOperations = [],
    } = props;

    // States
    const {
      showSidebar,
      setShowSidebar,
      loading: sidebarStateLoading,
      sectionOpen,
      setSectionOpen,
    } = useSidebarState(view);

    const { filterState, queryResult, modalState, listSelect, showEditFilter } =
      useFilteredItemList({
        filterStateProps: {
          filterMode: GQL.FilterMode.SceneMarkers,
          defaultSort,
          view,
          useURL: alterQuery,
        },
        queryResultProps: {
          useResult: useFindSceneMarkers,
          getCount: (r) => r.data?.findSceneMarkers.count ?? 0,
          getItems: (r) => r.data?.findSceneMarkers.scene_markers ?? [],
          filterHook,
        },
      });

    const { filter, setFilter } = filterState;

    const { effectiveFilter, result, cachedResult, items, totalCount } =
      queryResult;

    const {
      selectedIds,
      selectedItems,
      onSelectChange,
      onSelectAll,
      onSelectNone,
      onInvertSelection,
      hasSelection,
    } = listSelect;

    const { modal, showModal, closeModal } = modalState;

    // Utility hooks
    const { setPage, removeCriterion, clearAllCriteria } = useFilterOperations({
      filter,
      setFilter,
    });

    useAddKeybinds(filter, totalCount);
    useFilteredSidebarKeybinds({
      showSidebar,
      setShowSidebar,
    });

    const onCloseEditDelete = useCloseEditDelete({
      closeModal,
      onSelectNone,
      result,
    });

    const onEdit = useCallback(() => {
      showModal(
        <EditSceneMarkersDialog
          selected={selectedItems}
          onClose={onCloseEditDelete}
        />
      );
    }, [showModal, selectedItems, onCloseEditDelete]);

    const onDelete = useCallback(() => {
      showModal(
        <DeleteSceneMarkersDialog
          selected={selectedItems}
          onClose={onCloseEditDelete}
        />
      );
    }, [showModal, selectedItems, onCloseEditDelete]);

    useEffect(() => {
      Mousetrap.bind("e", () => {
        if (hasSelection) {
          onEdit?.();
        }
      });

      Mousetrap.bind("d d", () => {
        if (hasSelection) {
          onDelete?.();
        }
      });

      return () => {
        Mousetrap.unbind("e");
        Mousetrap.unbind("d d");
      };
    }, [onSelectAll, onSelectNone, hasSelection, onEdit, onDelete]);

    useZoomKeybinds({
      zoomIndex: filter.zoomIndex,
      onChangeZoom: (zoom) => setFilter(filter.setZoom(zoom)),
    });

    const playRandom = usePlayRandom(effectiveFilter, totalCount);
    const metadataByline = cachedResult.loading // CUSTOM
      ? null
      : renderMarkerMetadataByline(cachedResult);

    const convertedExtraOperations: IListFilterOperation[] =
      extraOperations.map((o) => ({
        ...o,
        isDisplayed: o.isDisplayed
          ? () => o.isDisplayed!(result, filter, selectedIds)
          : undefined,
        onClick: () => {
          o.onClick(result, filter, selectedIds);
        },
      }));

    const otherOperations = [
      ...convertedExtraOperations,
      {
        text: intl.formatMessage({ id: "actions.select_all" }),
        onClick: () => onSelectAll(),
        isDisplayed: () => totalCount > 0,
      },
      {
        text: intl.formatMessage({ id: "actions.select_none" }),
        onClick: () => onSelectNone(),
        isDisplayed: () => hasSelection,
      },
      {
        text: intl.formatMessage({ id: "actions.invert_selection" }),
        onClick: () => onInvertSelection(),
        isDisplayed: () => totalCount > 0,
      },
      {
        text: intl.formatMessage({ id: "actions.play_random" }),
        onClick: playRandom,
        isDisplayed: () => totalCount > 1,
      },
      // {
      //   text: `${intl.formatMessage({ id: "actions.generate" })}…`,
      //   onClick: () =>
      //     showModal(
      //       <GenerateDialog
      //         type="scene"
      //         selectedIds={Array.from(selectedIds.values())}
      //         onClose={() => closeModal()}
      //       />
      //     ),
      //   isDisplayed: () => hasSelection,
      // },
    ];

    // render
    if (sidebarStateLoading) return null;

    // CUSTOM: begin - add to marker queue handler
    const handleAddToQueue = () => {
      if (selectedIds.size > 0) {
        const selectedMarkers = Array.from(selectedIds)
          .map((id) => items.find((m) => m.id === id))
          .filter((m): m is GQL.SceneMarkerDataFragment => m !== undefined);

        addToQueue(selectedMarkers);
        Toast.success(
          intl.formatMessage(
            { id: "actions.added_to_queue" },
            { count: selectedMarkers.length }
          )
        );
        onSelectNone();
      }
    };
    // CUSTOM: end

    const operations = (
      <ListOperations
        items={items.length}
        hasSelection={hasSelection}
        operations={otherOperations}
        onEdit={onEdit}
        onDelete={onDelete}
        operationsMenuClassName="scene-marker-list-operations-dropdown"
      />
    );

    return (
      <div
        className={cx("item-list-container scene-list", {
          "hide-sidebar": !showSidebar,
        })}
      >
        {modal}

        <SidebarStateContext.Provider value={{ sectionOpen, setSectionOpen }}>
          <SidebarPane hideSidebar={!showSidebar}>
            <Sidebar hide={!showSidebar} onHide={() => setShowSidebar(false)}>
              <SidebarContent
                filter={filter}
                setFilter={setFilter}
                filterHook={filterHook}
                showEditFilter={showEditFilter}
                view={view}
                sidebarOpen={showSidebar}
                onClose={() => setShowSidebar(false)}
                count={cachedResult.loading ? undefined : totalCount}
                focus={searchFocus}
              />
            </Sidebar>
            <SidebarPaneContent
              onSidebarToggle={() => setShowSidebar(!showSidebar)}
            >
              <FilteredListToolbar
                filter={filter}
                listSelect={listSelect}
                setFilter={setFilter}
                showEditFilter={showEditFilter}
                onDelete={onDelete}
                onEdit={onEdit}
                operationComponent={operations}
                view={view}
                zoomable
                // CUSTOM: begin - marker queue indicator
                extraToolbarContent={
                  <MarkerQueueIndicator
                    className="ml-2"
                    onAddToQueue={handleAddToQueue}
                    selectedCount={selectedIds.size}
                  />
                }
                // CUSTOM: end
              />

              <FilterTags
                criteria={filter.criteria}
                onEditCriterion={(c) => showEditFilter(c.criterionOption.type)}
                onRemoveCriterion={removeCriterion}
                onRemoveAll={clearAllCriteria}
              />

              <div className="pagination-index-container">
                <Pagination
                  currentPage={filter.currentPage}
                  itemsPerPage={filter.itemsPerPage}
                  totalItems={totalCount}
                  onChangePage={(page) => setFilter(filter.changePage(page))}
                />
                <PaginationIndex
                  loading={cachedResult.loading}
                  itemsPerPage={filter.itemsPerPage}
                  currentPage={filter.currentPage}
                  totalItems={totalCount}
                  metadataByline={metadataByline}
                />
              </div>

              <LoadedContent loading={result.loading} error={result.error}>
                <SceneMarkerList
                  filter={effectiveFilter}
                  markers={items}
                  selectedIds={selectedIds}
                  onSelectChange={onSelectChange}
                />
              </LoadedContent>

              {totalCount > filter.itemsPerPage && (
                <div className="pagination-footer-container">
                  <div className="pagination-footer">
                    <Pagination
                      itemsPerPage={filter.itemsPerPage}
                      currentPage={filter.currentPage}
                      totalItems={totalCount}
                      onChangePage={setPage}
                      pagePopupPlacement="top"
                    />
                  </div>
                </div>
              )}
            </SidebarPaneContent>
          </SidebarPane>
        </SidebarStateContext.Provider>
      </div>
    );
  }
);

export default FilteredSceneMarkerList;

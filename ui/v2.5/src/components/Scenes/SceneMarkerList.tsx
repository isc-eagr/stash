import cloneDeep from "lodash-es/cloneDeep";
import React from "react";
import { useHistory } from "react-router-dom";
import { useIntl } from "react-intl";
import Mousetrap from "mousetrap";
import { faRandom } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import {
  queryFindSceneMarkers,
  useFindSceneMarkers,
} from "src/core/StashService";
import NavUtils from "src/utils/navigation";
import { ItemList, ItemListContext } from "../List/ItemList";
import { useQueryResultContext } from "../List/ListProvider";
import { ListFilterModel } from "src/models/list-filter/filter";
import { DisplayMode } from "src/models/list-filter/types";
import { MarkerWallPanel } from "./SceneMarkerWallPanel";
import { View } from "../List/views";
import { SceneMarkerCardsGrid } from "./SceneMarkerCardsGrid";
import { DeleteSceneMarkersDialog } from "./DeleteSceneMarkersDialog";
import { EditSceneMarkersDialog } from "./EditSceneMarkersDialog";
import { PatchComponent } from "src/patch";
import {
  IItemListOperation,
  IFilteredListToolbar,
} from "../List/FilteredListToolbar";
import { useMarkerQueue } from "src/hooks/MarkerQueue";
import { MarkerQueueIndicator } from "./MarkerQueueIndicator";
import { useToast } from "src/hooks/Toast";
import { ListOperationButtons } from "../List/ListOperationButtons";
import { useFilterOperations } from "../List/util";
import { PageSizeSelector, SearchTermInput, SortBySelect } from "../List/ListFilter";
import { ListViewButtonGroup } from "../List/ListViewOptions";
import { SavedFilterDropdown } from "../List/SavedFilterList";
import { FilterButton } from "../List/Filters/FilterButton";
import { ButtonGroup, ButtonToolbar } from "react-bootstrap";
import cx from "classnames";

function getItems(result: GQL.FindSceneMarkersQueryResult) {
  return result?.data?.findSceneMarkers?.scene_markers ?? [];
}

function getCount(result: GQL.FindSceneMarkersQueryResult) {
  return result?.data?.findSceneMarkers?.count ?? 0;
}

interface ISceneMarkerList {
  filterHook?: (filter: ListFilterModel) => ListFilterModel;
  view?: View;
  alterQuery?: boolean;
  defaultSort?: string;
  extraOperations?: IItemListOperation<GQL.FindSceneMarkersQueryResult>[];
}

export const SceneMarkerList: React.FC<ISceneMarkerList> = PatchComponent(
  "SceneMarkerList",
  ({ filterHook, view, alterQuery, extraOperations = [] }) => {
    const intl = useIntl();
    const history = useHistory();
    const { queue, count: queueCount, addToQueue } = useMarkerQueue();
    const Toast = useToast();

    const filterMode = GQL.FilterMode.SceneMarkers;

    const otherOperations = [
      ...extraOperations,
      {
        text: intl.formatMessage({ id: "actions.play_random" }),
        onClick: playRandom,
        icon: faRandom,
      },
    ];

    function addKeybinds(
      result: GQL.FindSceneMarkersQueryResult,
      filter: ListFilterModel
    ) {
      Mousetrap.bind("p r", () => {
        playRandom(result, filter);
      });

      return () => {
        Mousetrap.unbind("p r");
      };
    }

    async function playRandom(
      result: GQL.FindSceneMarkersQueryResult,
      filter: ListFilterModel
    ) {
      // query for a random scene
      if (result.data?.findSceneMarkers) {
        const { count } = result.data.findSceneMarkers;

        const index = Math.floor(Math.random() * count);
        const filterCopy = cloneDeep(filter);
        filterCopy.itemsPerPage = 1;
        filterCopy.currentPage = index + 1;
        const singleResult = await queryFindSceneMarkers(filterCopy);
        if (singleResult.data.findSceneMarkers.scene_markers.length === 1) {
          // navigate to the scene player page
          const url = NavUtils.makeSceneMarkerUrl(
            singleResult.data.findSceneMarkers.scene_markers[0]
          );
          history.push(url);
        }
      }
    }

    function renderContent(
      result: GQL.FindSceneMarkersQueryResult,
      filter: ListFilterModel,
      selectedIds: Set<string>,
      onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void
    ) {
      if (!result.data?.findSceneMarkers) return;

      if (filter.displayMode === DisplayMode.Wall) {
        return (
          <MarkerWallPanel
            markers={result.data.findSceneMarkers.scene_markers}
            zoomIndex={filter.zoomIndex}
          />
        );
      }

      if (filter.displayMode === DisplayMode.Grid) {
        return (
          <SceneMarkerCardsGrid
            markers={result.data.findSceneMarkers.scene_markers}
            zoomIndex={filter.zoomIndex}
            selectedIds={selectedIds}
            onSelectChange={onSelectChange}
          />
        );
      }
    }

    function renderEditDialog(
      selectedMarkers: GQL.SceneMarkerDataFragment[],
      onClose: (applied: boolean) => void
    ) {
      return (
        <EditSceneMarkersDialog selected={selectedMarkers} onClose={onClose} />
      );
    }

    function renderDeleteDialog(
      selectedSceneMarkers: GQL.SceneMarkerDataFragment[],
      onClose: (confirmed: boolean) => void
    ) {
      return (
        <DeleteSceneMarkersDialog
          selected={selectedSceneMarkers}
          onClose={onClose}
        />
      );
    }

    function renderToolbar(props: IFilteredListToolbar) {
      const { filter, setFilter, showEditFilter, view: toolbarView, listSelect, onEdit, onDelete, operations } = props;
      const filterOptions = filter.options;
      const { setDisplayMode, setZoom } = useFilterOperations({ filter, setFilter });
      const { selectedIds } = listSelect;
      const hasSelection = selectedIds.size > 0;
      const zoomable = filter.displayMode === DisplayMode.Grid || filter.displayMode === DisplayMode.Wall;
      
      // Get the query result to access markers for add to queue
      const { result } = useQueryResultContext<GQL.FindSceneMarkersQueryResult, GQL.SceneMarkerDataFragment>();
      
      const handleAddToQueue = () => {
        if (selectedIds.size > 0 && result.data?.findSceneMarkers?.scene_markers) {
          const allMarkers = result.data.findSceneMarkers.scene_markers;
          const selectedMarkers = Array.from(selectedIds)
            .map((id) => allMarkers.find((m) => m.id === id))
            .filter((m): m is GQL.SceneMarkerDataFragment => m !== undefined);

          addToQueue(selectedMarkers);
          Toast.success(
            intl.formatMessage(
              { id: "actions.added_to_queue" },
              { count: selectedMarkers.length }
            )
          );
          // Deselect all markers after adding to queue
          listSelect.onSelectNone();
        }
      };

      return (
        <ButtonToolbar className={cx("filtered-list-toolbar", { "has-selection": hasSelection })}>
          {/* Always show the filter controls, not the SelectionSection */}
          <SearchTermInput filter={filter} onFilterUpdate={setFilter} />

          <ButtonGroup>
            <SavedFilterDropdown
              filter={filter}
              onSetFilter={setFilter}
              view={toolbarView}
            />
            <FilterButton
              onClick={() => showEditFilter()}
              count={filter.count()}
            />
          </ButtonGroup>

          <SortBySelect
            sortBy={filter.sortBy}
            sortDirection={filter.sortDirection}
            options={filterOptions.sortByOptions}
            onChangeSortBy={(e) => setFilter(filter.setSortBy(e ?? undefined))}
            onChangeSortDirection={() => setFilter(filter.toggleSortDirection())}
            onReshuffleRandomSort={() => setFilter(filter.reshuffleRandomSort())}
          />

          <PageSizeSelector
            pageSize={filter.itemsPerPage}
            setPageSize={(size) => setFilter(filter.setPageSize(size))}
          />

          {/* Queue indicator with add button */}
          <MarkerQueueIndicator
            onAddToQueue={handleAddToQueue}
            selectedCount={selectedIds.size}
          />
          <ListOperationButtons
            onSelectAll={listSelect.onSelectAll}
            onSelectNone={listSelect.onSelectNone}
            otherOperations={operations}
            itemsSelected={hasSelection}
            onEdit={onEdit}
            onDelete={onDelete}
          />

          <ListViewButtonGroup
            displayMode={filter.displayMode}
            displayModeOptions={filterOptions.displayModeOptions}
            onSetDisplayMode={setDisplayMode}
            zoomIndex={zoomable ? filter.zoomIndex : undefined}
            onSetZoom={zoomable ? setZoom : undefined}
          />
        </ButtonToolbar>
      );
    }

    return (
      <ItemListContext
        filterMode={filterMode}
        useResult={useFindSceneMarkers}
        getItems={getItems}
        getCount={getCount}
        alterQuery={alterQuery}
        filterHook={filterHook}
        view={view}
        selectable
      >
        <ItemList
          view={view}
          otherOperations={otherOperations}
          addKeybinds={addKeybinds}
          renderContent={renderContent}
          renderEditDialog={renderEditDialog}
          renderDeleteDialog={renderDeleteDialog}
          renderToolbar={renderToolbar}
        />
      </ItemListContext>
    );
  }
);

export default SceneMarkerList;

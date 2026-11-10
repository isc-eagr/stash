import React, { useMemo } from "react";
import { Table, Form } from "react-bootstrap";
import { CheckBoxSelect } from "../Shared/Select";
import cx from "classnames";
import { SortDirectionEnum } from "src/core/generated-graphql"; // CUSTOM
import "./ListTable_custom.scss"; // CUSTOM

export interface IColumn {
  label: string;
  value: string;
  mandatory?: boolean;
  sortBy?: string; // CUSTOM: header click sorts by this key
}

export const ColumnSelector: React.FC<{
  selected: string[];
  allColumns: IColumn[];
  setSelected: (selected: string[]) => void;
}> = ({ selected, allColumns, setSelected }) => {
  const disableOptions = useMemo(() => {
    return allColumns.map((col) => {
      return {
        ...col,
        isDisabled: col.mandatory,
      };
    });
  }, [allColumns]);

  const selectedColumns = useMemo(() => {
    return disableOptions.filter((col) => selected.includes(col.value));
  }, [selected, disableOptions]);

  return (
    <CheckBoxSelect
      options={disableOptions}
      selectedOptions={selectedColumns}
      onChange={(v) => {
        setSelected(v.map((col) => col.value));
      }}
    />
  );
};

interface IListTableProps<T> {
  className?: string;
  items: T[];
  columns: string[];
  setColumns: (columns: string[]) => void;
  allColumns: IColumn[];
  selectedIds: Set<string>;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  renderCell: (column: IColumn, item: T, index: number) => React.ReactNode;
  // CUSTOM: begin - optional header sorting and unsaved extra columns
  extraColumns?: string[];
  sortBy?: string;
  sortDirection?: SortDirectionEnum;
  onSort?: (sortBy: string) => void;
  // CUSTOM: end
}

export const ListTable = <T extends { id: string }>(
  props: IListTableProps<T>
) => {
  const {
    className,
    items,
    columns,
    setColumns,
    allColumns,
    selectedIds,
    onSelectChange,
    renderCell,
    extraColumns, // CUSTOM
    sortBy, // CUSTOM
    sortDirection, // CUSTOM
    onSort, // CUSTOM
  } = props;

  const visibleColumns = useMemo(() => {
    const ret = allColumns.filter(
      (col) => col.mandatory || columns.includes(col.value)
    );
    // CUSTOM: begin - extra columns show after the saved ones without being saved
    const extras = allColumns.filter(
      (col) => extraColumns?.includes(col.value) && !ret.includes(col)
    );
    return [...ret, ...extras];
    // CUSTOM: end
  }, [columns, allColumns, extraColumns]); // CUSTOM: extraColumns

  const renderObjectRow = (item: T, index: number) => {
    let shiftKey = false;

    return (
      <tr key={item.id}>
        <td className="select-col">
          <label>
            <Form.Control
              type="checkbox"
              checked={selectedIds.has(item.id)}
              onChange={() =>
                onSelectChange(item.id, !selectedIds.has(item.id), shiftKey)
              }
              onClick={(
                event: React.MouseEvent<HTMLInputElement, MouseEvent>
              ) => {
                shiftKey = event.shiftKey;
                event.stopPropagation();
              }}
            />
          </label>
        </td>

        {visibleColumns.map((column) => (
          <td
            key={column.value}
            className={cx(`${column.value}-data`, {
              "sorted-column": !!sortBy && column.sortBy === sortBy, // CUSTOM
            })}
          >
            {renderCell(column, item, index)}
          </td>
        ))}
      </tr>
    );
  };

  const columnHeaders = useMemo(() => {
    return visibleColumns.map((column) => {
      // CUSTOM: begin - sortable headers
      const sorted = !!sortBy && column.sortBy === sortBy;
      const columnSortBy = column.sortBy;
      return (
        <th
          key={column.value}
          className={cx(`${column.value}-head`, { "sorted-column": sorted })}
          aria-sort={
            sorted
              ? sortDirection === SortDirectionEnum.Desc
                ? "descending"
                : "ascending"
              : undefined
          }
        >
          {columnSortBy && onSort ? (
            <button
              type="button"
              className="sortable-column-head"
              onClick={() => onSort(columnSortBy)}
            >
              {column.label}
              {sorted && (
                <span aria-hidden="true" className="sort-direction">
                  {sortDirection === SortDirectionEnum.Desc ? "↓" : "↑"}
                </span>
              )}
            </button>
          ) : (
            column.label
          )}
        </th>
      );
      // CUSTOM: end
    });
  }, [visibleColumns, sortBy, sortDirection, onSort]); // CUSTOM: sort deps

  return (
    <div className={cx("table-list", className)}>
      <Table striped bordered>
        <thead>
          <tr>
            <th className="select-col">
              <div
                className="d-inline-block"
                data-toggle="popover"
                data-trigger="focus"
              >
                <ColumnSelector
                  allColumns={allColumns}
                  selected={columns}
                  setSelected={setColumns}
                />
              </div>
            </th>

            {columnHeaders}
          </tr>
          <tr>
            <th className="border-row" colSpan={100}></th>
          </tr>
        </thead>
        <tbody>{items.map(renderObjectRow)}</tbody>
      </Table>
    </div>
  );
};

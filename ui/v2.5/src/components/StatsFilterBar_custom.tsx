import React from "react";
import { Button } from "react-bootstrap";

interface IProps {
  label: string;
  total: string;
  filters: { label: string; onRemove: () => void }[];
  onUndo: () => void;
  onClear: () => void;
}

export const StatsFilterBar: React.FC<IProps> = ({
  label,
  total,
  filters,
  onUndo,
  onClear,
}) => {
  if (!filters.length) return null;
  return (
    <div className="stats-filter-bar" role="region" aria-label={label}>
      <span className="stats-filter-total" role="status">
        {total}
      </span>
      <div className="stats-filter-list">
        {filters.map((filter) => (
          <button
            className="stats-filter-chip"
            key={filter.label}
            type="button"
            onClick={filter.onRemove}
            aria-label={`Remove filter: ${filter.label}`}
            title={`Remove filter: ${filter.label}`}
          >
            {filter.label} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <Button onClick={onUndo} size="sm" variant="secondary">
        Undo last filter
      </Button>
      <Button onClick={onClear} size="sm" variant="secondary">
        Clear filters
      </Button>
    </div>
  );
};

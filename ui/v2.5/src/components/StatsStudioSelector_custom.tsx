import React from "react";
import { Form } from "react-bootstrap";
import { StudioSelect, type Studio } from "src/components/Studios/StudioSelect";

interface IProps {
  studio?: Studio;
  includeChildStudios: boolean;
  onIncludeChildStudiosChange: (include: boolean) => void;
  onStudioChange: (studio?: Studio) => void;
}

export const StatsStudioSelector: React.FC<IProps> = ({
  studio,
  includeChildStudios,
  onIncludeChildStudiosChange,
  onStudioChange,
}) => (
  <div className="stats-studio-selector">
    <Form.Group controlId="statsStudio">
      <Form.Label>Studio</Form.Label>
      <StudioSelect
        creatable={false}
        noSelectionString="All studios"
        onSelect={(studios) => onStudioChange(studios[0])}
        values={studio ? [studio] : []}
      />
    </Form.Group>
    {studio && (
      <Form.Check
        checked={includeChildStudios}
        id="statsStudioIncludeChildren"
        label="Include child studios"
        onChange={(event) =>
          onIncludeChildStudiosChange(event.currentTarget.checked)
        }
        type="switch"
      />
    )}
  </div>
);

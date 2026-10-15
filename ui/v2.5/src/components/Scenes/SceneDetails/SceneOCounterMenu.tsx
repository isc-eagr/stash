import React from "react";
import { Dropdown } from "react-bootstrap";
import { OCounterButton } from "src/components/Shared/CountButton";

interface ISceneOCounterMenuProps {
  value: number;
  className?: string;
  valueTitle?: string;
  onIncrement: () => void;
  onRetroactive: () => void;
}

const SceneOCounterMenuToggle = React.forwardRef<
  HTMLDivElement,
  { onClick: (e: React.MouseEvent<HTMLDivElement>) => void }
>(({ onClick, children }, ref) => (
  <div
    ref={ref}
    onClick={(e) => {
      e.preventDefault();
      onClick(e);
    }}
  >
    {children}
  </div>
));

// The scene toolbar's O button opens a choice between a regular O and a
// retroactive O (no date, no video timestamp).
export const SceneOCounterMenu: React.FC<ISceneOCounterMenuProps> = ({
  value,
  className,
  valueTitle,
  onIncrement,
  onRetroactive,
}) => (
  <Dropdown className="scene-o-counter-menu">
    <Dropdown.Toggle as={SceneOCounterMenuToggle} id="scene-o-counter-menu">
      <OCounterButton
        value={value}
        className={className}
        valueTitle={valueTitle}
      />
    </Dropdown.Toggle>
    <Dropdown.Menu className="bg-secondary text-white">
      <Dropdown.Item className="bg-secondary text-white" onClick={onIncrement}>
        O
      </Dropdown.Item>
      <Dropdown.Item
        className="bg-secondary text-white"
        onClick={onRetroactive}
      >
        Retroactive O
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
);

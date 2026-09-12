import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, ButtonGroup } from "react-bootstrap";
import { useMediaQuery } from "src/utils/screen";
import {
  moveSceneMarkerDock,
  readSceneMarkerPlacement,
  saveSceneMarkerPlacement,
  sceneMarkerDockMediaQuery,
  shouldDockSceneMarkers,
  type SceneMarkerPlacement,
} from "./sceneMarkerDockPlacement_custom";
import "./SceneMarkerDock_custom.scss";

interface ISceneMarkerDockProps {
  target: HTMLDivElement | null;
  isVisible: boolean;
  collapsed: boolean;
}

// CUSTOM: One stable portal preserves marker selections, filters and edit drafts.
export const SceneMarkerDock: React.FC<ISceneMarkerDockProps> = ({
  target,
  isVisible,
  collapsed,
  children,
}) => {
  const [placement, setPlacement] = useState(readSceneMarkerPlacement);
  const [container] = useState(() => document.createElement("div"));
  const inlineTarget = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery(sceneMarkerDockMediaQuery);
  const docked =
    !!target &&
    shouldDockSceneMarkers(placement, isDesktop, isVisible, collapsed);

  useLayoutEffect(() => {
    const destination = docked ? target : inlineTarget.current;
    if (!destination) return;
    const scrollTop = contentRef.current?.scrollTop ?? 0;
    moveSceneMarkerDock(container, destination);
    if (contentRef.current) contentRef.current.scrollTop = scrollTop;
  }, [container, docked, target]);

  useLayoutEffect(() => () => container.remove(), [container]);

  function changePlacement(value: SceneMarkerPlacement) {
    setPlacement(value);
    saveSceneMarkerPlacement(value);
  }

  return (
    <>
      {docked && (
        <div className="scene-marker-dock-shortcut">
          <Button
            variant="link"
            onClick={() => target?.scrollIntoView({ block: "nearest" })}
          >
            Show markers below
          </Button>
          <Button variant="link" onClick={() => changePlacement("sidebar")}>
            Return to sidebar
          </Button>
        </div>
      )}
      <div ref={inlineTarget} />
      {createPortal(
        <section
          className={`scene-marker-dock${
            docked ? " scene-marker-dock-below" : ""
          }`}
          aria-label="Scene markers"
        >
          <div className="scene-marker-dock-heading">
            {docked && <span>Markers</span>}
            <ButtonGroup size="sm" aria-label="Marker placement">
              <Button
                variant="secondary"
                active={placement === "sidebar"}
                aria-pressed={placement === "sidebar"}
                onClick={() => changePlacement("sidebar")}
              >
                Sidebar
              </Button>
              <Button
                variant="secondary"
                active={placement === "below"}
                aria-pressed={placement === "below"}
                disabled={!isDesktop}
                title={!isDesktop ? "Available on wider screens" : undefined}
                onClick={() => changePlacement("below")}
              >
                Below player
              </Button>
            </ButtonGroup>
          </div>
          <div
            className="scene-marker-dock-content"
            data-scene-marker-scroll-container={docked ? "" : undefined}
            ref={contentRef}
          >
            {children}
          </div>
        </section>,
        container
      )}
    </>
  );
};

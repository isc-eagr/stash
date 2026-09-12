import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import ResizeObserver from "resize-observer-polyfill";
import TextUtils from "src/utils/text";
import type {
  IPlaygroundMetric,
  IPlaygroundPoint,
} from "./playgroundData_custom";
import { playgroundAxisMaximum } from "./playgroundData_custom";
import {
  hitTestPlaygroundPoints,
  playgroundPlotPadding,
  playgroundQuadrant,
  playgroundQuadrants,
  layoutPlaygroundPoints,
} from "./playgroundChart_custom";
import { playgroundMetallicOptions } from "./playgroundCatalog_custom";

interface IProps {
  points: IPlaygroundPoint[];
  xMetric: IPlaygroundMetric;
  yMetric: IPlaygroundMetric;
  xSplit: number;
  ySplit: number;
  spreadPoints: boolean;
}

export const PlaygroundChart: React.FC<IProps> = ({
  points,
  xMetric,
  yMetric,
  xSplit,
  ySplit,
  spreadPoints,
}) => {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);
  const [selected, setSelected] = useState<IPlaygroundPoint>();
  const [pinned, setPinned] = useState(false);
  const height = width < 600 ? 460 : 540;
  const xMax = playgroundAxisMaximum(points, "x", xMetric);
  const yMax = playgroundAxisMaximum(points, "y", yMetric);
  const positions = useMemo(
    () =>
      layoutPlaygroundPoints(
        points,
        width,
        height,
        xMax,
        yMax,
        spreadPoints ? { xMetric, yMetric, xSplit, ySplit } : undefined
      ),
    [
      points,
      width,
      height,
      xMax,
      yMax,
      spreadPoints,
      xMetric,
      yMetric,
      xSplit,
      ySplit,
    ]
  );
  const counts = useMemo(() => {
    const result = [0, 0, 0, 0];
    positions.forEach((point) => {
      result[playgroundQuadrant(point, xSplit, ySplit)] += 1;
    });
    return result;
  }, [positions, xSplit, ySplit]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width))
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    setSelected(undefined);
    setPinned(false);
  }, [positions]);

  useLayoutEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const scale = window.devicePixelRatio || 1;
    element.width = width * scale;
    element.height = height * scale;
    context.scale(scale, scale);
    const padding = playgroundPlotPadding;
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const px = (value: number) => padding.left + (value / xMax) * plotWidth;
    const py = (value: number) =>
      height - padding.bottom - (value / yMax) * plotHeight;
    playgroundQuadrants.forEach((quadrant, index) => {
      const left = index % 2 ? px(xSplit) : padding.left;
      const right = index % 2 ? width - padding.right : px(xSplit);
      const top = index >= 2 ? padding.top : py(ySplit);
      const bottom = index >= 2 ? py(ySplit) : height - padding.bottom;
      context.fillStyle = quadrant.fill;
      context.fillRect(left, top, right - left, bottom - top);
    });
    context.font = "12px sans-serif";
    context.lineWidth = 1;
    for (let tick = 0; tick <= 5; tick += 1) {
      const x = (xMax * tick) / 5;
      const y = (yMax * tick) / 5;
      context.strokeStyle = "rgba(160, 175, 192, 0.16)";
      context.beginPath();
      context.moveTo(px(x), padding.top);
      context.lineTo(px(x), height - padding.bottom);
      context.stroke();
      context.beginPath();
      context.moveTo(padding.left, py(y));
      context.lineTo(width - padding.right, py(y));
      context.stroke();
      context.fillStyle = "#b7c3d2";
      context.textAlign = "center";
      context.fillText(
        String(Number(x.toFixed(1))),
        px(x),
        height - padding.bottom + 20
      );
      context.textAlign = "right";
      context.fillText(
        String(Number(y.toFixed(1))),
        padding.left - 10,
        py(y) + 4
      );
    }
    context.setLineDash([5, 5]);
    context.strokeStyle = "#9eaabb";
    context.beginPath();
    context.moveTo(px(xSplit), padding.top);
    context.lineTo(px(xSplit), height - padding.bottom);
    context.stroke();
    context.beginPath();
    context.moveTo(padding.left, py(ySplit));
    context.lineTo(width - padding.right, py(ySplit));
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#d8bf83";
    context.textAlign = "center";
    context.fillText(xMetric.label, padding.left + plotWidth / 2, height - 8);
    context.save();
    context.translate(15, padding.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText(yMetric.label, 0, 0);
    context.restore();
    context.globalAlpha = 0.7;
    for (const point of positions) {
      context.fillStyle =
        playgroundQuadrants[playgroundQuadrant(point, xSplit, ySplit)].color;
      context.beginPath();
      context.arc(point.cx, point.cy, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    const selectedPosition = positions.find(
      (point) => point.entry.scene.id === selected?.entry.scene.id
    );
    if (selectedPosition) {
      context.strokeStyle = "#fff";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(selectedPosition.cx, selectedPosition.cy, 8, 0, Math.PI * 2);
      context.stroke();
    }
  }, [
    positions,
    width,
    height,
    xMax,
    yMax,
    xMetric,
    yMetric,
    xSplit,
    ySplit,
    selected,
  ]);

  function selectAt(event: React.MouseEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const hits = hitTestPlaygroundPoints(
      positions,
      ((event.clientX - bounds.left) * width) / bounds.width,
      ((event.clientY - bounds.top) * height) / bounds.height
    );
    setSelected(hits[0]);
    return hits.length > 0;
  }

  function metricLabel(metric: IPlaygroundMetric, value: number) {
    const choice = metric.choices?.find(
      (candidate) => candidate.value === value
    );
    return `${value}${choice ? ` · ${choice.label}` : ""}`;
  }

  return (
    <>
      <div className="playground-legend">
        {playgroundQuadrants.map((quadrant, index) => (
          <span key={quadrant.label}>
            <i style={{ background: quadrant.color }} />
            {quadrant.label} <strong>{counts[index].toLocaleString()}</strong>
          </span>
        ))}
      </div>
      <div
        className="playground-chart"
        ref={container}
        onMouseLeave={() => {
          if (!pinned) setSelected(undefined);
        }}
      >
        <canvas
          ref={canvas}
          style={{ width: "100%", height }}
          tabIndex={0}
          role="img"
          aria-describedby="playground-chart-help"
          aria-label={`${positions.length} scenes: ${xMetric.label} versus ${yMetric.label}. Arrow keys browse scenes; Enter pins details; Escape closes details.`}
          onMouseMove={(event) => {
            if (!pinned) selectAt(event);
          }}
          onClick={(event) => setPinned(selectAt(event))}
          onFocus={() => {
            if (!selected && positions.length) {
              setSelected(positions[0]);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSelected(undefined);
              setPinned(false);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              setPinned(true);
            }
            if (
              ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(
                event.key
              ) &&
              positions.length
            ) {
              event.preventDefault();
              const direction =
                event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
              const current = positions.findIndex(
                (point) => point.entry.scene.id === selected?.entry.scene.id
              );
              setSelected(
                positions[
                  (current + direction + positions.length) % positions.length
                ]
              );
              setPinned(true);
            }
          }}
        />
        {selected && (
          <div
            className={`playground-tooltip${pinned ? " is-pinned" : ""}`}
            style={
              selected.x > xMax / 2
                ? { left: "0.75rem", right: "auto" }
                : undefined
            }
            role={pinned ? "region" : "tooltip"}
            aria-label="Scene details"
          >
            <div className="playground-tooltip-toolbar">
              <span>Scene details</span>
              {pinned && (
                <Button
                  size="sm"
                  variant="link"
                  onClick={() => {
                    setPinned(false);
                    setSelected(undefined);
                  }}
                  aria-label="Close scene details"
                >
                  ×
                </Button>
              )}
            </div>
            {selected.entry.scene.paths.screenshot && (
              <img src={selected.entry.scene.paths.screenshot} alt="" />
            )}
            <Link
              to={`/scenes/${selected.entry.scene.id}`}
              className="playground-scene-title"
            >
              {selected.entry.scene.title || `Scene ${selected.entry.scene.id}`}
            </Link>
            <div className="text-muted">
              {[
                selected.entry.scene.studio?.name,
                selected.entry.scene.date,
                TextUtils.secondsAsTimeString(
                  selected.entry.scene.files[0]?.duration ?? 0
                ),
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <div className="playground-cast">
              {selected.entry.scene.performers
                .map((performer) => performer.name)
                .join(", ") || "No vatos listed"}
            </div>
            <dl>
              <dt>{xMetric.label}</dt>
              <dd>{metricLabel(xMetric, selected.x)}</dd>
              <dt>{yMetric.label}</dt>
              <dd>{metricLabel(yMetric, selected.y)}</dd>
              <dt>Overall rating</dt>
              <dd>
                {selected.entry.scene.rating100 ?? "Unrated"} ·{" "}
                {
                  playgroundMetallicOptions.find(
                    (option) => option.value === selected.entry.metallic
                  )?.label
                }
              </dd>
            </dl>
          </div>
        )}
      </div>
      <p
        className="stats-interaction-help"
        id="playground-chart-help"
        title={`${
          points.length - positions.length
        } omitted to avoid crowding. ${
          spreadPoints
            ? "Positions are spread; tooltips show exact scores. "
            : ""
        }Click to pin details. High includes the dividing value.`}
      >
        {positions.length.toLocaleString()} shown
        <span className="sr-only">
          . Click to pin details.{" "}
          {spreadPoints && "Positions are spread; tooltips show exact scores."}
        </span>
      </p>
    </>
  );
};

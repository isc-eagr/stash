import React from "react";
import { FormattedMessage } from "react-intl";
import { MultiSegmentLoopEditor } from "src/components/ScenePlayer/MultiSegmentLoopEditor";
import type { IMultiSegmentLoopController } from "src/components/ScenePlayer/useMultiSegmentLoop_custom";
import type { IMultiSegmentLoopPresets } from "src/components/ScenePlayer/useMultiSegmentLoopPresets_custom";

// Scene page Loop tab: edits the loop of the scene's current player.
interface ISceneLoopPanelProps {
  loop: IMultiSegmentLoopController;
  presets: IMultiSegmentLoopPresets;
  onSeek: (seconds: number) => void;
}

export const SceneLoopPanel: React.FC<ISceneLoopPanelProps> = ({
  loop,
  presets,
  onSeek,
}) => (
  <div className="scene-loop-panel">
    {loop.ready ? (
      <MultiSegmentLoopEditor loop={loop} presets={presets} onSeek={onSeek} />
    ) : (
      <div className="text-center text-muted py-4">
        <FormattedMessage id="multi_segment_loop.no_player" />
      </div>
    )}
  </div>
);

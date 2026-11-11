import React, { useMemo, useState } from "react";
import { Dropdown, Form } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { ModalComponent } from "src/components/Shared/Modal";
import { useToast } from "src/hooks/Toast";
import { releaseMutationCacheRefreshCustom } from "src/core/sceneReleaseCache_custom";
import { getSceneReleasePlaybackContextCustom } from "./sceneReleasePlaybackContext_custom";
import {
  ISceneOwnerCopyKindsCustom,
  ISceneOwnerCopySourceCustom,
  ISceneOwnerCopyViewCustom,
  sceneOwnerCopyCountsCustom,
  sceneOwnerCopyHasItemsCustom,
  sceneOwnerCopyItemsInputCustom,
  sceneOwnerCopySourcesCustom,
  sceneOwnerCopyToastCustom,
  sceneOwnerToScrapedCustom,
} from "./sceneOwnerCopyFields_custom";

interface IProps {
  // The full scene, with every release.
  scene: GQL.SceneDataFragment;
  // The release being edited; none while editing the scene.
  releaseId?: string;
  // Opens the field review with the source converted to the scrape shape.
  onReviewFields: (scraped: GQL.ScrapedScene) => void;
  onBusy?: (busy: boolean) => void;
}

async function coverDataURL(url?: string | null): Promise<string | undefined> {
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return;
  }
}

export const SceneOwnerCopyMenu: React.FC<IProps> = ({
  scene,
  releaseId,
  onReviewFields,
  onBusy,
}) => {
  const Toast = useToast();
  const [copyItems] = GQL.useSceneOwnerCopyItemsMutation(
    releaseMutationCacheRefreshCustom
  );
  const [source, setSource] = useState<ISceneOwnerCopySourceCustom>();
  const [fields, setFields] = useState(true);
  const [kinds, setKinds] = useState<ISceneOwnerCopyKindsCustom>({
    markers: false,
    negative_markers: false,
    loop_presets: false,
  });
  const [running, setRunning] = useState(false);

  const sources = useMemo(
    () => sceneOwnerCopySourcesCustom(scene, releaseId),
    [scene, releaseId]
  );

  const view = useMemo(() => {
    if (!source) return;
    return getSceneReleasePlaybackContextCustom(
      scene,
      source.owner.releaseId ?? null
    )?.scene as ISceneOwnerCopyViewCustom | undefined;
  }, [scene, source]);

  const counts = view ? sceneOwnerCopyCountsCustom(view) : undefined;

  if (!sources.length) return null;

  function open(s: ISceneOwnerCopySourceCustom) {
    setSource(s);
    setFields(true);
    setKinds({ markers: false, negative_markers: false, loop_presets: false });
  }

  async function onConfirm() {
    if (!source || !view) return;
    setRunning(true);
    onBusy?.(true);
    try {
      if (sceneOwnerCopyHasItemsCustom(kinds)) {
        const result = await copyItems({
          variables: {
            input: sceneOwnerCopyItemsInputCustom(
              scene.id,
              source.owner,
              releaseId ? { releaseId } : { sceneId: scene.id },
              kinds
            ),
          },
        });
        const copied = result.data?.sceneOwnerCopyItems;
        Toast.success(
          sceneOwnerCopyToastCustom(
            copied ?? { markers: 0, negative_markers: 0, loop_presets: 0 }
          )
        );
      }
      if (fields) {
        const scraped = sceneOwnerToScrapedCustom(view, !!releaseId);
        scraped.image = await coverDataURL(view.paths?.screenshot);
        onReviewFields(scraped);
      }
      setSource(undefined);
    } catch (e) {
      Toast.error(e);
    } finally {
      setRunning(false);
      onBusy?.(false);
    }
  }

  function renderKind(
    key: keyof ISceneOwnerCopyKindsCustom,
    label: string,
    count: number
  ) {
    return (
      <Form.Check
        id={`owner-copy-${key}`}
        key={key}
        type="checkbox"
        label={`${label} (${count})`}
        checked={kinds[key] && count > 0}
        disabled={count === 0 || running}
        onChange={(e) => setKinds({ ...kinds, [key]: e.target.checked })}
      />
    );
  }

  return (
    <>
      <Dropdown>
        <Dropdown.Toggle variant="secondary" id="scene-owner-copy-toggle">
          Copy from…
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {sources.map((s) => (
            <Dropdown.Item key={s.key} onClick={() => open(s)}>
              {s.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
      <ModalComponent
        show={!!source && !!counts}
        header={`Copy from ${source?.label ?? ""}`}
        accept={{
          text: "Copy",
          onClick: onConfirm,
        }}
        cancel={{ onClick: () => setSource(undefined) }}
        disabled={!fields && !sceneOwnerCopyHasItemsCustom(kinds)}
        isRunning={running}
      >
        {counts && (
          <>
            <Form.Check
              id="owner-copy-fields"
              type="checkbox"
              label="Fields (reviewed before filling the form)"
              checked={fields}
              disabled={running}
              onChange={(e) => setFields(e.target.checked)}
            />
            {renderKind("markers", "Markers", counts.markers)}
            {renderKind(
              "negative_markers",
              "Skip ranges",
              counts.negative_markers
            )}
            {renderKind("loop_presets", "Loop presets", counts.loop_presets)}
            <p className="text-muted small mt-3 mb-0">
              Markers, skip ranges, and loop presets are copied right away.
            </p>
          </>
        )}
      </ModalComponent>
    </>
  );
};

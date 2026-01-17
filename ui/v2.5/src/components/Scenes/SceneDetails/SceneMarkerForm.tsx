import React, { useEffect, useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { useFormik } from "formik";
import * as yup from "yup";
import * as GQL from "src/core/generated-graphql";
import {
  useSceneMarkerCreate,
  useSceneMarkerUpdate,
  useSceneMarkerDestroy,
  useFindScene,
} from "src/core/StashService";
import { DurationInput } from "src/components/Shared/DurationInput";
import { MarkerTitleSuggest } from "src/components/Shared/Select";
import { getPlayerPosition, getPlayer } from "src/components/ScenePlayer/util";
import { useToast } from "src/hooks/Toast";
import isEqual from "lodash-es/isEqual";
import { formikUtils } from "src/utils/form";
import { yupFormikValidate } from "src/utils/yup";
import { Tag, TagSelect } from "src/components/Tags/TagSelect";
import Select from "react-select";
import { Icon } from "src/components/Shared/Icon";
import { faArrowDown, faArrowUp } from "@fortawesome/free-solid-svg-icons";

interface IPerformer {
  id: string;
  name: string;
  alias_list: string[];
  disambiguation?: string | null;
}

interface ISceneMarkerForm {
  sceneID: string;
  marker?: GQL.SceneMarkerDataFragment;
  onClose: () => void;
}

export const SceneMarkerForm: React.FC<ISceneMarkerForm> = ({
  sceneID,
  marker,
  onClose,
}) => {
  const intl = useIntl();

  const [sceneMarkerCreate] = useSceneMarkerCreate();
  const [sceneMarkerUpdate] = useSceneMarkerUpdate();
  const [sceneMarkerDestroy] = useSceneMarkerDestroy();
  const Toast = useToast();

  const [primaryTag, setPrimaryTag] = useState<Tag>();
  const [tags, setTags] = useState<Tag[]>([]);
  const [topPerformers, setTopPerformers] = useState<IPerformer[]>([]);
  const [bottomPerformers, setBottomPerformers] = useState<IPerformer[]>([]);

  // Fetch scene to get available performers
  const { data: sceneData } = useFindScene(sceneID);
  const scenePerformers = useMemo(() => {
    return (
      sceneData?.findScene?.performers?.map((p) => ({
        id: p.id,
        name: p.name,
        alias_list: p.alias_list ?? [],
        disambiguation: p.disambiguation,
      })) ?? []
    );
  }, [sceneData]);

  const isNew = marker === undefined;

  const schema = yup.object({
    title: yup.string().ensure(),
    seconds: yup.number().min(0).required(),
    end_seconds: yup
      .number()
      .min(0)
      .nullable()
      .defined()
      .test(
        "is-greater-than-seconds",
        intl.formatMessage({ id: "validation.end_time_before_start_time" }),
        function (value) {
          return value === null || value >= this.parent.seconds;
        }
      ),
    primary_tag_id: yup.string().required(),
    tag_ids: yup.array(yup.string().required()).defined(),
    top_performer_ids: yup.array(yup.string().required()).defined(),
    bottom_performer_ids: yup.array(yup.string().required()).defined(),
  });

  // useMemo to only run getPlayerPosition when the input marker actually changes
  const initialValues = useMemo(
    () => ({
      title: marker?.title ?? "",
      seconds: marker?.seconds ?? Math.round(getPlayerPosition() ?? 0),
      end_seconds: marker?.end_seconds ?? null,
      primary_tag_id: marker?.primary_tag.id ?? "",
      tag_ids: marker?.tags.map((tag) => tag.id) ?? [],
      top_performer_ids: marker?.top_performers?.map((p) => p.id) ?? [],
      bottom_performer_ids: marker?.bottom_performers?.map((p) => p.id) ?? [],
    }),
    [marker]
  );

  type InputValues = yup.InferType<typeof schema>;

  const formik = useFormik<InputValues>({
    initialValues,
    enableReinitialize: true,
    validate: yupFormikValidate(schema),
    onSubmit: (values) => onSave(schema.cast(values)),
  });

  function onSetPrimaryTag(item: Tag) {
    setPrimaryTag(item);
    formik.setFieldValue("primary_tag_id", item.id);
  }

  function onSetTags(items: Tag[]) {
    setTags(items);
    formik.setFieldValue(
      "tag_ids",
      items.map((item) => item.id)
    );
  }

  function onSetTopPerformers(items: IPerformer[]) {
    setTopPerformers(items);
    formik.setFieldValue(
      "top_performer_ids",
      items.map((item) => item.id)
    );
  }

  function onSetBottomPerformers(items: IPerformer[]) {
    setBottomPerformers(items);
    formik.setFieldValue(
      "bottom_performer_ids",
      items.map((item) => item.id)
    );
  }

  useEffect(() => {
    setPrimaryTag(
      marker?.primary_tag
        ? { ...marker.primary_tag, aliases: [], stash_ids: [] }
        : undefined
    );
  }, [marker?.primary_tag]);

  useEffect(() => {
    setTags(
      marker?.tags.map((t) => ({
        ...t,
        aliases: [],
        stash_ids: [],
      })) ?? []
    );
  }, [marker?.tags]);

  useEffect(() => {
    setTopPerformers(
      marker?.top_performers?.map((p) => ({
        id: p.id,
        name: p.name,
        alias_list: p.alias_list ?? [],
        disambiguation: p.disambiguation,
      })) ?? []
    );
  }, [marker?.top_performers]);

  useEffect(() => {
    setBottomPerformers(
      marker?.bottom_performers?.map((p) => ({
        id: p.id,
        name: p.name,
        alias_list: p.alias_list ?? [],
        disambiguation: p.disambiguation,
      })) ?? []
    );
  }, [marker?.bottom_performers]);

  async function onSave(input: InputValues) {
    try {
      if (isNew) {
        await sceneMarkerCreate({
          variables: {
            scene_id: sceneID,
            ...input,
            // undefined means setting to null, not omitting the field
            end_seconds: input.end_seconds ?? null,
          },
        });
      } else {
        await sceneMarkerUpdate({
          variables: {
            id: marker.id,
            scene_id: sceneID,
            ...input,
            // undefined means setting to null, not omitting the field
            end_seconds: input.end_seconds ?? null,
          },
        });
      }
    } catch (e) {
      Toast.error(e);
    } finally {
      onClose();
    }
  }

  async function onDelete() {
    if (isNew) return;

    try {
      await sceneMarkerDestroy({ variables: { id: marker.id } });
    } catch (e) {
      Toast.error(e);
    } finally {
      onClose();
    }
  }

  const splitProps = {
    labelProps: {
      column: true,
      sm: 3,
    },
    fieldProps: {
      sm: 9,
    },
  };
  const fullWidthProps = {
    labelProps: {
      column: true,
      sm: 3,
      xl: 12,
    },
    fieldProps: {
      sm: 9,
      xl: 12,
    },
  };
  const { renderField } = formikUtils(intl, formik, splitProps);

  function renderTitleField() {
    const title = intl.formatMessage({ id: "title" });
    const control = (
      <MarkerTitleSuggest
        initialMarkerTitle={formik.values.title}
        onChange={(v) => formik.setFieldValue("title", v)}
      />
    );

    return renderField("title", title, control);
  }

  function renderPrimaryTagField() {
    const title = intl.formatMessage({ id: "primary_tag" });
    const control = (
      <>
        <TagSelect
          onSelect={(t) => onSetPrimaryTag(t[0])}
          values={primaryTag ? [primaryTag] : []}
          hoverPlacement="right"
        />
        {formik.touched.primary_tag_id && (
          <Form.Control.Feedback type="invalid">
            {formik.errors.primary_tag_id}
          </Form.Control.Feedback>
        )}
      </>
    );

    return renderField("primary_tag_id", title, control);
  }

  function renderTimeField() {
    const { error } = formik.getFieldMeta("seconds");

    const title = intl.formatMessage({ id: "time" });
    const control = (
      <DurationInput
        value={formik.values.seconds}
        setValue={(v) => formik.setFieldValue("seconds", v)}
        onReset={() =>
          formik.setFieldValue("seconds", getPlayerPosition() ?? 0)
        }
        onSeekTo={() => {
          const player = getPlayer();
          if (player && formik.values.seconds !== null) {
            player.currentTime(formik.values.seconds);
          }
        }}
        error={error}
      />
    );

    return renderField("seconds", title, control);
  }

  function renderEndTimeField() {
    const { error } = formik.getFieldMeta("end_seconds");

    const title = intl.formatMessage({ id: "time_end" });
    const control = (
      <>
        <DurationInput
          value={formik.values.end_seconds}
          setValue={(v) => formik.setFieldValue("end_seconds", v ?? null)}
          onReset={() =>
            formik.setFieldValue("end_seconds", getPlayerPosition() ?? 0)
          }
          onSeekTo={() => {
            const player = getPlayer();
            if (player && formik.values.end_seconds !== null) {
              player.currentTime(formik.values.end_seconds);
            }
          }}
          error={error}
        />
        {formik.touched.end_seconds && formik.errors.end_seconds && (
          <Form.Control.Feedback type="invalid">
            {formik.errors.end_seconds}
          </Form.Control.Feedback>
        )}
      </>
    );

    return renderField("end_seconds", title, control);
  }

  function renderTagsField() {
    const title = intl.formatMessage({ id: "tags" });
    const control = (
      <TagSelect
        isMulti
        onSelect={onSetTags}
        values={tags}
        hoverPlacement="right"
      />
    );

    return renderField("tag_ids", title, control, fullWidthProps);
  }

  function renderPerformersField() {
    if (scenePerformers.length === 0) return null;

    // Create options from scene performers only
    const performerOptions = scenePerformers.map((p) => ({
      value: p.id,
      label: p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name,
    }));

    // Top performers
    const topTitle = intl.formatMessage({
      id: "top_performers",
      defaultMessage: "Top Performers",
    });

    const selectedTopValues = topPerformers.map((p) => ({
      value: p.id,
      label: p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name,
    }));

    const topControl = (
      <div className="d-flex align-items-center">
        <Icon icon={faArrowUp} className="text-success mr-2" title="Top" />
        <div className="flex-grow-1">
          <Select
            classNamePrefix="react-select"
            isMulti
            options={performerOptions}
            value={selectedTopValues}
            onChange={(selected) => {
              const selectedPerformers = (selected ?? []).map((opt) => {
                const found = scenePerformers.find((p) => p.id === opt.value);
                return (
                  found ?? { id: opt.value, name: opt.label, alias_list: [] }
                );
              });
              onSetTopPerformers(selectedPerformers);
            }}
            placeholder={intl.formatMessage({
              id: "actions.select_performers",
            })}
            menuPortalTarget={document.body}
            styles={{
              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
            }}
          />
        </div>
      </div>
    );

    // Bottom performers
    const bottomTitle = intl.formatMessage({
      id: "bottom_performers",
      defaultMessage: "Bottom Performers",
    });

    const selectedBottomValues = bottomPerformers.map((p) => ({
      value: p.id,
      label: p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name,
    }));

    const bottomControl = (
      <div className="d-flex align-items-center">
        <Icon icon={faArrowDown} className="text-info mr-2" title="Bottom" />
        <div className="flex-grow-1">
          <Select
            classNamePrefix="react-select"
            isMulti
            options={performerOptions}
            value={selectedBottomValues}
            onChange={(selected) => {
              const selectedPerformers = (selected ?? []).map((opt) => {
                const found = scenePerformers.find((p) => p.id === opt.value);
                return (
                  found ?? { id: opt.value, name: opt.label, alias_list: [] }
                );
              });
              onSetBottomPerformers(selectedPerformers);
            }}
            placeholder={intl.formatMessage({
              id: "actions.select_performers",
            })}
            menuPortalTarget={document.body}
            styles={{
              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
            }}
          />
        </div>
      </div>
    );

    return (
      <>
        {renderField("top_performer_ids", topTitle, topControl, fullWidthProps)}
        {renderField(
          "bottom_performer_ids",
          bottomTitle,
          bottomControl,
          fullWidthProps
        )}
      </>
    );
  }

  return (
    <Form noValidate onSubmit={formik.handleSubmit}>
      <div className="form-container px-3">
        {renderTitleField()}
        {renderPrimaryTagField()}
        {renderTimeField()}
        {renderEndTimeField()}
        {renderTagsField()}
        {renderPerformersField()}
      </div>
      <div className="buttons-container px-3">
        <div className="d-flex">
          <Button
            variant="primary"
            disabled={(!isNew && !formik.dirty) || !isEqual(formik.errors, {})}
            onClick={() => formik.submitForm()}
          >
            <FormattedMessage id="actions.save" />
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            className="ml-2"
          >
            <FormattedMessage id="actions.cancel" />
          </Button>
          {!isNew && (
            <Button
              variant="danger"
              className="ml-auto"
              onClick={() => onDelete()}
            >
              <FormattedMessage id="actions.delete" />
            </Button>
          )}
        </div>
      </div>
    </Form>
  );
};

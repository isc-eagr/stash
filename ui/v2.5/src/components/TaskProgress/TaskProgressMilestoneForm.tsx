import React, { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import Select from "react-select";
import type {
  TaskProgressMilestoneDataFragment as Milestone,
  TaskProgressTrackerDataFragment as Tracker,
} from "src/core/generated-graphql";
import { useProgressText } from "./progressView_custom";

export interface IMilestoneFormValues {
  name: string;
  target_date: string;
  goal_per_day: number;
  tracker_ids: string[];
  members_changed: boolean;
}

type IMilestoneMembership = Pick<Milestone, "id" | "name" | "tracker_ids">;

interface IProps {
  milestone?: Milestone;
  milestones: readonly IMilestoneMembership[];
  trackers: readonly Tracker[];
  busy: boolean;
  onClose: () => void;
  onSave: (values: IMilestoneFormValues) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
}

export const TaskProgressMilestoneForm: React.FC<IProps> = ({
  milestone,
  milestones,
  trackers,
  busy,
  onClose,
  onSave,
  onDelete,
}) => {
  const t = useProgressText();
  const [name, setName] = useState(milestone?.name ?? "");
  const [targetDate, setTargetDate] = useState(milestone?.target_date ?? "");
  const [goal, setGoal] = useState(milestone?.goal_per_day ?? 0);
  const [trackerIDs, setTrackerIDs] = useState<string[]>(
    milestone?.tracker_ids ?? []
  );
  const [membersChanged, setMembersChanged] = useState(false);
  const options = trackers.map((tracker) => ({
    value: tracker.id,
    label: tracker.title,
  }));
  const selected = options.filter((option) =>
    trackerIDs.includes(option.value)
  );
  const milestonesByTracker = new Map(
    trackers.map((tracker) => [
      tracker.id,
      milestones.filter((item) => item.tracker_ids.includes(tracker.id)),
    ])
  );
  const milestoneColor = (id: string) => {
    const hash = [...id].reduce(
      (value, character) => value + character.charCodeAt(0),
      0
    );
    const colors = [
      "#563d7c",
      "#176b78",
      "#8a4a20",
      "#754550",
      "#356341",
      "#3c568d",
      "#765b20",
      "#675078",
    ];
    return colors[hash % colors.length];
  };

  return (
    <Modal show onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {t(milestone ? "Edit milestone" : "Create milestone")}
        </Modal.Title>
      </Modal.Header>
      <Form
        onSubmit={async (event) => {
          event.preventDefault();
          const hiddenIDs =
            membersChanged && selected.length === 0
              ? []
              : (milestone?.tracker_ids ?? []).filter(
                  (id) => !options.some((option) => option.value === id)
                );
          const saved = await onSave({
            name: name.trim(),
            target_date: targetDate,
            goal_per_day: goal,
            tracker_ids: [
              ...selected.map((option) => option.value),
              ...hiddenIDs,
            ],
            members_changed: membersChanged,
          });
          if (saved) onClose();
        }}
      >
        <Modal.Body>
          <Form.Group controlId="milestone-name">
            <Form.Label>{t("Name")}</Form.Label>
            <Form.Control
              required
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="milestone-trackers">
            <Form.Label>{t("Trackers")}</Form.Label>
            <Select
              inputId="milestone-trackers"
              classNamePrefix="react-select"
              isMulti
              isClearable
              closeMenuOnSelect={false}
              closeMenuOnScroll={false}
              captureMenuScroll
              menuPortalTarget={document.body}
              menuPosition="fixed"
              menuPlacement="auto"
              menuShouldScrollIntoView={false}
              maxMenuHeight={Math.min(360, window.innerHeight * 0.6)}
              options={options}
              value={selected}
              formatOptionLabel={(option, { context }) => {
                if (context !== "menu") return option.label;
                const assignedMilestones =
                  milestonesByTracker.get(option.value) ?? [];
                return (
                  <div className="milestone-tracker-option">
                    <span>{option.label}</span>
                    {assignedMilestones.length > 0 && (
                      <span className="milestone-membership-pills">
                        {assignedMilestones.map((item) => (
                          <span
                            className="milestone-membership-pill"
                            key={item.id}
                            style={{ backgroundColor: milestoneColor(item.id) }}
                          >
                            {item.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                );
              }}
              onChange={(values) => {
                setMembersChanged(true);
                setTrackerIDs(values.map((value) => value.value));
              }}
              placeholder={t("Search trackers…")}
            />
          </Form.Group>
          <div className="milestone-form-optional">
            <Form.Group controlId="milestone-target-date">
              <Form.Label>{t("Target date")}</Form.Label>
              <Form.Control
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="milestone-goal">
              <Form.Label>{t("Daily goal")}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={goal || ""}
                placeholder={t("Optional")}
                onChange={(event) =>
                  setGoal(
                    Math.max(0, Math.floor(Number(event.target.value) || 0))
                  )
                }
              />
            </Form.Group>
          </div>
        </Modal.Body>
        <Modal.Footer>
          {onDelete && (
            <Button
              className="mr-auto"
              variant="outline-danger"
              disabled={busy}
              onClick={async () => {
                if (
                  window.confirm(
                    t("Delete this milestone? Its trackers will remain.")
                  ) &&
                  (await onDelete())
                ) {
                  onClose();
                }
              }}
            >
              {t("Delete")}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {t(busy ? "Saving…" : "Save")}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

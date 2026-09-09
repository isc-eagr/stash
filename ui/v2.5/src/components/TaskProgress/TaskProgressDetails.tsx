import React, { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { Alert, Button, Modal, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import { Tracker, itemLabels, useProgressText } from "./progressView_custom";

export interface IDetailSelection {
  tracker: Tracker;
  date?: string;
  itemType?: string;
}
type EventItem = Pick<
  GQL.TaskProgressEvent,
  "id" | "item_type" | "item_id" | "item_label" | "url"
> &
  Partial<Pick<GQL.TaskProgressEvent, "event_type" | "occurred_at">>;

export const TaskProgressDetails: React.FC<{
  selection: IDetailSelection;
  onClose: () => void;
}> = ({ selection, onClose }) => {
  const t = useProgressText();
  const client = useApolloClient();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [page, setPage] = useState({ after: "0", offset: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(undefined);
    const load = async () => {
      try {
        const result = selection.date
          ? (
              await client.query<GQL.TaskProgressEventsQuery>({
                query: GQL.TaskProgressEventsDocument,
                variables: {
                  tracker_id: selection.tracker.id,
                  date: selection.date,
                  after_id: page.after,
                },
                fetchPolicy: "network-only",
              })
            ).data.taskProgressEvents
          : (
              await client.query<GQL.TaskProgressPendingItemsQuery>({
                query: GQL.TaskProgressPendingItemsDocument,
                variables: {
                  tracker_id: selection.tracker.id,
                  item_type: selection.itemType,
                  offset: page.offset,
                },
                fetchPolicy: "network-only",
              })
            ).data.taskProgressPendingItems;
        if (current) {
          setEvents((old) => [...old, ...result.events]);
          setHasMore(result.has_more);
        }
      } catch (e) {
        if (current) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [client, selection, page, retry]);
  return (
    <Modal
      show
      onHide={onClose}
      size="lg"
      dialogClassName="task-progress-details-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {selection.tracker.title} ·{" "}
          {selection.date ?? t(itemLabels[selection.itemType ?? "scene"])}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Table responsive size="sm">
          <thead>
            <tr>
              <th>{t("Item")}</th>
              <th>{t("Type")}</th>
              <th>{t("Activity")}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.url ? (
                    <Link to={e.url}>{e.item_label || `#${e.item_id}`}</Link>
                  ) : (
                    e.item_label || t("New baseline")
                  )}
                </td>
                <td>{t(itemLabels[e.item_type] ?? "Baseline")}</td>
                <td>
                  {e.event_type
                    ? t(
                        e.event_type === "COMPLETED"
                          ? "Completed"
                          : e.event_type === "INCOMING"
                          ? "Incoming / reopened"
                          : "New baseline"
                      )
                    : t("Remaining")}
                  {e.occurred_at && (
                    <small className="d-block text-muted">
                      {new Date(e.occurred_at).toLocaleTimeString(undefined, {
                        timeZone: "America/Mexico_City",
                      })}
                    </small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!loading && !events.length && !error && (
          <p>{t(selection.date ? "No activity." : "No remaining items.")}</p>
        )}
        {loading && <p role="status">{t("Loading…")}</p>}
        {error && (
          <Alert variant="danger" role="alert">
            {error}{" "}
            <Button onClick={() => setRetry((n) => n + 1)}>{t("Retry")}</Button>
          </Alert>
        )}
        {hasMore && !error && (
          <Button
            disabled={loading}
            onClick={() =>
              setPage({
                after: events[events.length - 1]?.id ?? "0",
                offset: events.length,
              })
            }
          >
            {t("Load more")}
          </Button>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("Close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

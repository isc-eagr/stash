import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, ButtonGroup } from "react-bootstrap";
import { Helmet } from "react-helmet";
import {
  faExternalLinkAlt,
  faFilm,
  faSyncAlt,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { getPlatformURL } from "src/core/createClient";
import { useTitleProps } from "src/hooks/title";
import "./GEVILatest_custom.scss";

type GEVIItemKind = "scene" | "performer";

type GEVIItem = {
  kind: GEVIItemKind;
  id: string;
  title: string;
  studio?: string;
  source_label?: string;
  url: string;
  image_url: string;
  image_path?: string;
  thumb_url?: string;
  performers?: string[];
  date?: string;
  first_seen_at: string;
  last_seen_at: string;
};

type GEVICache = {
  updated_at: string;
  scenes: GEVIItem[];
  performers: GEVIItem[];
  last_error?: string;
};

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function imageSource(item: GEVIItem) {
  if (item.image_path) {
    return getPlatformURL(
      `gevi-latest-data/image/${item.image_path}`
    ).toString();
  }
  return item.image_url;
}

async function fetchGEVILatest(force: boolean) {
  const url = getPlatformURL(
    force ? "gevi-latest-data/refresh" : "gevi-latest-data"
  );
  const response = await fetch(url.toString(), {
    method: force ? "POST" : "GET",
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // ignore non-JSON error responses
    }
    throw new Error(message);
  }

  return (await response.json()) as GEVICache;
}

const GEVIItemCard: React.FC<{ item: GEVIItem }> = ({ item }) => {
  const meta = useMemo(() => {
    if (item.kind === "scene") {
      return [item.studio, item.date ? formatDate(item.date) : undefined]
        .filter(Boolean)
        .join(" - ");
    }

    return [item.source_label, `Seen ${formatDate(item.first_seen_at)}`]
      .filter(Boolean)
      .join(" - ");
  }, [item]);

  return (
    <a
      className={`gevi-latest-card gevi-latest-card--${item.kind}`}
      href={item.url}
      rel="noreferrer"
      target="_blank"
    >
      <span className="gevi-latest-card__media">
        <img alt="" loading="lazy" src={imageSource(item)} />
      </span>
      <span className="gevi-latest-card__body">
        <span className="gevi-latest-card__title">{item.title}</span>
        {!!meta && <span className="gevi-latest-card__meta">{meta}</span>}
        {!!item.performers?.length && (
          <span className="gevi-latest-card__performers">
            {item.performers.join(", ")}
          </span>
        )}
      </span>
      <span className="gevi-latest-card__source">
        <Icon icon={faExternalLinkAlt} />
      </span>
    </a>
  );
};

const GEVILatest: React.FC = () => {
  const titleProps = useTitleProps("GEVI Latest");
  const [data, setData] = useState<GEVICache>();
  const [activeKind, setActiveKind] = useState<GEVIItemKind>("scene");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async (force: boolean) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(undefined);

    try {
      setData(await fetchGEVILatest(force));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const items = activeKind === "scene" ? data?.scenes : data?.performers;

  return (
    <div className="gevi-latest-page">
      <Helmet {...titleProps} />
      <header className="gevi-latest-header">
        <div>
          <h1>GEVI Latest</h1>
          {!!data?.updated_at && (
            <div className="gevi-latest-updated">
              Updated {formatDate(data.updated_at)}
            </div>
          )}
        </div>
        <div className="gevi-latest-actions">
          <ButtonGroup aria-label="GEVI latest type">
            <Button
              active={activeKind === "scene"}
              onClick={() => setActiveKind("scene")}
              variant="secondary"
            >
              <Icon icon={faFilm} />
              <span>Scenes</span>
            </Button>
            <Button
              active={activeKind === "performer"}
              onClick={() => setActiveKind("performer")}
              variant="secondary"
            >
              <Icon icon={faUser} />
              <span>Vatos</span>
            </Button>
          </ButtonGroup>
          <Button
            disabled={refreshing}
            onClick={() => void load(true)}
            title="Refresh"
            variant="primary"
          >
            <Icon icon={faSyncAlt} />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </Button>
        </div>
      </header>

      {!!error && <div className="gevi-latest-error">{error}</div>}
      {!!data?.last_error && (
        <div className="gevi-latest-warning">{data.last_error}</div>
      )}

      {loading ? (
        <LoadingIndicator />
      ) : (
        <div className={`gevi-latest-grid gevi-latest-grid--${activeKind}`}>
          {items?.map((item) => (
            <GEVIItemCard item={item} key={`${item.kind}-${item.id}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default GEVILatest;

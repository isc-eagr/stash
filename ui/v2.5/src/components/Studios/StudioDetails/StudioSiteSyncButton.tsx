// CUSTOM: Studio site sync button for studios with a supported site.
import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { ModalComponent } from "src/components/Shared/Modal";
import { useStudioSiteSyncMutation } from "src/core/generated-graphql";
import { useToast } from "src/hooks/Toast";

interface IStudioSiteSyncButtonProps {
  studioID: string;
  site: string;
}

export const StudioSiteSyncButton: React.FC<IStudioSiteSyncButtonProps> = ({
  studioID,
  site,
}) => {
  const Toast = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [syncSite, { loading }] = useStudioSiteSyncMutation();

  async function onSync() {
    setShowConfirm(false);
    try {
      await syncSite({ variables: { studio_id: studioID } });
      Toast.success(`${site} sync queued. Follow it in Settings > Tasks.`);
    } catch (e) {
      Toast.error(e);
    }
  }

  return (
    <div>
      <Button
        variant="secondary"
        disabled={loading}
        onClick={() => setShowConfirm(true)}
      >
        Sync from {site}…
      </Button>
      <ModalComponent
        show={showConfirm}
        icon={faDownload}
        header={`Sync from ${site}`}
        accept={{ text: "Sync", onClick: onSync }}
        cancel={{ onClick: () => setShowConfirm(false), variant: "secondary" }}
      >
        <p>
          Fills missing codes, titles, dates, details and links from {site},
          picks up missing pictures and creates galleries. Values already set
          are kept.
        </p>
      </ModalComponent>
    </div>
  );
};

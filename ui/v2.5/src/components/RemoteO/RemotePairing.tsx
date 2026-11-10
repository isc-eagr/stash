import React, { useState } from "react";
import { useApolloClient } from "@apollo/client";
import { Button, Modal, Alert, Form } from "react-bootstrap";
import { QRCodeSVG } from "qrcode.react";
import * as GQL from "src/core/generated-graphql";
import { baseURL } from "src/core/createClient";
import { remotePairingURLCustom } from "./remotePlayback_custom";

export const RemotePairing: React.FC<{
  playerId: string;
  error: string;
  confirmation: string;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}> = ({ playerId, error, confirmation, enabled, setEnabled }) => {
  const client = useApolloClient();
  const [show, setShow] = useState(false);
  const [url, setUrl] = useState("");
  const [pairError, setPairError] = useState("");
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState(
    () =>
      localStorage.getItem("stash.remoteO.address") || window.location.origin
  );
  const [token, setToken] = useState("");
  async function create() {
    setShow(true);
    setBusy(true);
    setPairError("");
    setUrl("");
    try {
      const result =
        await client.mutate<GQL.RemotePlaybackPairingCreateMutation>({
          mutation: GQL.RemotePlaybackPairingCreateDocument,
          variables: { player_id: playerId },
        });
      const code = result.data?.remotePlaybackPairingCreate;
      if (!code) throw new Error("Unable to create pairing code.");
      setToken(code);
      setUrl(remotePairingURLCustom(address, baseURL, code));
    } catch (err) {
      setPairError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => void create()}>
        Pair phone for O
      </Button>
      {confirmation && (
        <small className="ml-2" role="status">
          {confirmation}
        </small>
      )}
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Pair your phone</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Check
            type="switch"
            id={`remote-player-enabled-${playerId}`}
            label="Enable remote control for this tab"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <p>
            Scan once to remember this browser. Open the remote page on your
            phone anytime; scene changes reconnect automatically.
          </p>
          <p>
            If several tabs are open, enable remote control only in the tab you
            want to use.
          </p>
          {error && <Alert variant="warning">{error}</Alert>}
          {pairError && <Alert variant="danger">{pairError}</Alert>}
          {busy && <p>Creating code…</p>}
          <Form.Group controlId="remote-lan-address">
            <Form.Label>Server address reachable from your phone</Form.Label>
            <Form.Control
              value={address}
              placeholder="http://192.168.1.10:9999"
              onChange={(event) => {
                setAddress(event.target.value);
                localStorage.setItem(
                  "stash.remoteO.address",
                  event.target.value
                );
                setUrl(
                  remotePairingURLCustom(event.target.value, baseURL, token)
                );
              }}
            />
          </Form.Group>
          {token && !url && (
            <Alert variant="warning">
              Enter the full server address, including http:// or https:// and
              its port.
            </Alert>
          )}
          {url && (
            <>
              <div className="text-center">
                <QRCodeSVG value={url} size={240} includeMargin />
              </div>
              <p className="mt-3">
                This code expires in five minutes and works once. Sign into
                Stash on your phone if prompted.
              </p>
              <p>
                Replace localhost or 127.0.0.1 above with the server’s LAN
                address. Your phone and player must reach the same Stash
                instance.
              </p>
              <a href={url} style={{ overflowWrap: "anywhere" }}>
                {url}
              </a>
              <Button className="mt-3" onClick={() => void create()}>
                New code
              </Button>
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

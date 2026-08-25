import { useCallback, useEffect, useRef, useState } from 'react';

import { DeviceCard } from './DeviceCard.tsx';
import { OperatorPanel } from './OperatorPanel.tsx';
import type { ActionResult, RegistryState } from './types.ts';

const POLL_MS = 3000;
const REPO = 'https://github.com/Harshyadav442277/Midnight-hackathon';

const shorten = (s: string, head = 10, tail = 8): string =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

export const App = (): React.ReactElement => {
  const [state, setState] = useState<RegistryState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<{ text: string; href?: string; bad?: boolean }[]>([]);
  const previousEpoch = useRef<string | null>(null);
  const [epochPulse, setEpochPulse] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      const body = (await res.json()) as RegistryState & { error?: string };
      if (body.error) throw new Error(body.error);
      setState(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Flash the baseline when the operator changes it — the moment the demo turns on.
  useEffect(() => {
    if (!state) return;
    if (previousEpoch.current !== null && previousEpoch.current !== state.baselineEpoch) {
      previousEpoch.current = state.baselineEpoch;
      setEpochPulse(true);
      const id = setTimeout(() => setEpochPulse(false), 2200);
      return () => clearTimeout(id);
    }
    previousEpoch.current = state.baselineEpoch;
  }, [state]);

  const act = useCallback(
    async (label: string, path: string) => {
      setBusy(label);
      try {
        const res = await fetch(path, { method: 'POST' });
        const body = (await res.json()) as ActionResult;
        if (body.ok) {
          const text = body.message ?? `${label} — confirmed`;
          setLog((l) => [{ text, href: body.explorer }, ...l].slice(0, 6));
        } else {
          setLog((l) => [{ text: `${label} — rejected: ${body.error}`, bad: true }, ...l].slice(0, 6));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setLog((l) => [{ text: `${label} — failed: ${message}`, bad: true }, ...l].slice(0, 6));
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [refresh],
  );

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1>
            Night<span>Seal</span>
          </h1>
          <p className="tagline">
            Your router's manufacturer must prove its firmware is clean — without publishing a
            map of its insides for attackers.
          </p>
        </div>
        <div className="chain">
          <span className="net">{state?.network ?? 'preview'}</span>
          {state && (
            <a href={state.explorer} target="_blank" rel="noreferrer" title={state.contractAddress}>
              {shorten(state.contractAddress, 14, 10)} ↗
            </a>
          )}
        </div>
      </header>

      {error && (
        <div className="banner bad">
          Cannot reach the operator service: {error}
          <span className="hint"> — is it running? (npm run serve)</span>
        </div>
      )}

      <section className="baseline">
        <div className={`epoch ${epochPulse ? 'pulse' : ''}`}>
          <span className="k">Approved baseline</span>
          <span className="v">epoch {state?.baselineEpoch ?? '—'}</span>
        </div>
        <div className="root">
          <span className="k">Firmware capability root</span>
          <code className="v">{state ? shorten(state.approvedRoot, 18, 12) : '—'}</code>
        </div>
        <div className="root">
          <span className="k">Component capability root</span>
          <code className="v">{state ? shorten(state.componentRoot, 18, 12) : '—'}</code>
        </div>
        <div className="privacy">
          <span className="k">On this page, from the public chain</span>
          <span className="v">
            device id · registered identity commitment · status · epoch · two roots
            <em> — no firmware, version, or component graph exists on-chain</em>
          </span>
        </div>
      </section>

      {state?.readOnly && (
        <div className="banner note">
          <strong>Auditor view.</strong> This page holds no key and can only read. Everything
          below came from the public chain — which is the entire point: anyone can audit
          compliance with nothing but a URL, and still sees no firmware data. Approving,
          revoking, and attesting deliberately run on the operator's own machine, because they
          need the operator's signing key and a local proof server that handles private
          witnesses. Publishing that side would hand strangers control of the registry.
        </div>
      )}

      <main className="fleet">
        {(state?.devices ?? []).map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            baselineEpoch={state?.baselineEpoch ?? '0'}
            busy={busy === `Attest ${device.label}`}
            readOnly={state?.readOnly ?? false}
            onAttest={() => act(`Attest ${device.label}`, `/api/attest/${device.id}`)}
          />
        ))}
        {!state && !error && <p className="loading">Reading public ledger state…</p>}
      </main>

      {state && !state.readOnly && (
        <OperatorPanel
          state={state}
          busy={busy}
          onRevokeComponent={(component) =>
            act(
              `Revoke hidden component ${component.label}`,
              `/api/revoke-component/${component.id}`,
            )
          }
          onReplay={(component, deviceId) => {
            const device = state.devices.find((d) => d.id === deviceId);
            return act(
              `Replay stale proof for ${device?.label ?? deviceId}`,
              `/api/replay/${deviceId}/${component.id}`,
            );
          }}
        />
      )}

      {log.length > 0 && (
        <section className="log">
          <h2>Recent transactions</h2>
          <ul>
            {log.map((entry, i) => (
              <li key={i} className={entry.bad ? 'bad' : ''}>
                {entry.href ? (
                  <a href={entry.href} target="_blank" rel="noreferrer">
                    {entry.text} ↗
                  </a>
                ) : (
                  entry.text
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer>
        <p>
          Hardware root of trust is the platform's job (NIST SP 800-193, TCG remote attestation).
          NightSeal is the privacy-preserving transparency layer above it.
        </p>
        <p className="footer-links">
          <a href={REPO} target="_blank" rel="noreferrer">
            Source
          </a>
          <a href={`${REPO}/blob/main/docs/EVIDENCE.md`} target="_blank" rel="noreferrer">
            On-chain evidence
          </a>
          {state && (
            <a href={state.explorer} target="_blank" rel="noreferrer">
              Contract on the explorer
            </a>
          )}
        </p>
      </footer>
    </div>
  );
};

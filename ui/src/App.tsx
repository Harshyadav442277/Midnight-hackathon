import { useCallback, useEffect, useRef, useState } from 'react';

import { DeviceCard } from './DeviceCard.tsx';
import { OperatorPanel } from './OperatorPanel.tsx';
import type { ActionResult, RegistryState } from './types.ts';

const POLL_MS = 3000;

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
          setLog((l) => [{ text: `${label} — confirmed`, href: body.explorer }, ...l].slice(0, 6));
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
          <span className="k">Approved-set Merkle root</span>
          <code className="v">{state ? shorten(state.approvedRoot, 18, 12) : '—'}</code>
        </div>
        <div className="privacy">
          <span className="k">On this page, from the public chain</span>
          <span className="v">
            device id · compliance status · epoch · root
            <em> — no firmware hash, version, or SBOM exists on-chain</em>
          </span>
        </div>
      </section>

      <main className="fleet">
        {(state?.devices ?? []).map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            baselineEpoch={state?.baselineEpoch ?? '0'}
            busy={busy === `Attest ${device.label}`}
            onAttest={() => act(`Attest ${device.label}`, `/api/attest/${device.id}`)}
          />
        ))}
        {!state && !error && <p className="loading">Reading public ledger state…</p>}
      </main>

      {state && (
        <OperatorPanel
          state={state}
          busy={busy}
          onRevoke={(build) => act(`Revoke ${build.version}`, `/api/revoke/${build.id}`)}
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
        Hardware root of trust is the platform's job (NIST SP 800-193, TCG remote attestation).
        NightSeal is the privacy-preserving transparency layer above it.
      </footer>
    </div>
  );
};

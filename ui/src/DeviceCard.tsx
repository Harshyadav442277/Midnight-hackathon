import type { DeviceView } from './types.ts';

type Presentation = { pill: string; blurb: string; tone: string };

const BY_STATUS: Record<DeviceView['status'], Presentation> = {
  COMPLIANT: {
    pill: 'COMPLIANT',
    blurb: 'Registered identity, firmware, and bound components proved current.',
    tone: 'good',
  },
  'RE-ATTESTATION REQUIRED': {
    pill: 'RE-ATTESTATION REQUIRED',
    blurb: 'The baseline moved. This device has not proved itself against the new one.',
    tone: 'warn',
  },
  'NEVER ATTESTED': {
    pill: 'NEVER ATTESTED',
    blurb: 'No proof has ever been submitted for this device.',
    tone: 'idle',
  },
};

/** A replayed proof is refused by consensus; an ordinary one cannot even be built. */
const rejectedByLedger = (device: DeviceView): boolean =>
  device.lastAttempt?.error?.includes('ledger') ?? false;

/**
 * A device whose most recent attempt against the *current* baseline was rejected is
 * shown as non-compliant. Where that rejection happened matters: only a replayed proof
 * reaches the chain, so the card must not claim consensus refused an attestation that
 * was never submitted.
 */
const presentationFor = (device: DeviceView, baselineEpoch: string): Presentation => {
  const attempt = device.lastAttempt;
  if (attempt && !attempt.ok && attempt.epoch === baselineEpoch && device.status !== 'COMPLIANT') {
    return {
      pill: 'NON-COMPLIANT',
      blurb: rejectedByLedger(device)
        ? 'A proof valid a moment ago was submitted and refused by the Midnight ledger.'
        : 'Proof rejected: its firmware or a privately bound component is no longer current.',
      tone: 'bad',
    };
  }
  return BY_STATUS[device.status];
};

type Props = {
  device: DeviceView;
  baselineEpoch: string;
  busy: boolean;
  readOnly: boolean;
  onAttest: () => void;
};

export const DeviceCard = ({
  device,
  baselineEpoch,
  busy,
  readOnly,
  onAttest,
}: Props): React.ReactElement => {
  const { pill, blurb, tone } = presentationFor(device, baselineEpoch);
  const drift =
    device.epoch === null
      ? '—'
      : device.epoch === baselineEpoch
        ? 'current'
        : `${Number(baselineEpoch) - Number(device.epoch)} behind`;

  return (
    <article className={`device ${tone}`} data-status={pill}>
      <div className="device-head">
        <h3>{device.label}</h3>
        <span className="pill">{pill}</span>
      </div>

      <p className="blurb">{blurb}</p>

      <p className={`identity ${device.identityRegistered ? 'bound' : 'missing'}`}>
        {device.identityRegistered
          ? 'Device-bound proof · registered secret required'
          : 'Device identity not registered'}
      </p>

      <dl className="facts">
        <div>
          <dt>Attested at epoch</dt>
          <dd>{device.epoch ?? '—'}</dd>
        </div>
        <div>
          <dt>Current baseline</dt>
          <dd>{baselineEpoch}</dd>
        </div>
        <div>
          <dt>Drift</dt>
          <dd>{drift}</dd>
        </div>
      </dl>

      {tone === 'bad' && (
        <p className="attempt-note">
          {rejectedByLedger(device) ? (
            <>
              Rejected by consensus, not by this dashboard: the roots the proof commits to are no
              longer current, so the ledger refused the transaction.
            </>
          ) : (
            <>
              Proof rejected locally — nothing was written on-chain. Proving <em>non</em>-membership
              is precisely what NightSeal avoids.
            </>
          )}
        </p>
      )}

      {!readOnly && (
        <button type="button" onClick={onAttest} disabled={busy}>
          {busy ? 'Generating proof…' : 'Attest now'}
        </button>
      )}
    </article>
  );
};

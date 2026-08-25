/**
 * Watch the indexer until an unshielded address receives its first transaction.
 *
 * Faucet funding is a manual, CAPTCHA-gated step. This polls for the result so the
 * deploy can start the moment the tokens land, and so "did the faucet actually pay?"
 * has an authoritative answer that does not depend on wallet sync.
 *
 * Usage: node cli/src/await-funding.mjs <mn_addr_preview...>
 */
import WebSocket from 'ws';

const ADDRESS = process.argv[2];
const WS_URL = 'wss://indexer.preview.midnight.network/api/v4/graphql/ws';
const POLL_MS = 60_000;

if (!ADDRESS) {
  console.error('usage: node await-funding.mjs <address>');
  process.exit(2);
}

const QUERY = `subscription($address: UnshieldedAddress!) {
  unshieldedTransactions(address: $address) {
    __typename
    ... on UnshieldedTransaction {
      transaction { hash }
      createdUtxos { value tokenType }
    }
    ... on UnshieldedTransactionsProgress { highestTransactionId }
  }
}`;

/** Resolve true if the address has at least one transaction. */
const checkOnce = () =>
  new Promise((resolve) => {
    const ws = new WebSocket(WS_URL, 'graphql-transport-ws');
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      resolve(v);
    };

    ws.on('open', () => ws.send(JSON.stringify({ type: 'connection_init', payload: {} })));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'connection_ack') {
        ws.send(
          JSON.stringify({
            id: '1',
            type: 'subscribe',
            payload: { query: QUERY, variables: { address: ADDRESS } },
          }),
        );
        return;
      }
      if (msg.type === 'next') {
        const node = msg.payload?.data?.unshieldedTransactions;
        if (node?.__typename === 'UnshieldedTransaction') {
          const value = node.createdUtxos?.map((u) => u.value).join(',') ?? '?';
          console.log(`FUNDED tx=${node.transaction?.hash ?? '?'} value=${value}`);
          finish(true);
        }
      }
      if (msg.type === 'error' || msg.type === 'complete') finish(false);
    });
    ws.on('error', () => finish(false));
    setTimeout(() => finish(false), 20_000);
  });

console.log(`watching ${ADDRESS}`);
for (;;) {
  if (await checkOnce()) process.exit(0);
  console.log(`still unfunded @ ${new Date().toISOString()}`);
  await new Promise((r) => setTimeout(r, POLL_MS));
}

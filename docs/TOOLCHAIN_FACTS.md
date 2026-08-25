# TOOLCHAIN_FACTS.md — Midnight build team single source of truth

**Compiled 2026-08-25** from 7 parallel research agents (toolchain, proof-server, networks, example-dapp, compact-lang, midnight-js) + 1 critic agent. The critic's corrections are folded in and marked **[CRITIC]** — treat those as authoritative where they conflict with the other six.

**Target host:** Windows 11 Home Single Language 10.0.26200 + WSL2 Ubuntu + Docker Desktop.
**Target stack:** Compact 0.23 contract compiled by compactc 0.31.1, driven by Midnight.js 4.1.1, against Preview or Preprod.

Legend:
- `⚠️ UNVERIFIED` — claim had no source URL, or was constructed/inferred rather than fetched.
- `⚠️ CONFLICT:` — two researchers disagreed; both values are shown with the resolution.
- **[CRITIC]** — corrected or added by the critic agent (authoritative).

---

## 0. TL;DR — the ten things that will bite you

1. **[CRITIC] There is no Ubuntu WSL distro on this machine.** `wsl -l -v` verified on the host shows the only distro is `docker-desktop`. Every toolchain command in every research doc presumes an Ubuntu. Run `wsl --install -d Ubuntu` as literally the first action.
2. **The Compact compiler has no Windows build.** Installer assets are `aarch64-apple-darwin`, `x86_64-apple-darwin`, `aarch64-unknown-linux-musl`, `x86_64-unknown-linux-musl` only. On Windows the installer detects `MINGW*/MSYS*/CYGWIN*/Windows_NT` → `pc-windows-gnu` and dies with *"there isn't a download for your platform"*.
3. **`NetworkId` is no longer an enum.** `export type NetworkId = string;`. Use `setNetworkId('preview')`. `NetworkId.TestNet` is dead. `getNetworkId()` **throws** if `setNetworkId` was never called — there is no default.
4. **The indexer GraphQL path is `/api/v4/graphql`** on the 4.1.1 stack. `/api/v3/graphql` (in the archived example-counter config) is for midnight-js 4.0.x only. **[CRITIC]** Copying counter's `config.ts` verbatim will break wallet sync.
5. **The DApp connector API changed completely.** `enable()` / `state()` / `serviceUriConfig()` are **gone**. It's `await initialAPI.connect(networkId)` → `ConnectedAPI`. Wallets inject under `window.midnight` keyed by **random UUIDs** — `window.midnight.mnLace` no longer works.
6. **Fees are paid in DUST, not in what the faucet gives you.** The faucet dispenses unshielded **tNIGHT**; you must then *register* those NIGHT UTXOs for DUST generation and **wait** for the tank to accrue. **[CRITIC] The accrual rate is not documented anywhere.** Do this in hour 1 and poll `dust.balance > 0n` before your first deploy.
7. **`httpClientProofProvider` now takes TWO args** — `(proverServerUri, zkConfigProvider)`. One-arg is the 1.x/2.x API.
8. **`deployContract` takes a `compiledContract`,** not a raw contract + witnesses. Build it with `CompiledContract.make(...).pipe(CompiledContract.withWitnesses(w), CompiledContract.withCompiledFileAssets(path))`.
9. **`example-counter` is ARCHIVED.** Model on `example-bboard` (active, pushed 2026-08-24) or `npx create-mn-app`.
10. **First `compact compile` downloads ~500 MB of ZK parameters.** Kick it off early; use `--skip-zk` while iterating.

---

# 1. Toolchain install & compile

## 1.1 Host prerequisites (Windows 11 → WSL2)

**[CRITIC] Verified on this host (2026-08-25):**
- Docker Desktop **29.7.2**, running.
- Node **v24.19.0** on the Windows side (satisfies example-bboard's `>=24.11.1` for the web-app side).
- `wsl -l -v` → **only `docker-desktop`**. **No Ubuntu distro installed.**

Because Docker Desktop is already running on the WSL2 platform, the WSL2 platform itself is enabled — **no reboot expected** when adding Ubuntu.

```powershell
# 0. VERIFY first — this is the command the critic actually ran
wsl -l -v            # on this host: only 'docker-desktop' exists

# 1. REQUIRED first step. The research's `wsl -d Ubuntu` FAILS without this.
wsl --install -d Ubuntu
#    then set a UNIX username + password when prompted
#    budget ~10 min for distro download + user setup

# 2. only works after the install above
wsl -d Ubuntu
```

Docs' own WSL bootstrap (from https://docs.midnight.network/guides/windows-compact-setup):
```powershell
wsl --install -d ubuntu   # PowerShell as admin; WSL 2 required
```
> Docs say Midnight dev components "are traditionally Linux-based" and require **WSL VERSION 2**.
> Source: https://docs.midnight.network/guides/windows-compact-setup (mdx: https://raw.githubusercontent.com/midnightntwrk/midnight-docs/main/docs/guides/windows-compact-setup.mdx)

**Node inside the fresh Ubuntu** — a fresh distro has **no Node at all** **[CRITIC]**:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && nvm install 24
```

Optional: **Docker Desktop → Settings → Resources → WSL integration → enable for Ubuntu** — needed only if you run `docker compose` from inside WSL. The proof server can be started from Windows PowerShell without it.

> ⚠️ CONFLICT: **Node engine version.**
> - Quickstart / create-mn-app: **Node.js 22+** (https://docs.midnight.network/getting-started/quickstart)
> - example-counter: **>= v22.15**
> - example-bboard: **`engines.node >=24.11.1`**, `.nvmrc` = `24.11.1`
> **Resolution:** install Node **24** inside WSL. It satisfies all three.

## 1.2 Install the `compact` developer-tools CLI

The compiler is **NOT** on npm and is **NOT** a standalone `compactc` zip download any more. It is installed via the `compact` dev-tools CLI, which then downloads compiler toolchains.

```bash
# run INSIDE WSL Ubuntu
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```
> Source: https://docs.midnight.network/getting-started/installation

**PATH after install — the three official sources disagree. [CRITIC] Try them in order; one will work:**
```bash
source ~/.bashrc                       # generic
source $HOME/.local/bin/env            # example-counter README
export PATH="$HOME/.compact/bin:$PATH" # docs installation page
```
Mechanically: the installer script writes the launcher to `$XDG_BIN_HOME`, or `$XDG_DATA_HOME/../bin`, or `$HOME/.local/bin`, and wires PATH into `.profile` / `.bashrc` / `.zshrc` / fish. Docs separately mention `~/.compact/bin` for *toolchains*. If `compact` is not found, open a new shell first.
> Source: https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh

Then install the compiler toolchain:
```bash
compact update            # installs the LATEST stable compiler and sets it default
compact update 0.30.0     # install a SPECIFIC toolchain version (example-counter pins this)
compact --version         # dev-tool CLI version
compact compile --version # compiler toolchain version
compact list              # available toolchain versions
compact list --installed  # installed toolchain versions
compact self update       # update the CLI itself
compact check
compact clean             # resets the .compact directory
compact format [--check --verbose]
compact fixup
```
> Sources: https://raw.githubusercontent.com/LFDT-Minokawa/compact/main/README.md ; https://docs.midnight.network/compact/compilation-and-tooling/dev-tool-usage ; https://docs.midnight.network/blog/compact-developer-tools

## 1.3 Compile a contract

```bash
compact compile <contract.compact> <output-dir>
compact compile --skip-zk <contract.compact> <output-dir>   # FAST — skips proof-key generation
compact compile +0.31.1 <contract.compact> <output-dir>     # pin an installed toolchain via +version
```

Real invocations from official repos:
```bash
compact compile src/counter.compact src/managed/counter        # example-counter
compact compile src/bboard.compact ./src/managed/bboard        # example-bboard
compact compile leaderboard.compact managed/leaderboard        # midnight-leaderboard
compact compile src/contract.compact contract/managed          # docs fix-version-mismatches
```
> Sources: https://raw.githubusercontent.com/midnightntwrk/example-counter/main/contract/package.json ; https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/README.md ; https://raw.githubusercontent.com/midnightntwrk/midnight-leaderboard/main/package.json

Expected bboard compile output (verbatim from its README):
```
Compiling 2 circuits: circuit "post" (k=14, rows=10070), circuit "takeDown" (k=14, rows=10087)
```

**Compiler output layout** (`targetdir/`):
```
targetdir/contract/index.d.ts
targetdir/contract/index.js
targetdir/contract/index.js.map
targetdir/zkir/<circuit>.zkir
targetdir/keys/<circuit>.prover
targetdir/keys/<circuit>.verifier
```
> Source: https://docs.midnight.network/compact/compilation-and-tooling/compiler-usage

**Raw `compactc` flags** (the CLI wraps this; `compactc flag ... sourcepath targetpath`):
`--version`, `--language-version`, `--runtime-version`, `--ledger-version`, `--skip-zk`, `--no-communications-commitment`, `--vscode`, `--sourceRoot`, `--compact-path`, `--trace-search`, `--trace-passes`

```bash
compactc --version && compactc --language-version && compactc --runtime-version && compactc --ledger-version
compactc src/test.compact obj/test
```
> Source: https://docs.midnight.network/compact/compilation-and-tooling/compiler-usage

## 1.4 Scaffolding

```bash
npx create-mn-app my-app        # choose Contract → hello-world template
npm run setup                   # boots local devnet in Docker (node + indexer + proof server), compiles, deploys
npm run setup -- --network preview
npm run setup -- --network preprod
npm run cli                     # interact
npm run test:e2e
docker compose down -v
```
Prerequisites per quickstart: Compact toolchain, Docker Desktop with **Compose v2**, Node.js 22+. `create-mn-app` is at **0.5.0** on npm.
> Source: https://docs.midnight.network/getting-started/quickstart

## 1.5 Editor support

VS Code extension: download **`compact-0.2.13.vsix`** from the GitHub releases page → Extensions → *Install from VSIX*.
`compact compile --vscode` formats compiler errors for that extension.
Neovim setup docs at `/compact/compilation-and-tooling/neovim-setup`.
> Source: https://docs.midnight.network/getting-started/installation

## 1.6 Repo provenance note

`github.com/midnightntwrk/compact` is **archived / read-only** — *"only hosted Compact release artifacts and is no longer maintained"*. Active development moved to **`LFDT-Minokawa/compact`** under Linux Foundation Decentralized Trust. **The archived repo still serves the release artifacts the installer URL points at — do NOT "fix" the installer URL.**
> Sources: https://raw.githubusercontent.com/midnightntwrk/compact/main/README.md ; https://raw.githubusercontent.com/LFDT-Minokawa/compact/main/README.md

## 1.7 Not on npm

`@midnight-ntwrk/compact` and `@midnight-ntwrk/compactc` both return **E404** on the npm registry (verified 2026-08-25). npm carries only the JS runtime and tooling.
> Source: https://registry.npmjs.org/@midnight-ntwrk/compact-runtime

---

# 2. Proof server

## 2.1 The command

```bash
docker pull midnightntwrk/proof-server:8.1.0
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
```
> Source: https://docs.midnight.network/getting-started/installation

This works **from Windows PowerShell with Docker Desktop** — it does not need WSL. **[CRITIC]** confirmed.

If port 6300 is taken, remap **only the host side**:
```bash
docker run -p 6301:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
```
> The container-internal port is 6300 and *"this should not be changed"*.
> Source: https://docs.midnight.network/develop/tutorial/using/proof-server

Served at **http://localhost:6300**.

## 2.2 Facts

| Fact | Detail | Source |
|---|---|---|
| Docker namespace | **`midnightntwrk/`** — NOT `midnightnetwork/` | https://hub.docker.com/v2/repositories/midnightntwrk/proof-server/tags?page_size=100 |
| Old namespace is stale | `midnightnetwork/proof-server` newest tags: `7.0.0-rc.1` (2026-01-12), `6.2.0-rc.3`, `4.0.0`. **Do not use.** | https://hub.docker.com/v2/repositories/midnightnetwork/proof-server/tags?page_size=25 |
| Current tag | `8.1.0`, and `latest` == `8.1.0`, both pushed **2026-05-13** | Docker Hub tags API |
| RC tags exist | `9.0.0-rc.7` (2026-08-11), `9.0.0-rc.6` (2026-08-10), `9.0.0-rc.5` (2026-07-07); `8.0.0`–`8.0.3` Mar 2026; `7.0.0/7.0.1/7.0.3` Jan–Mar 2026 | Docker Hub tags API |
| No `--network` flag | The old form `docker run -p 6300:6300 midnightnetwork/proof-server -- 'midnight-proof-server --network testnet'` is **obsolete**. Modern command passes only `-v` (verbose). | https://docs.midnight.network/getting-started/installation |
| Network-agnostic since 4.0.0 | Proof server 4.0.0 (2025-05-12) switched Pluto-Eris → **BLS12-381** and introduced *data providers* for ZK key material. That's when network-specific behavior left the CLI. | https://docs.midnight.network/relnotes/proof-server/proof-server-4-0-0 |
| Outbound connections | None, except fetching ZK key material via its data provider. Override with env var **`MIDNIGHT_PARAM_SOURCE`**. | proof-server-4-0-0 relnotes |
| Always local | The proof server is **never hosted**. Even against preview/preprod/mainnet you run it yourself, because it handles your private data. | https://docs.midnight.network/guides/networks-and-environments#environment-reference |
| Lace config | Lace: Settings » Midnight » select **`Local (http://localhost:6300)`** — currently the **only** option supported in Lace. **[CRITIC]** | https://docs.midnight.network/getting-started/installation |

```bash
docker ps | grep proof-server
```

## 2.3 Proof-server version conflicts

> ⚠️ CONFLICT: **Which proof-server tag?**
> - docs installation page + support matrix: **`8.1.0`**
> - example-bboard `bboard-cli/compose.yml`: **`8.0.3`** (`command: ['midnight-proof-server','-v']`, port 6300)
> - create-mn-app hello-world docker-compose template: **`8.1.0`**
> **[CRITIC] resolution: this is doc-lag in the example repos, not a real conflict. Use `8.1.0`** — it is the matrix-tested tag.

> ⚠️ Avoid **proof-server 7.x** — create-mn-app's compose template comments warn it **hangs on Apple Silicon**.
> ⚠️ Avoid **`9.0.0-rc.*`** — those pair with the **ledger-9 / compiler-0.34** line, not current nets.

> ⚠️ CONFLICT: one docs page (`/develop/tutorial/using/proof-server`) still says pull `:latest` via the Docker Desktop GUI, while `/getting-started/installation` pins `:8.1.0`. **Prefer the pinned tag.**

## 2.4 Version-pairing rule

There is **no published formula-style compiler↔proof-server rule.** Docs only say components *"must work together in compatible versions"* and direct you to the compatibility matrix. The runtime packages the mismatch-fixer checks are:
```bash
npm list @midnight-ntwrk/compact-runtime
npm list @midnight-ntwrk/ledger-v8
npm list @midnight-ntwrk/onchain-runtime-v3
```
Fix by pinning **exact** versions (no `^`, no `~`), running `npm ci`, and recompiling with `compact compile src/contract.compact contract/managed`.
> Source: https://docs.midnight.network/how-to/fix-version-mismatches

---

# 3. Networks / endpoints / faucet / explorer

Four environments exist: **undeployed** (local Docker), **preview** (public testnet, early development, maintained by core engineering), **preprod** (public testnet, final validation, tracks mainnet most closely), **mainnet** (production, no faucet).
> Source: https://docs.midnight.network/guides/networks-and-environments

**Current release train: "Midnight Ledger 8.0" is live on Preview, Preprod, and Mainnet.**
> Source: https://docs.midnight.network/relnotes/overview

## 3.1 Preview

| Item | Value |
|---|---|
| **NetworkId value** | `'preview'` |
| **Indexer HTTP (GraphQL)** | `https://indexer.preview.midnight.network/api/v4/graphql` |
| **Indexer WS** | `wss://indexer.preview.midnight.network/api/v4/graphql/ws` |
| **Node RPC (HTTP)** | `https://rpc.preview.midnight.network` |
| **Node RPC (WS)** | `wss://rpc.preview.midnight.network` |
| **Proof server** | `http://localhost:6300` (always local) |
| **Faucet** | `https://midnight-tmnight-preview.nethermind.dev/` |
| **Explorer (Midnight Explorer)** | `https://preview.midnightexplorer.com/` |
| **Explorer (Subscan)** | `https://midnight-preview.subscan.io/` |
| **Explorer (1am)** | `https://explorer.1am.xyz/?network=preview` |
| **Address prefixes** | `mn_addr_preview` / `mn_shield-addr_preview` / `mn_dust_preview` |
| **`system_chain` returns** | `"Midnight Preview"` |
| **Node version (matrix)** | 1.0.1 |
| **Indexer version (matrix)** | 4.3.5 |

> Sources: https://docs.midnight.network/guides/networks-and-environments ; https://docs.midnight.network/guides/acquire-tokens ; https://docs.midnight.network/relnotes/support-matrix

## 3.2 Preprod

| Item | Value |
|---|---|
| **NetworkId value** | `'preprod'` |
| **Indexer HTTP (GraphQL)** | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| **Indexer WS** | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` |
| **Node RPC (HTTP)** | `https://rpc.preprod.midnight.network` |
| **Node RPC (WS)** | `wss://rpc.preprod.midnight.network` |
| **Proof server** | `http://localhost:6300` (always local) |
| **Faucet (docs-canonical)** | `https://midnight-tmnight-preprod.nethermind.dev/` |
| **Faucet (second, also live)** | `https://faucet.preprod.midnight.network/` — **[CRITIC]** verified live, page titled "Midnight Faucet" |
| **Explorer (Midnight Explorer)** | `https://preprod.midnightexplorer.com/` |
| **Explorer (Subscan)** | `https://midnight-preprod.subscan.io/` |
| **Explorer (1am)** | `https://explorer.1am.xyz/?network=preprod` |
| **Address prefixes** | `mn_addr_preprod` / `mn_shield-addr_preprod` / `mn_dust_preprod` |
| **`system_chain` returns** | `"Midnight Preprod"` |
| **Node version (matrix)** | 1.0.2 |
| **Indexer version (matrix)** | 4.3.3-hotfix |

> ⚠️ CONFLICT resolved by **[CRITIC]**: earlier research treated `https://faucet.preprod.midnight.network/` (from example-counter's README) as stale. It is **not stale — both frontends work.** Prefer the docs-canonical nethermind URL; if it rate-limits, try the other, but **expect shared backend limits**.

## 3.3 Mainnet

| Item | Value |
|---|---|
| **NetworkId value** | `'mainnet'` |
| **Indexer HTTP (GraphQL)** | ⚠️ UNVERIFIED — no researcher captured a mainnet indexer URL. By pattern it would be `https://indexer.midnight.network/api/v4/graphql`, **not confirmed** |
| **Node RPC** | ⚠️ UNVERIFIED — by pattern `https://rpc.midnight.network`, **not confirmed** |
| **Proof server** | `http://localhost:6300` (always local) |
| **Faucet** | **None** — mainnet has no faucet |
| **Explorer (Midnight Explorer)** | `https://midnightexplorer.com/` |
| **Explorer (Subscan)** | `https://midnight.subscan.io/` |
| **Explorer (1am)** | `https://explorer.1am.xyz/` |
| **Address prefixes** | bare `mn_addr` / `mn_shield-addr` / `mn_dust` (no network suffix) |
| **`system_chain` returns** | `"Midnight Mainnet"` |
| **Node version (matrix)** | 1.0.2 |
| **Indexer version (matrix)** | 4.3.3-hotfix |

## 3.4 Undeployed (local Docker devnet)

| Item | Value |
|---|---|
| **NetworkId value** | `'undeployed'` |
| **Indexer HTTP (GraphQL)** | `http://localhost:8088/api/v4/graphql` — variant `http://127.0.0.1:8088/api/v4/graphql` |
| **Indexer WS** | `ws://localhost:8088/api/v4/graphql/ws` — variant `ws://127.0.0.1:8088/api/v4/graphql/ws` |
| **Node** | `http://localhost:9944` — deploy-guide variant `ws://127.0.0.1:9944` |
| **Proof server** | `http://localhost:6300` / `http://127.0.0.1:6300` |
| **Faucet** | **None** — the genesis wallet is pre-funded / NIGHT is pre-minted |
| **Genesis seed** | `0000000000000000000000000000000000000000000000000000000000000001` (64 hex chars) |
| **Address prefixes** | `mn_addr_undeployed` etc. |

> Sources: https://docs.midnight.network/guides/networks-and-environments ; https://raw.githubusercontent.com/midnightntwrk/create-mn-app/main/templates/hello-world/src/network.ts

## 3.5 Local devnet Docker images

> ⚠️ CONFLICT: **three different pin sets across sources.**
>
> | Source | node | indexer-standalone | proof-server |
> |---|---|---|---|
> | example-bboard `bboard-cli/compose.yml` | `midnightntwrk/midnight-node:0.22.3` | `midnightntwrk/indexer-standalone:4.0.1` | `midnightntwrk/proof-server:8.0.3` |
> | example-counter | (same node) | `midnightntwrk/indexer-standalone:4.0.0` | — |
> | create-mn-app hello-world template | `midnightntwrk/midnight-node:1.0.0` | `midnightntwrk/indexer-standalone:4.3.3` | `midnightntwrk/proof-server:8.1.0` |
> | docs support matrix (hosted nets) | Node 1.0.1 / 1.0.2 | Indexer 4.3.5 / 4.3.3-hotfix | 8.1.0 |
>
> **Resolution: prefer the create-mn-app template set** (`midnight-node:1.0.0`, `indexer-standalone:4.3.3`, `proof-server:8.1.0`) — it's newest and matches the 4.1.1 SDK + `/api/v4/graphql`. The bboard compose file is older.

Container env details:
- `midnightntwrk/midnight-node` — port **9944**, `CFG_PRESET=dev`, `SIDECHAIN_BLOCK_BENEFICIARY=04bcf7ad3be7a5c790460be82a713af570f22e0f801f6659ab8e84a52be6969e`
- `midnightntwrk/indexer-standalone` — port **8088**, `APP__INFRA__SECRET=<64-hex>`, `APP__INFRA__NODE__URL=ws://node:9944`, `APP__APPLICATION__NETWORK_ID=undeployed`. **4.3.3 requires a dummy `APP__INFRA__SPO_NODE__BLOCKFROST_ID` env var to boot on a local devnet.**
- `midnightntwrk/proof-server` — port **6300**, `command: ['midnight-proof-server','-v']`

> ⚠️ Avoid **indexer-standalone 4.3.4 / 4.4.0** — create-mn-app's template comments mark them **pre-alpha** (ledger-9 line).

> Sources: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/bboard-cli/compose.yml ; https://raw.githubusercontent.com/midnightntwrk/create-mn-app/main/templates/hello-world/docker-compose.yml.template

## 3.6 Setting the network in code

```ts
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// MUST run before initializing any providers / deployContract / callTx
setNetworkId('preview');   // hackathon option A
// setNetworkId('preprod'); // hackathon option B
// other valid values: 'mainnet', 'undeployed'
// getNetworkId() throws "Network ID has not been configured" until setNetworkId is called
```

Current source of truth for the type:
```ts
export type NetworkId = string;
// setNetworkId(id: NetworkId): void
// getNetworkId(): NetworkId
```
> Source: https://raw.githubusercontent.com/midnightntwrk/midnight-js/main/packages/network-id/src/network-id.ts

Exact throw message: `'Network ID has not been configured. Call setNetworkId() before any wallet or contract operation.'`
> Source: https://raw.githubusercontent.com/midnightntwrk/midnight-js/main/packages/network-id/src/index.ts

Ready-made config objects:
```ts
const previewConfig = {
  networkId: 'preview',
  node: 'https://rpc.preview.midnight.network',
  nodeWS: 'wss://rpc.preview.midnight.network',
  indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  proofServer: 'http://localhost:6300', // always local, all networks
};
```
```ts
const preprodConfig = {
  networkId: 'preprod',
  node: 'https://rpc.preprod.midnight.network',
  nodeWS: 'wss://rpc.preprod.midnight.network',
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  proofServer: 'http://localhost:6300', // always local, all networks
};
```

**Docs explicitly warn against mixing values from different networks** (e.g. a `preprod` networkId with a preview indexer URL) — keep networkId and endpoint URLs together in one config object.
> Source: https://docs.midnight.network/guides/networks-and-environments

## 3.7 Verify you hit the right endpoint

```bash
curl -s -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}' https://rpc.preview.midnight.network
curl -s -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}' https://rpc.preprod.midnight.network
```
> Source: https://docs.midnight.network/guides/query-the-blockchain

## 3.8 Faucet + DUST flow (CRITICAL PATH)

**Faucet flow** (web form, **no login required**):
1. Copy your **UNSHIELDED** address from Lace — it starts `mn_addr_preview...` / `mn_addr_preprod...`. **The faucet rejects shielded (`mn_shield-addr_`) and DUST (`mn_dust_`) addresses.**
2. Paste into the form, solve the captcha, click request.
3. Success message: `Transaction submitted. You will shortly receive 1000 tNight in your wallet.`
4. **1000 tNIGHT per request.** Rate-limited: errors are `rate_limit_error` / `"Reached maximum number of requests"`. **Wait several hours to retry.**

> Source: https://docs.midnight.network/guides/acquire-tokens

**tNIGHT alone generates nothing and cannot pay fees.** You must register it for DUST generation:
- **In Lace:** Tokens → select **"Generate tDUST"** → review → confirm.
- **Headless:** `wallet.registerNightUtxosForDustGeneration(...)` — see §6.7.

tDUST then accrues over time up to a cap determined by the registered NIGHT amount. **tDUST pays transaction fees.**

> ⚠️ **[CRITIC] The tDUST accrual RATE is NOT documented anywhere.** Docs say only "accrues over time up to a cap set by how much NIGHT you registered." The only safe play: faucet + register within the first hour, then **poll `state.dust.balance(new Date()) > 0n` before attempting your first deploy.**

## 3.9 Unofficial explorer

There is also a **"Night Scan"** explorer at `https://explorer.preview.midnight.network/` which appeared in search results but is **not listed in the docs environment-reference table**. Treat the docs-listed explorers as canonical.
> Source: https://explorer.preview.midnight.network/

---

# 4. Project structure from official examples

## 4.1 Which repo to copy

| Repo | Status | Use it for |
|---|---|---|
| `midnightntwrk/example-bboard` | **ACTIVE** (pushed 2026-08-24) | **The recommended full template.** Contract + shared API + headless CLI + React/Vite/Lace UI. |
| `midnightntwrk/midnight-leaderboard` | **ACTIVE** (pushed 2026-08-25) | Current recommended *tutorial* repo. Browser/Lace only, **no headless CLI**. Uses `disclose()`, production deployment. |
| `midnightntwrk/example-counter` | **ARCHIVED / read-only** | Still the best *minimal headless-CLI deploy reference* (repo v2.1.1, SDK 4.x), but **won't track future SDK releases**. |
| `midnightntwrk/example-hello-world` | ACTIVE | Minimal |
| `midnightntwrk/example-zkloan` | ACTIVE | Nested Maps, newtypes, `ownPublicKey()` warning |
| `midnightntwrk/example-battleship`, `midnight-tip-jar`, `example-nft-contracts`, `midnight-awesome-dapps` | ACTIVE | Additional references |
| `midnightntwrk/midnight-expert` | ACTIVE | **Claude plugins with reviewed Compact patterns** — source of the canonical MerkleTree `ticket.compact` example |

example-counter's archive notice, verbatim intent: *"This repository is archived and no longer maintained... replaced it with the leaderboard example"*, pointing at `docs.midnight.network/tutorials/leaderboard` and `github.com/midnightntwrk/midnight-leaderboard`.
> Source: https://raw.githubusercontent.com/midnightntwrk/example-counter/main/README.md

Docs tutorial index now lists **five** tutorials: Bulletin board, Private party, Battleship, Leaderboard, ZK Loan.
> Source: https://docs.midnight.network/develop/tutorial/

## 4.2 example-bboard layout (recommended template)

```
example-bboard/
  contract/
    src/bboard.compact
    src/index.ts            # CompiledContract.make(...).pipe(...)
    src/witnesses.ts
    src/managed/bboard/     # compiler output: contract/, zkir/, keys/
  api/
    src/index.ts            # BBoardAPI — deploy/join logic shared by CLI and UI
    src/common-types.ts
  bboard-cli/
    src/index.ts
    src/launcher/standalone.ts
    src/launcher/preview.ts
    src/launcher/preprod.ts
    src/midnight-wallet-provider.ts
    src/wallet-utils.ts
    src/config.ts
    compose.yml
    proof-server-local.yml
  bboard-ui/                # Vite + React + Lace
    src/contexts/BrowserDeployedBoardManager.ts
```
> Source: https://api.github.com/repos/midnightntwrk/example-bboard/git/trees/main?recursive=1

## 4.3 example-counter layout (minimal headless reference)

```
example-counter/
  contract/
    src/counter.compact
    src/index.ts
    src/witnesses.ts
    src/test/
  counter-cli/
    src/api.ts
    src/cli.ts
    src/config.ts
    src/common-types.ts
    src/standalone.ts
    src/preprod.ts
    src/preview.ts
    src/proof-server.yml
    src/standalone.yml
```
npm workspaces: `['counter-cli','contract']`.
> Source: https://api.github.com/repos/midnightntwrk/example-counter/git/trees/main?recursive=1

## 4.4 midnight-leaderboard layout

Workspaces: `contract/` (`leaderboard.compact` + **pre-committed `managed/`** with `submitScore` + `verifyOwnership` prover/verifier keys), `api/`, `leaderboard-ui/` (Vite React + Lace via `dapp-connector-api` 4.0.1), `tutorials/*.mdx`, `proof-server/Dockerfile`.
Deps: `@midnight-ntwrk/compact-js` 2.5.1 + `midnight-js-*` 4.1.1. Compile script: `compact compile leaderboard.compact managed/leaderboard`. **Browser-only** (uses `fetch-zk-config-provider`).
> Source: https://raw.githubusercontent.com/midnightntwrk/midnight-leaderboard/main/package.json

## 4.5 Build & run scripts

Contract package scripts (example-counter):
```json
"compact": "compact compile src/counter.compact src/managed/counter",
"build": "rm -rf dist && tsc --project tsconfig.build.json && cp -Rf ./src/managed ./dist/managed && cp ./src/counter.compact ./dist"
```
> ⚠️ These use `rm -rf` / `cp -Rf` — **run them inside WSL**, not PowerShell.
> Source: https://raw.githubusercontent.com/midnightntwrk/example-counter/main/contract/package.json

Common sequences:
```bash
npm install
cd contract && npm run compact && npm run build && npm run test

# example-counter CLI
cd counter-cli && npm run standalone
cd counter-cli && npm run preprod-ps
docker compose -f proof-server.yml up

# example-bboard CLI
cd bboard-cli && npm run standalone
cd bboard-cli && npm run preview-remote
cd bboard-cli && npm run preprod-remote
docker compose -f proof-server-local.yml up -d

# how the launchers actually run (TS directly, no build step)
node --experimental-specifier-resolution=node --loader ts-node/esm src/launcher/preprod.ts
```
> ⚠️ The CLI scripts run TypeScript directly — no build step needed to *run*, **but the contract must be compiled + built first** or you get `Cannot find module`.

**Standalone mode differences:** example-counter uses a manual `docker compose up`; **example-bboard spins containers via testcontainers** (`getTestEnvironment` from `@midnight-ntwrk/testkit-js`) instead.

## 4.6 example-bboard dependency pin set (root package.json)

```
@midnight-ntwrk/wallet-sdk                              1.2.0   (pinned via resolutions)
@midnight-ntwrk/midnight-js-contracts                   4.1.1
@midnight-ntwrk/midnight-js-fetch-zk-config-provider    4.1.1
@midnight-ntwrk/midnight-js-http-client-proof-provider  4.1.1
@midnight-ntwrk/midnight-js-indexer-public-data-provider 4.1.1
@midnight-ntwrk/midnight-js-level-private-state-provider 4.1.1
@midnight-ntwrk/midnight-js-network-id                  4.1.1
@midnight-ntwrk/midnight-js-node-zk-config-provider     4.1.1
@midnight-ntwrk/midnight-js-protocol                    4.1.1
@midnight-ntwrk/midnight-js-types                       4.1.1
@midnight-ntwrk/midnight-js-utils                       4.1.1
@midnight-ntwrk/testkit-js                              4.1.1
@midnight-ntwrk/dapp-connector-api                      4.0.1
engines.node                                            >=24.11.1   (.nvmrc 24.11.1)
typescript                                              5.9.3
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/package.json

## 4.7 example-counter dependency pin set (v2.1.1) — for contrast

```
@midnight-ntwrk/compact-runtime                          0.15.0
@midnight-ntwrk/ledger-v8                                ^8.0.0
@midnight-ntwrk/midnight-js                              ^4.0.4      (MONO package, subpath imports)
@midnight-ntwrk/midnight-js-http-client-proof-provider   ^4.0.4
@midnight-ntwrk/midnight-js-indexer-public-data-provider ^4.0.4
@midnight-ntwrk/midnight-js-level-private-state-provider ^4.0.4
@midnight-ntwrk/midnight-js-node-zk-config-provider      ^4.0.4
@midnight-ntwrk/wallet-sdk-address-format                ^3.0.0
@midnight-ntwrk/wallet-sdk-dust-wallet                   ^3.0.0
@midnight-ntwrk/wallet-sdk-facade                        ^3.0.0
@midnight-ntwrk/wallet-sdk-hd                            ^3.0.0
@midnight-ntwrk/wallet-sdk-shielded                      ^2.0.0
@midnight-ntwrk/wallet-sdk-unshielded-wallet             ^2.0.0
ws                                                       ^8.20.1
pino                                                     ^10.3.1
overrides: smoldot -> npm:@aspect-build/empty@0.0.0
devDep typescript                                        ^6.0.2
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-counter/main/package.json

> ⚠️ **Two incompatible import styles.** example-counter uses the **mono package** `@midnight-ntwrk/midnight-js` with subpath imports (`/contracts`, `/types`, `/utils`, `/network-id`). example-bboard and midnight-leaderboard use **individual `@midnight-ntwrk/midnight-js-*` 4.1.1 packages** plus `@midnight-ntwrk/midnight-js-protocol` subpaths (`/ledger`, `/compact-runtime`, `/compact-js`). **Do not mix the two.**

---

# 5. Compact language reference

**Current: language version 0.23.0, compiler 0.31.1.**
Docs header on the auto-generated ledger-ADT reference reads: *"Compact language version 0.23.0, compiler version 0.31.0"*.
> Source: https://raw.githubusercontent.com/midnightntwrk/midnight-docs/main/docs/compact/reference/ledger-adt.mdx

Docs locations (restructured — old `/develop/reference/compact/*` URLs still resolve but use the new paths):
- `/compact/reference/writing`, `/compact/reference/compact-reference`, `/compact/reference/explicit-disclosure`, `/compact/reference/ledger-adt`, `/compact/reference/compact-grammar`, `/compact/reference/compact-keywords`
- `/compact/standard-library`, `/compact/standard-library/exports`
- `/compact/compilation-and-tooling/{compiler-usage, dev-tool-usage, formatter-usage, fixup-usage, vscode-plugin, neovim-setup}`
- Machine-readable index: **https://docs.midnight.network/llms.txt**
- `.md`/`.mdx` sources live in `midnightntwrk/midnight-docs` under `docs/compact/...`

## 5.1 Declaration syntax cheatsheet (verbatim fragments)

```compact
pragma language_version >= 0.22 && <= 0.23;   // real pin (zkloan); bboard: pragma language_version 0.23;
import CompactStandardLibrary;
import "schnorr" prefix Schnorr_;             // file module import with prefix

ledger val: Field;                            // implicit Cell<Field>
export ledger cnt: Counter;
sealed ledger u8list: List<Uint<8>>;
export sealed ledger mapping: Map<Boolean, Field>;
export ledger loans: Map<Bytes<32>, Map<Uint<16>, LoanApplication>>;  // nested Map
export ledger members: HistoricMerkleTree<16, Bytes<32>>;

enum Arrow { up, down, left, right };
export new type UserSecretKey = Bytes<32>;    // newtype
struct Thing {
  triple: Vector<3, Field>,
  flag: Boolean,
}

witness W(x: Uint<16>): Bytes<32>;
witness get_path(c: Bytes<32>): MerkleTreePath<10, Bytes<32>>;

constructor(v: Field) { init(v); }

export circuit foo(x: Field): [] { ... }
export pure circuit c(a: Field): Field { return disclose(a) + 73; }
circuit gen<#N>(): Uint<16> { return N; }
```
> Source: https://docs.midnight.network/compact/reference/compact-reference + https://raw.githubusercontent.com/midnightntwrk/example-zkloan/main/contract/src/zkloan-credit-scorer.compact

## 5.2 Pragma — what real contracts actually use

| Repo | Pragma |
|---|---|
| example-bboard | `pragma language_version 0.23;` |
| midnight-leaderboard | `pragma language_version 0.23;` |
| example-counter | `pragma language_version >= 0.20;` |
| example-zkloan | `pragma language_version >= 0.22 && <= 0.23;` |
| ticket.compact (midnight-expert) | `pragma language_version >= 0.22;` |

> ⚠️ The language reference shows `pragma language_version >= 1.0.0 && !1.0.5;` — **that is a hypothetical illustrating constraint operators**, not the current version. Actual current language version is **0.23.0**.

## 5.3 `disclose()`

`disclose()` is **compile-time only** (no runtime op) and is **REQUIRED** whenever witness-derived data flows to:
- ledger stores,
- exported-circuit return values,
- cross-contract calls.

Omitting it gives the error **`potential witness-value disclosure must be declared but is not`** with a data-flow trace.
> Source: https://docs.midnight.network/compact/reference/explicit-disclosure

> ⚠️ **`disclose()` is still required on witness-derived values passed to `MerkleTree.insert`**, even though the leaf is hidden on-chain — and on the digest passed to `checkRoot`.

## 5.4 Ledger ADTs

### Cell
`Cell<value_type>` is **implicit for ordinary types and cannot be written explicitly in a declaration.** Write `ledger x: Field;`, not `ledger x: Cell<Field>;`.
Ops: `read()`, `write(value)`, `writeCoin(coin, recipient)`, `resetToDefault()`. Plain assignment (`x = v;`) works.

### Counter
```
increment(amount: Uint<16>): []
decrement(amount: Uint<16>): []     // runtime error if it would go below zero
read(): Uint<64>
lessThan(threshold: Uint<64>): Boolean
resetToDefault(): []
```
> ⚠️ `increment`/`decrement` take **`Uint<16>`** but `read()` returns **`Uint<64>`**. Official code casts: `sequence as Field as Bytes<32>`, `nextId.read() as Uint<64>`.

### Map
```
insert(key, value): []
insertCoin(key, coin, recipient): []
insertDefault(key): []
lookup(key): value_type
member(key): Boolean
remove(key): []
isEmpty(): Boolean
size(): Uint<64>
resetToDefault(): []
[Symbol.iterator]                   // TypeScript-only
```
Nested maps work: `export ledger loans: Map<Bytes<32>, Map<Uint<16>, LoanApplication>>;` with `loans.lookup(k).insert(...)`.

### Set
Used in the official ticket example: `export ledger usedTickets: Set<Bytes<32>>;` with `.member(x)` and `.insert(x)`.

### List
`sealed ledger u8list: List<Uint<8>>;`

### Maybe / Opaque
`export ledger message: Maybe<Opaque<"string">>;`, constructed with `none<Opaque<"string">>()` / `some<Opaque<"string">>(v)`, read via `.value`.

> Source for all ledger ADT signatures: https://docs.midnight.network/compact/reference/ledger-adt

## 5.5 MerkleTree / HistoricMerkleTree — THE CRITICAL SECTION

### Depth constraint
- ledger-adt reference: **`2 <= nat <= 32`**
- lang-ref: **`for any n, 1 < n <= 32, and any Compact type T`** **[CRITIC]**

These are **equivalent** (`1 < n` ⟺ `n >= 2`). No conflict.

Capacity table: depth **10 → 1024** leaves, **16 → 65,536**, **20 → ~1M**, **32 → ~4.3B**.
> Source: https://raw.githubusercontent.com/midnightntwrk/midnight-expert/main/plugins/core-concepts/skills/privacy-patterns/references/merkle-tree-usage.md

### Verbatim operation signatures

```compact
// MerkleTree<nat, value_type> and HistoricMerkleTree<nat, value_type>, 2 <= nat <= 32
insert(item: value_type): []
insertIndex(item: value_type, index: Uint<64>): []
insertHash(hash: Bytes<32>): []
insertHashIndex(hash: Bytes<32>, index: Uint<64>): []
insertIndexDefault(index: Uint<64>): []   // emulates removal
checkRoot(rt: MerkleTreeDigest): Boolean  // MerkleTree: current root only; Historic: ANY past root
isFull(): Boolean
resetToDefault(): []
resetHistory(): []                        // HistoricMerkleTree only

// TypeScript-ONLY (not callable in circuits):
// root(): MerkleTreeDigest
// firstFree(): bigint
// findPathForLeaf(leaf: value_type): MerkleTreePath<value_type> | undefined  // O(n)
// pathForLeaf(index: bigint, leaf: value_type): MerkleTreePath<value_type>
// history(): Iterator<MerkleTreeDigest>  // Historic only
```
> Source: https://docs.midnight.network/compact/reference/ledger-adt

### The `checkRoot` semantic difference — this is the one that costs you a demo

- **`MerkleTree.checkRoot(rt)`** matches **ONLY the current root.** Any later `insert` invalidates every outstanding proof.
- **`HistoricMerkleTree.checkRoot(rt)`** *"tests if the given Merkle tree root is one of the **past** roots for this Merkle tree"* — it accepts stale roots. This **avoids the race where the tree changes between proof generation and transaction submission.**
- `HistoricMerkleTree.resetHistory()` wipes the history, leaving **only the current root** valid.

**→ Use `HistoricMerkleTree` whenever members are added over time.** **[CRITIC]** emphasises this.

### Path types (stdlib, verbatim)

```compact
struct MerkleTreeDigest { field: Field; }

struct MerkleTreePathEntry {
  sibling: MerkleTreeDigest;
  goesLeft: Boolean;
}

struct MerkleTreePath<#n, T> {
  leaf: T;
  path: Vector<n, MerkleTreePathEntry>;
}

circuit merkleTreePathRoot<#n, T>(path: MerkleTreePath<n, T>): MerkleTreeDigest;
circuit merkleTreePathRootNoLeafHash<#n>(path: MerkleTreePath<n, Bytes<32>>): MerkleTreeDigest;
circuit ownPublicKey(): ZswapCoinPublicKey;
circuit persistentHash<T>(value: T): Bytes<32>;
circuit transientHash<T>(value: T): Field;
```
> Source: https://docs.midnight.network/compact/standard-library/exports

`merkleTreePathRootNoLeafHash` is for **pre-hashed leaves**. Docs note paths are *"constructed from witnesses that use the compiler output's `findPathForLeaf` and `pathForLeaf` functions"*.

### API traps (all three researchers agree)

- **There is NO `.member(value, path)` method and NO `historicMember` method on MerkleTree.** Membership is verified **only** by computing the root from the path and calling `checkRoot`.
- **`MerkleTreePath` has NO `.value` field** — pass the whole struct to `merkleTreePathRoot`.
- `root()`, `firstFree()`, `findPathForLeaf()`, `pathForLeaf()`, `history()` are **TypeScript-only** on the generated ledger object. **Calling them inside a circuit will not compile.** The Merkle path must enter the circuit through a **witness**.

### Canonical membership-proof pattern — OFFICIAL CODE

This is real fetched code from `midnightntwrk/midnight-expert`, `plugins/compact-core/skills/basic-start/examples/ticket.compact`. **Prefer this over the constructed snippet below.**

```compact
pragma language_version >= 0.22;

import CompactStandardLibrary;

export ledger tickets: HistoricMerkleTree<10, Bytes<32>>;
export ledger usedTickets: Set<Bytes<32>>;
export ledger ticketsUsed: Counter;

witness ticket_secret(): Bytes<32>;
witness ticket_randomness(): Bytes<32>;
witness get_ticket_path(commitment: Bytes<32>): MerkleTreePath<10, Bytes<32>>;

circuit derive_ticket_commitment(secret: Bytes<32>, randomness: Bytes<32>): Bytes<32> {
  return persistentCommit<Vector<2, Bytes<32>>>(
    [pad(32, "ticket:commit::"), secret],
    randomness
  );
}

circuit derive_ticket_nullifier(secret: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([
    pad(32, "ticket:nullify:"),
    secret
  ]);
}

export circuit issue_ticket(): [] {
  const secret = ticket_secret();
  const randomness = ticket_randomness();
  const commitment = derive_ticket_commitment(secret, randomness);
  tickets.insert(commitment);
}

export circuit use_ticket(): [] {
  const secret = ticket_secret();
  const randomness = ticket_randomness();
  const commitment = derive_ticket_commitment(secret, randomness);

  // Prove the commitment exists in the tree (without revealing which leaf)
  const path = get_ticket_path(commitment);
  assert(
    tickets.checkRoot(disclose(merkleTreePathRoot<10, Bytes<32>>(path))),
    "Invalid ticket"
  );

  const nul = derive_ticket_nullifier(secret);
  assert(disclose(!usedTickets.member(disclose(nul))), "Ticket already used");
  usedTickets.insert(disclose(nul));
  ticketsUsed.increment(1);
}
```
> Source: https://raw.githubusercontent.com/midnightntwrk/midnight-expert/main/plugins/compact-core/skills/basic-start/examples/ticket.compact

**Note the shape:** witness returns `MerkleTreePath<n, Bytes<32>>` → circuit computes `merkleTreePathRoot<n, Bytes<32>>(path)` → `assert(tree.checkRoot(disclose(...)), "...")` → domain-separated `persistentHash` nullifier checked against and inserted into a `Set`.

### ⚠️ CONFLICT: explicit type arguments on `merkleTreePathRoot`

- Official `ticket.compact`: **`merkleTreePathRoot<10, Bytes<32>>(path)`** — explicit type args.
- **[CRITIC]**'s constructed snippet: `merkleTreePathRoot(path)` — inferred.

**Resolution: use the explicit form from the official code.** The critic's snippet is explicitly labelled as constructed-from-signatures, not fetched.

### Constructed pattern (⚠️ UNVERIFIED — from **[CRITIC]**, assembled from documented signatures, NOT fetched code)

**[CRITIC] notes: no official worked MerkleTree example exists in `compact-by-example.org` or in bboard/counter/leaderboard.** `compact-by-example.org` covers only hello-world and tokens/ERC-style contracts (source: https://compact-by-example.org/llms.txt). Verify `assert`/`witness` syntax against the 0.23 lang-ref on first compile.

```compact
pragma language_version 0.23;
import CompactStandardLibrary;

// HistoricMerkleTree so proofs built against a slightly-stale root still verify
export ledger members: HistoricMerkleTree<10, Bytes<32>>;

// private input: the prover's path to their own leaf (resolved in TS from ledger state)
witness findMemberPath(leaf: Bytes<32>): MerkleTreePath<10, Bytes<32>>;

export circuit addMember(pk: Bytes<32>): [] {
  members.insert(pk);            // also: insertHash / insertIndex / insertHashIndex
}

export circuit proveMembership(sk: Bytes<32>): [] {
  // derive the leaf from a secret so membership doesn't reveal which leaf
  const leaf = persistentHash<Vector<2, Bytes<32>>>([pad(32, "member:"), sk]);
  const path = findMemberPath(leaf);
  assert(members.checkRoot(merkleTreePathRoot(path)), "not a member");
  // checkRoot on HistoricMerkleTree accepts any PAST root, not just current
}
```

### TypeScript witness that resolves the path

```ts
// witnesses.ts — witness returns [newPrivateState, result]
import { type Ledger } from './managed/membership/contract/index.js';

export const witnesses = {
  findMemberPath: (
    { ledger, privateState }: { ledger: Ledger; privateState: MyPrivateState },
    leaf: Uint8Array,
  ) => {
    const path = ledger.members.findPathForLeaf(leaf); // MerkleTreePath | undefined
    if (path === undefined) throw new Error('leaf not in tree');
    return [privateState, path] as const;
  },
};
// other TS-only helpers: pathForLeaf(index, leaf), firstFree(), root(), history()
```
> ⚠️ UNVERIFIED — constructed by **[CRITIC]** from documented TS-only method signatures. The `[newPrivateState, result]` witness return shape is the documented convention; confirm against the generated `.d.ts`.

## 5.6 Full official contracts

### `counter.compact` (example-counter, complete)
```compact
pragma language_version >= 0.20;

import CompactStandardLibrary;

// public state
export ledger round: Counter;

// transition function changing public state
export circuit increment(): [] {
  round.increment(1);
}
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-counter/main/contract/src/counter.compact

### `bboard.compact` (example-bboard, complete, main branch Aug 2026)
```compact
pragma language_version 0.23;

import CompactStandardLibrary;

export enum State {
  VACANT,
  OCCUPIED
}

export ledger state: State;
export ledger message: Maybe<Opaque<"string">>;
export ledger sequence: Counter;
export ledger owner: Bytes<32>;

constructor() {
  state = State.VACANT;
  message = none<Opaque<"string">>();
  sequence.increment(1);
}

witness localSecretKey(): Bytes<32>;

export circuit post(newMessage: Opaque<"string">): [] {
  assert(state == State.VACANT, "Attempted to post to an occupied board");
  owner = disclose(publicKey(localSecretKey(), sequence as Field as Bytes<32>));
  message = disclose(some<Opaque<"string">>(newMessage));
  state = State.OCCUPIED;
}

export circuit takeDown(): Opaque<"string"> {
  assert(state == State.OCCUPIED, "Attempted to take down post from an empty board");
  assert(owner == publicKey(localSecretKey(), sequence as Field as Bytes<32>), "Attempted to take down post, but not the current owner");
  const formerMsg = message.value;
  state = State.VACANT;
  sequence.increment(1);
  message = none<Opaque<"string">>();
  return formerMsg;
}

export circuit publicKey(sk: Bytes<32>, sequence: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([pad(32, "bboard:pk:"), sequence, sk]);
}
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/contract/src/bboard.compact

**Read this for the idiom:** identity is derived from a **witness secret key** hashed with a **domain-separation tag** (`pad(32, "bboard:pk:")`) and a sequence number — not from `ownPublicKey()`.

## 5.7 `assert`, `constructor`, `export circuit`

- **`assert(condition, "message")`** — two args, string message. Seen in bboard and ticket.compact.
- **`constructor(args) { ... }`** — runs at deploy. bboard's takes no args and initialises ledger fields directly. The reference shows `constructor(v: Field) { init(v); }`.
- **`export circuit name(args): ReturnType { ... }`** — exported circuits become `callTx.<name>()` in TypeScript.
- **`export pure circuit name(args): T { ... }`** — pure circuits are callable **off-chain** from TypeScript via `<Module>.pureCircuits.<name>(...)`.
- Non-exported `circuit` = internal helper (e.g. `derive_ticket_commitment`).
- Generics: `circuit foo<#N>(): Uint<16> { return N; }` — `#` marks a nat (compile-time) parameter.

## 5.8 `ownPublicKey()` — DO NOT USE FOR AUTHORIZATION

Verbatim warning from the official zkloan example:

> `ownPublicKey()` *"returns a prover-claimed value with no cryptographic binding to the transaction signer, so any assertion that depends on it is bypassable"*

Official examples instead derive identity from a **witness secret key + domain-separated `persistentHash`**.
> Source: https://raw.githubusercontent.com/midnightntwrk/example-zkloan/main/contract/src/zkloan-credit-scorer.compact

## 5.9 Struct field separators

> ⚠️ CONFLICT (harmless): the docs reference shows struct fields separated by **commas**; zkloan uses **semicolons**. Both appear in official sources and **both compile.**

---

# 6. Midnight.js API

## 6.1 Package versions — pin these

All `@midnight-ntwrk/midnight-js-*` packages: **`4.1.1`** (npm `latest` dist-tag, verified 2026-08-25).

```
@midnight-ntwrk/midnight-js-contracts                    4.1.1
@midnight-ntwrk/midnight-js-types                        4.1.1
@midnight-ntwrk/midnight-js-network-id                   4.1.1
@midnight-ntwrk/midnight-js-utils                        4.1.1
@midnight-ntwrk/midnight-js-protocol                     4.1.1
@midnight-ntwrk/midnight-js-indexer-public-data-provider 4.1.1
@midnight-ntwrk/midnight-js-level-private-state-provider 4.1.1
@midnight-ntwrk/midnight-js-http-client-proof-provider   4.1.1
@midnight-ntwrk/midnight-js-fetch-zk-config-provider     4.1.1
@midnight-ntwrk/midnight-js-node-zk-config-provider      4.1.1
@midnight-ntwrk/midnight-js-dapp-connector-proof-provider 4.1.1
@midnight-ntwrk/midnight-js-logger-provider              4.1.1
@midnight-ntwrk/dapp-connector-api                       4.0.1
@midnight-ntwrk/testkit-js                               4.1.1
@midnight-ntwrk/wallet-sdk                               1.2.0
```

The docs list **13 packages** under the Midnight.js API reference.
> Source: https://docs.midnight.network/api-reference/midnight-js/packages

`@midnight-ntwrk/midnight-js-protocol@4.1.1` **subpath exports** and what it pins transitively:
```
subpaths: ./ledger  ./compact-js  ./compact-runtime  ./onchain-runtime  ./platform-js
pins:  @midnight-ntwrk/ledger-v8@8.1.0
       @midnight-ntwrk/compact-js@2.5.1
       @midnight-ntwrk/platform-js@2.2.4
       @midnight-ntwrk/compact-runtime@0.16.0
       @midnight-ntwrk/onchain-runtime-v3@3.0.0
```
> Source: https://registry.npmjs.org/@midnight-ntwrk%2fmidnight-js-protocol/4.1.1

> ⚠️ **`5.0.0-beta.6` exists under the `beta` dist-tag** (published 2026-07-10). **Do not use it.** Pin everything to `4.1.1` exactly and do not mix in 5.0.0-beta packages.

> ⚠️ **The docs-rendered API reference is v4.0.4 — behind npm's 4.1.1.** Docs `llms.txt` labels say "Midnight.js v4.0.4". Trust npm.

## 6.2 `midnight-js-contracts` exports

`deployContract`, `findDeployedContract`, `submitCallTx`, `submitCallTxAsync`, `submitDeployTx`, `submitTx`, `submitTxAsync`, `createCallTxOptions`, `createUnprovenCallTx`, `createUnprovenDeployTx`, `getStates`, `getPublicStates`, `verifyContractState`
Error classes: `CallTxFailedError`, `DeployTxFailedError`, `TxFailedError`, `ContractTypeError`
> Source: https://docs.midnight.network/api-reference/midnight-js/@midnight-ntwrk/midnight-js-contracts

Signatures:
- `deployContract<C>(providers: ContractProviders<C>, options: DeployContractOptions...): Promise<DeployedContract<C>>` — throws `DeployTxFailedError` on node-side failure.
- `findDeployedContract` has **3 overloads** taking `(providers, options)` where options include `contractAddress`, `compiledContract`, and optionally `privateStateId` / `initialPrivateState`, returning `Promise<FoundContract<C>>`.
> Sources: https://docs.midnight.network/api-reference/midnight-js/@midnight-ntwrk/midnight-js-contracts/functions/deployContract ; .../findDeployedContract

Types: `MidnightProviders<CircuitKeys, PrivateStateId, PrivateState>` from `@midnight-ntwrk/midnight-js-types`; `DeployedContract` type = `FoundContract<C>`; circuit keys typed as `Exclude<keyof Contract['impureCircuits'], number | symbol>`.
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/api/src/common-types.ts

## 6.3 Wrapping the compiled contract

**bboard / leaderboard style — `@midnight-ntwrk/midnight-js-protocol/compact-js`:**
```ts
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as CompiledBBoardContract from "./managed/bboard/contract/index.js";
import * as Witnesses from "./witnesses";

export const CompiledBBoardContractContract = CompiledContract.make<
  CompiledBBoardContract.Contract<Witnesses.BBoardPrivateState>
>("BBoard", CompiledBBoardContract.Contract<Witnesses.BBoardPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/bboard"),
);
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/contract/src/index.ts

Generalised:
```ts
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as Gen from "./managed/bboard/contract/index.js"; // compact compile output
import * as Witnesses from "./witnesses";

export const CompiledBBoardContractContract = CompiledContract.make<
  Gen.Contract<Witnesses.BBoardPrivateState>
>("BBoard", Gen.Contract<Witnesses.BBoardPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/bboard"),
);
```

**counter style — `@midnight-ntwrk/compact-js` + `withVacantWitnesses`:**
```ts
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Counter, type CounterPrivateState, witnesses } from '@midnight-ntwrk/counter-contract';

const counterCompiledContract = CompiledContract.make('counter', Counter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath), // .../contract/src/managed/counter
);
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-counter/main/counter-cli/src/api.ts
> (`withVacantWitnesses` for a contract with no witnesses; `withWitnesses(w)` when you have them.)

> ⚠️ Note in the raw research the counter snippet contained a typo `CompiactContract.withVacantWitnesses` in one place — the correct symbol is **`CompiledContract.withVacantWitnesses`**.

## 6.4 Deploy / find / call

```ts
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

const deployed = await deployContract(providers, {
  compiledContract: CompiledBBoardContractContract,
  privateStateId: 'bboardPrivateState',
  initialPrivateState: createBBoardPrivateState(randomBytes(32)),
});
const addr = deployed.deployTxData.public.contractAddress;

const found = await findDeployedContract<BBoardContract>(providers, {
  contractAddress: addr,
  compiledContract: CompiledBBoardContractContract,
  privateStateId: 'bboardPrivateState',
  initialPrivateState,
});

// circuit call from TypeScript:
const txData = await deployed.callTx.post(message); // callTx.<circuitName>(...args)
console.log(txData.public.txHash, txData.public.blockHeight);

// read ledger state:
const cs = await providers.publicDataProvider.queryContractState(addr);
const state = cs ? Gen.ledger(cs.data) : null;
// pure circuit off-chain: Gen.pureCircuits.publicKey(sk, bytes)
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/api/src/index.ts

counter-style (mono package import path):
```ts
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';

const counterContract = await deployContract(providers, {
  compiledContract: counterCompiledContract,
  privateStateId: 'counterPrivateState',
  initialPrivateState: privateState,
});
// address: counterContract.deployTxData.public.contractAddress

const joined = await findDeployedContract(providers, {
  contractAddress,
  compiledContract: counterCompiledContract,
  privateStateId: 'counterPrivateState',
  initialPrivateState: { privateCounter: 0 },
});

const finalizedTxData = await counterContract.callTx.increment();
// finalizedTxData.public.txId, finalizedTxData.public.blockHeight
```

> ⚠️ CONFLICT (minor): result field name for the tx hash.
> - bboard: **`txData.public.txHash`** and `txData.public.blockHeight`
> - counter: **`finalizedTxData.public.txId`** and `.blockHeight`
> **Resolution: check the `.d.ts` of your pinned version. bboard is on 4.1.1, counter on 4.0.4 — `txHash` is the newer name.**

Reading ledger state, counter style:
```ts
const state = await providers.publicDataProvider
  .queryContractState(contractAddress)
  .then((contractState) => (contractState != null ? Counter.ledger(contractState.data).round : null));
```

Observing state changes:
```ts
providers.publicDataProvider.contractStateObservable(address, { type: 'latest' })
```
Private state:
```ts
await providers.privateStateProvider.setContractAddress(address); // call this FIRST
const ps = await providers.privateStateProvider.get(key);
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/api/src/index.ts

## 6.5 Providers object — the six fields

`MidnightProviders<CircuitKeys, PrivateStateId, PrivateState>` has exactly six fields:

| Field | Constructor |
|---|---|
| `privateStateProvider` | `levelPrivateStateProvider({ privateStateStoreName, signingKeyStoreName, privateStoragePasswordProvider, accountId })` |
| `publicDataProvider` | `indexerPublicDataProvider(indexerUri, indexerWsUri)` |
| `zkConfigProvider` | `new NodeZkConfigProvider<K>(zkConfigPath)` (Node) / `new FetchZkConfigProvider<K>(origin, fetch)` (browser) |
| `proofProvider` | `httpClientProofProvider(proverServerUri, zkConfigProvider)` — **TWO args** |
| `walletProvider` | object with `getCoinPublicKey()`, `getEncryptionPublicKey()`, `balanceTx(tx, ttl?)` |
| `midnightProvider` | object with `submitTx(tx)` |

**Node-side, full:**
```ts
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';

setNetworkId('preview'); // 'undeployed' | 'preview' | 'preprod' — REQUIRED before ops
const zkConfigProvider = new NodeZkConfigProvider<'post' | 'takeDown'>(zkConfigPath);
const providers: BBoardProviders = {
  privateStateProvider: levelPrivateStateProvider<PrivateStateId, BBoardPrivateState>({
    privateStateStoreName: 'bboard-private-state',
    signingKeyStoreName: 'bboard-private-state-signing-keys',
    privateStoragePasswordProvider: () => 'Bboard-Test-2026!',
    accountId: seed,
  }),
  publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS),
  zkConfigProvider,
  proofProvider: httpClientProofProvider(env.proofServer, zkConfigProvider), // 2 args now
  walletProvider,   // { getCoinPublicKey(), getEncryptionPublicKey(), balanceTx(tx, ttl?) }
  midnightProvider, // { submitTx(tx) }
};
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/bboard-cli/src/index.ts

**counter's variant** (derives the storage password from the coin public key):
```ts
export const configureProviders = async (ctx: WalletContext, config: Config) => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<CounterCircuits>(contractConfig.zkConfigPath);
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(accountId, 'hex').toString('base64')}!`;
  return {
    privateStateProvider: levelPrivateStateProvider<typeof CounterPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-counter/main/counter-cli/src/api.ts

> ⚠️ `levelPrivateStateProvider` gained new options in 4.x: **`accountId`**, **`privateStoragePasswordProvider`**, `signingKeyStoreName` — in addition to `privateStateStoreName`. Note `walletProvider` and `midnightProvider` are often **the same object**.

`zkConfigPath` points at `contract/src/managed/<name>`.

## 6.6 Headless wallet from seed (no browser, no Lace)

### Simple: `FluentWalletBuilder` from `@midnight-ntwrk/testkit-js` — **use this**
```ts
import { type DustWalletOptions, type EnvironmentConfiguration, FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';
import { DustSecretKey, LedgerParameters, ZswapSecretKeys } from '@midnight-ntwrk/midnight-js-protocol/ledger';

const dustOptions: DustWalletOptions = {
  ledgerParams: LedgerParameters.initialParameters(),
  additionalFeeOverhead: env.walletNetworkId === 'undeployed' ? 500_000_000_000_000_000n : 1_000n,
  feeBlocksMargin: 5,
};
const builder = FluentWalletBuilder.forEnvironment(env).withDustOptions(dustOptions);
const { wallet, seeds, keystore } = seed
  ? await builder.withSeed(seed).buildWithoutStarting()
  : await builder.withRandomSeed().buildWithoutStarting();
// wallet: WalletFacade; seeds: { masterSeed, shielded, dust }; keystore: UnshieldedKeystore
// then: ZswapSecretKeys.fromSeed(seeds.shielded), DustSecretKey.fromSeed(seeds.dust)
// standalone genesis seed: '0000000000000000000000000000000000000000000000000000000000000001'
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/bboard-cli/src/midnight-wallet-provider.ts

### Manual: `WalletFacade` + three sub-wallets (counter pattern)
```ts
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, PublicKey, UnshieldedWallet, InMemoryTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as ledger from '@midnight-ntwrk/ledger-v8';

const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex')); // seed = 64-char hex
if (hdWallet.type !== 'seedOk') throw new Error('bad seed');
const r = hdWallet.hdWallet.selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0); // r.type === 'keysDerived'
const keys = r.keys;
const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

const wallet = await WalletFacade.init({
  configuration: { ...shieldedCfg, ...unshieldedCfg, ...dustCfg }, // networkId, indexerClientConnection{indexerHttpUrl,indexerWsUrl}, provingServerUrl, relayURL(node http->ws), txHistoryStorage, costParameters
  shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
  unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
  dust: (cfg) => DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
});
await wallet.start(shieldedSecretKeys, dustSecretKey);
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-counter/main/counter-cli/src/api.ts

> ⚠️ **`@midnight-ntwrk/wallet` (with `WalletBuilder.buildFromSeed`) is LEGACY** — npm latest 5.0.0 — and is **unused by every current example.** Your training memory of that API is stale.

### The wallet ↔ provider bridge
```ts
async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
  const recipe = await this.wallet.balanceUnboundTransaction(
    tx,
    { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
    { ttl },
  );
  const signedRecipe = await this.wallet.signRecipe(recipe, (payload) => this.unshieldedKeystore.signData(payload));
  return this.wallet.finalizeRecipe(signedRecipe);
}
submitTx(tx: FinalizedTransaction): Promise<string> {
  return this.wallet.submitTransaction(tx);
}
getCoinPublicKey() { return this.zswapSecretKeys.coinPublicKey; }
getEncryptionPublicKey() { return this.zswapSecretKeys.encryptionPublicKey; }
// NOTE: counter's api.ts replaces signRecipe with manual per-intent signing
// ('proof' marker for baseTransaction, 'pre-proof' for balancingTransaction)
// to work around wallet-SDK bug "Failed to clone intent".
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/bboard-cli/src/midnight-wallet-provider.ts

`ttlOneHour()` is a helper from `@midnight-ntwrk/midnight-js-utils`.

`DustWalletOptions` shape:
```ts
{
  ledgerParams: LedgerParameters.initialParameters(),
  additionalFeeOverhead: /* 500_000_000_000_000_000n on 'undeployed', 1_000n otherwise */,
  feeBlocksMargin: 5,
}
```

## 6.7 DUST registration for fees (headless)

```ts
const recipe = await wallet.registerNightUtxosForDustGeneration(
  nightUtxos, // state.unshielded.availableCoins not yet registered
  unshieldedKeystore.getPublicKey(),
  (payload) => unshieldedKeystore.signData(payload),
);
const finalized = await wallet.finalizeRecipe(recipe);
await wallet.submitTransaction(finalized);
// then wait until state.dust.balance(new Date()) > 0n before deploying
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-counter/main/counter-cli/src/api.ts

Lace UI equivalent: **Tokens → "Generate tDUST"**.

## 6.8 Browser: DApp connector / Lace

Package: **`@midnight-ntwrk/dapp-connector-api@4.0.1`**.

**`InitialAPI`** has: `name`, `icon`, `apiVersion`, `connect(networkId)`.
**`ConnectedAPI`** adds: `getConfiguration`, `getShieldedBalances`, `getUnshieldedBalances`, `getDustBalance`, `getShieldedAddresses`, `getUnshieldedAddress`, `getDustAddress`, `makeTransfer`, `makeIntent`, `balanceSealedTransaction`, `balanceUnsealedTransaction`, `submitTransaction`, `getProvingProvider`, `getConnectionStatus`.
> Source: https://docs.midnight.network/develop/reference/midnight-api/dapp-connector/

- `getConfiguration()` → `{ indexerUri, indexerWsUri, proverServerUri }`
- `getShieldedAddresses()` → `{ shieldedCoinPublicKey, shieldedEncryptionPublicKey }`
- `getConnectionStatus()` → `{ status: 'connected' | 'disconnected' }`
- `connect('preprod' | 'undeployed' | 'preview')`
> Source: https://docs.midnight.network/guides/react-wallet-connect

```ts
import { ConnectedAPI, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { toHex, fromHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import semver from 'semver';

// wallets are injected under window.midnight keyed by RANDOM UUID — never hardcode
const wallet = Object.values(window.midnight ?? {}).find(
  (w): w is InitialAPI => !!w && 'apiVersion' in w && semver.satisfies(w.apiVersion, '4.x'));
const connected: ConnectedAPI = await wallet.connect('preview'); // NOT enable()
const config = await connected.getConfiguration(); // { indexerUri, indexerWsUri, proverServerUri }
const addrs = await connected.getShieldedAddresses();
const zk = new FetchZkConfigProvider<CircuitKeys>(window.location.origin, fetch.bind(window));
const providers = {
  privateStateProvider, // in-memory or level
  zkConfigProvider: zk,
  proofProvider: httpClientProofProvider(config.proverServerUri!, zk),
  publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
  walletProvider: {
    getCoinPublicKey: () => addrs.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => addrs.shieldedEncryptionPublicKey,
    balanceTx: async (tx, ttl) => {
      const r = await connected.balanceUnsealedTransaction(toHex(tx.serialize()));
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(r.tx));
    },
  },
  midnightProvider: {
    submitTx: async (tx) => { await connected.submitTransaction(toHex(tx.serialize())); return tx.identifiers()[0]; },
  },
};
```
> Source: https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/bboard-ui/src/contexts/BrowserDeployedBoardManager.ts

`balanceUnsealedTransaction(hexTx)` and `submitTransaction(hexTx)` take **hex-serialized** transactions.
`Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature','proof','binding', bytes)` comes from `@midnight-ntwrk/midnight-js-protocol/ledger`.
`midnightProvider.submitTx(tx)` returns **the first element of `tx.identifiers()`**.

> ⚠️ **Browser DApps must serve the compiled `keys/` and `zkir/` directories** — `FetchZkConfigProvider` fetches them from `window.location.origin`.

### `dappConnectorProofProvider` — probably don't
```
dappConnectorProofProvider<K>(api: DAppConnectorProvingAPI, zkConfigProvider: ZKConfigProvider<K>, costModel: CostModel): Promise<ProofProvider>
```
> Source: https://docs.midnight.network/api-reference/midnight-js/@midnight-ntwrk/midnight-js-dapp-connector-proof-provider/functions/dappConnectorProofProvider

⚠️ **Lace reportedly does not implement `getProvingProvider()`** (version gap reported on the forum), so `dappConnectorProofProvider` may fail. **The official bboard UI uses `httpClientProofProvider(config.proverServerUri, zkConfigProvider)` instead** — users run a local proof server on `:6300`.
> Source: https://forum.midnight.network/t/lace-wallet-doesnt-implement-getprovingprovider-expected-behavior-or-version-gap/1213

### Lace extension identity — ⚠️ CONFLICT, resolved by [CRITIC]

| Extension | Chrome Web Store ID | Version | Status |
|---|---|---|---|
| **Lace** (main) — **USE THIS** | `gafhhkghbfjjkeiendhlofajokpaflmk` | **2.2.2**, updated **2026-08-20** | Midnight support merged in **April 2026** — *"no wallet to download"*. Midnight mainnet is live in Lace. |
| Lace Midnight Preview (legacy) | `hgeekaiplokcnmakghbdfbgnlfheichg` | 2.36.0, 2025-12-17 | **Legacy**, testnet-only, predates the merge. Its Dec-2025 launch required deleting the old extension and creating a fresh wallet. |

- example-bboard's README cites extension id `gafhhkghbfjjkeiendhlofajokpaflmk` and says "tested with version 1.36.0". **[CRITIC]: `1.36.0` is stale / in-app versioning.** The Chrome Web Store entry for that id is main Lace at **2.2.2**.
- Earlier research reported "Lace Midnight Preview extension v2.36.0" as the thing to install. **[CRITIC]: wrong — that's the legacy extension.** Install **main Lace**.
> Sources: https://chromewebstore.google.com/detail/gafhhkghbfjjkeiendhlofajokpaflmk ; https://www.lace.io/blog/one-wallet-for-all-midnight-is-now-inside-lace ; https://chromewebstore.google.com/detail/lace-midnight-preview/hgeekaiplokcnmakghbdfbgnlfheichg

**Lace setup for the bboard UI:** set **Network = Preprod** and **Proof server = Local (`http://localhost:6300`)**.

> ⚠️ UNVERIFIED / **[CRITIC] open question:** whether main Lace's network selector offers **Preview** (the bboard README only demonstrates **Preprod**). **Check at kickoff.** Fallbacks: (a) use Preprod, or (b) **skip Lace entirely** and use the headless seed-wallet CLI flow (FluentWalletBuilder), which needs no browser wallet at all.

## 6.9 npm registry access note

`npmjs.com` **web pages return HTTP 403** to plain fetchers. Query `registry.npmjs.org` or run `npm view` locally:
```bash
npm view @midnight-ntwrk/midnight-js-network-id version
npm view @midnight-ntwrk/midnight-js-contracts versions
```

---

# 7. Version compatibility matrix

## 7.1 Official docs support matrix (latest tested set, applies to Preview / Preprod / Mainnet)

| Component | Version |
|---|---|
| Proof server | **8.1.0** |
| Compact devtools (`compact` CLI) | **0.5.1** |
| Compact compiler (`compactc`) | **0.31.1** |
| Compact runtime | **0.16.0** |
| Compact JS | **2.5.1** |
| Platform JS | **2.2.4** |
| On-chain runtime | **3.0.0** |
| Wallet SDK | **1.2.0** |
| Midnight.js | **4.1.1** |
| testkit-js | **4.1.1** |
| DApp Connector API | **4.0.1** |
| Node | **1.0.1** (Preview) / **1.0.2** (Preprod, Mainnet) |
| Indexer | **4.3.5** (Preview) / **4.3.3-hotfix** (Preprod, Mainnet) |

> Source: https://docs.midnight.network/relnotes/support-matrix

## 7.2 Recommended pin set for THIS hackathon

```
# WSL Ubuntu
Node.js                                    24  (via nvm; satisfies bboard >=24.11.1)
compact CLI                                0.5.2   (GitHub latest, 2026-08-18)
compactc toolchain                         0.31.1  (GitHub latest, 2026-06-25)
Compact language                           0.23.0  → pragma language_version 0.23;

# Docker (from Windows PowerShell / Docker Desktop)
midnightntwrk/proof-server:8.1.0
midnightntwrk/midnight-node:1.0.0          (local devnet only)
midnightntwrk/indexer-standalone:4.3.3     (local devnet only)

# npm — EXACT versions, no ^ or ~
@midnight-ntwrk/midnight-js-*              4.1.1
@midnight-ntwrk/midnight-js-protocol       4.1.1
@midnight-ntwrk/dapp-connector-api         4.0.1
@midnight-ntwrk/testkit-js                 4.1.1
@midnight-ntwrk/wallet-sdk                 1.2.0
@midnight-ntwrk/compact-runtime            0.16.0  (MUST match compiler 0.31.1)
@midnight-ntwrk/ledger-v8                  8.1.0   (as pinned by midnight-js-protocol@4.1.1)
@midnight-ntwrk/compact-js                 2.5.1
@midnight-ntwrk/onchain-runtime-v3         3.0.0
@midnight-ntwrk/platform-js                2.2.4

# Browser
Lace (main extension) — Chrome id gafhhkghbfjjkeiendhlofajokpaflmk
VS Code extension compact-0.2.13.vsix
```

## 7.3 Documented version conflicts

| Item | Value A | Value B | Resolution |
|---|---|---|---|
| compact CLI | support matrix: **0.5.1** | GitHub release: **0.5.2** (2026-08-18) | **[CRITIC]: doc-lag, not a conflict. GitHub wins → 0.5.2.** |
| compactc | docs relnotes: **0.31.0** (29 Apr 2026) | GitHub: **0.31.1** (25 Jun 2026) | **[CRITIC]: doc-lag. GitHub wins → 0.31.1.** Both target language 0.23.0. |
| proof-server | bboard compose: **8.0.3** | docs + matrix: **8.1.0** | **[CRITIC]: docs-pinned wins → 8.1.0.** |
| indexer path | counter: **/api/v3/graphql** | bboard/docs/hosted: **/api/v4/graphql** | **[CRITIC]: v3 is midnight-js 4.0.x only. With the 4.1.1 stack use /api/v4/graphql.** |
| compact-runtime | counter pins **0.15.0** (pairs with compiler 0.30.0) | matrix: **0.16.0** (pairs with 0.31.1) | **[CRITIC]: with `compact update` → 0.31.1, use runtime 0.16.0 exactly. Or `compact compile +0.30.0` to run counter unmodified.** |
| Midnight.js | docs API reference renders **4.0.4** | npm latest: **4.1.1** | npm wins. Pin 4.1.1. |
| midnight-js beta | — | **5.0.0-beta.6** (2026-07-10) | **Avoid.** |
| `@midnight-ntwrk/ledger` | npm latest: **4.0.0** | docs llms.txt calls the Ledger API **v8.0.3**; midnight-js-protocol pins **ledger-v8@8.1.0**; npm latest for ledger-v8 is **8.1.1** | ⚠️ **Naming/versioning mismatch — `@midnight-ntwrk/ledger` and `@midnight-ntwrk/ledger-v8` are different packages.** Use **`ledger-v8`** via the `midnight-js-protocol/ledger` subpath; do **not** depend on `@midnight-ntwrk/ledger` directly. |
| compact-js | protocol@4.1.1 pins **2.5.1**; matrix says **2.5.1**; leaderboard pins **2.5.1** | npm latest: **2.5.3** | Use **2.5.1** (what the protocol package pins). |
| wallet-sdk | bboard pins **1.2.0** (via `resolutions`) | npm `latest` **dist-tag** is **1.1.0**, though 1.2.0 is published | Use **1.2.0** explicitly; the dist-tag is behind. |
| wallet-sdk-facade | counter: **^3.0.0** | npm latest: **4.0.1** | ⚠️ Depends which wallet pattern you use; prefer FluentWalletBuilder and let testkit-js resolve it. |
| midnight-node | bboard: **0.22.3** | create-mn-app: **1.0.0**; matrix (hosted): **1.0.1/1.0.2** | Local devnet → **1.0.0**. |
| indexer-standalone | counter **4.0.0** / bboard **4.0.1** | create-mn-app **4.3.3**; matrix **4.3.5 / 4.3.3-hotfix** | Local devnet → **4.3.3**. Avoid 4.3.4/4.4.0 (pre-alpha). |
| Node engine | quickstart **22+**, counter **>=22.15** | bboard **>=24.11.1** | Install **24**. |
| Lace version | bboard README: **1.36.0** | **[CRITIC]** Chrome Store: main Lace **2.2.2** | **2.2.2 / main Lace.** |
| MerkleTree depth | ledger-adt: `2 <= nat <= 32` | lang-ref: `1 < n <= 32` | **Equivalent. No conflict.** |
| Struct separators | docs: commas | zkloan: semicolons | **Both compile.** |

## 7.4 Fixing version mismatches

```bash
npm list @midnight-ntwrk/compact-runtime
npm list @midnight-ntwrk/ledger-v8
npm list @midnight-ntwrk/onchain-runtime-v3
```
Pin exact versions (no `^` / `~`), `npm ci`, then recompile:
```bash
compact compile src/contract.compact contract/managed
```
> Source: https://docs.midnight.network/how-to/fix-version-mismatches

---

# 8. Gotchas & traps

## 8.1 Environment / host

1. **[CRITIC] BLOCKER, verified locally: no Ubuntu WSL distro exists on this machine.** `wsl -l -v` shows only `docker-desktop`. Every toolchain command in the research presumes an Ubuntu. **Run `wsl --install -d Ubuntu` as the first action of hour 1.** Budget ~10 min for distro download + user setup + nvm/Node install inside it.
2. **No native Windows Compact toolchain.** The installer detects Windows and fails with *"there isn't a download for your platform"*. Compiler + repo build scripts (which use `rm -rf` / `cp -Rf`) go inside WSL2. Only the proof server / node / indexer containers run on the Windows-side Docker Desktop.
3. **PATH after install is ambiguous.** Three official sources give three different lines. Try `source ~/.bashrc`, then `source $HOME/.local/bin/env`, then `export PATH="$HOME/.compact/bin:$PATH"`. Open a new shell if `compact` isn't found.
4. **First `compact compile` downloads ~500 MB of ZK params** inside WSL — one-time, but start it early. Use `--skip-zk` while iterating.
5. **`compact update` with no argument installs the stable 0.31.1**, which is what current testnet/mainnet need. `compactc 0.33/0.34` are RC-only and **0.34.x requires the ledger-9 chain**.

## 8.2 Versioning / packages

6. **Do NOT install the compiler from npm** — `@midnight-ntwrk/compact` and `@midnight-ntwrk/compactc` are **E404**.
7. **`midnightntwrk/compact` is archived** (moved to `LFDT-Minokawa/compact`) but is still the correct download host for the installer per current docs. **Don't "fix" the URL.**
8. **Docker namespace is `midnightntwrk`, not `midnightnetwork`.** The old namespace stopped at `7.0.0-rc.1` (Jan 2026); tutorials citing it are stale.
9. **`latest` on Docker Hub currently equals 8.1.0 but `9.0.0-rc.x` tags exist.** Pin `:8.1.0` explicitly.
10. **Compiler and `@midnight-ntwrk/compact-runtime` must match exactly.** Pin exact versions, use `npm ci`.
11. **`docs.midnight.network` release-notes pages lag GitHub.** Trust GitHub releases for versions.
12. **`npmjs.com` returns 403 to plain fetchers** — query `registry.npmjs.org` or `npm view`.
13. **`5.0.0-beta.6` exists on npm under the `beta` tag.** Do not mix it in.

## 8.3 API surface (your training memory is wrong here)

14. **`NetworkId` is not an enum.** `NetworkId.TestNet` and `getZswapNetworkId` are gone. It's `type NetworkId = string` + `setNetworkId('preview'|'preprod'|'undeployed'|'mainnet')`.
15. **`getNetworkId()` THROWS if `setNetworkId` was never called.** No default. Call it before constructing any provider.
16. **The old public `testnet-02` / `TestNet` network is gone.** Networks are `undeployed`, `preview`, `preprod`, `mainnet`.
17. **Indexer path is `/api/v4/graphql`**, not v1/v2/v3. WS adds `/ws`.
18. **`deployContract` takes `compiledContract`**, not a raw `contract` + witnesses.
19. **`httpClientProofProvider` takes TWO args** — `(proverServerUri, zkConfigProvider)`.
20. **Import runtime/ledger types from `@midnight-ntwrk/midnight-js-protocol` subpaths** (`/compact-runtime`, `/ledger`, `/compact-js`). Do not directly depend on `@midnight-ntwrk/compact-runtime` or the old `@midnight-ntwrk/ledger`.
21. **`window.midnight` entries are keyed by freshly generated UUIDs.** `window.midnight.mnLace` no longer works — enumerate `Object.values` and filter by `semver.satisfies(w.apiVersion, '4.x')`.
22. **DApp connector v4 replaced `enable()`/`state()`/`serviceUriConfig()`** with `connect(networkId)` → `ConnectedAPI`.
23. **`@midnight-ntwrk/wallet` (`WalletBuilder.buildFromSeed`) is LEGACY** and unused by every current example. Wallets are `WalletFacade` with three sub-wallets (shielded / unshielded / dust).
24. **`levelPrivateStateProvider` now needs `accountId` and `privateStoragePasswordProvider`** (plus optional `signingKeyStoreName`) in addition to `privateStateStoreName`. Call `providers.privateStateProvider.setContractAddress(addr)` before `get`/`set`.
25. **`docs.midnight.network` URL scheme changed.** API reference is at `/api-reference/midnight-js/...`; the old `/develop/reference/midnight-api/midnight-js/modules/...` paths 404 (though `/develop/reference/midnight-api/dapp-connector/` still resolves). Compact reference moved to `/compact/*`.

## 8.4 Compact language

26. **`disclose()` is mandatory** on witness-derived values reaching ledger stores, exported-circuit returns, or cross-contract calls — **including `MerkleTree.insert` args and the digest passed to `checkRoot`.** Missing it: `potential witness-value disclosure must be declared but is not`.
27. **`MerkleTree.checkRoot` matches ONLY the current root.** Any later insert invalidates outstanding proofs. **`HistoricMerkleTree.checkRoot` matches any past root** — use it when members are added over time.
28. **No `.member(value)` / `.historicMember` on MerkleTree; no `.value` field on MerkleTreePath.** Membership is proven only via `merkleTreePathRoot(path)` + `checkRoot`, passing the whole struct.
29. **`root()`, `firstFree()`, `findPathForLeaf()`, `pathForLeaf()`, `history()` are TypeScript-only.** Calling them inside a circuit will not compile. The path must enter via a **witness**.
30. **`ownPublicKey()` is prover-claimed with no cryptographic binding to the tx signer.** Do not gate authorization on it. Derive identity from a witness secret key + domain-separated `persistentHash`.
31. **`Counter.increment`/`decrement` take `Uint<16>` but `read()` returns `Uint<64>`.** Decrementing below zero is a runtime error. Official code casts via `sequence as Field as Bytes<32>` and `nextId.read() as Uint<64>`.
32. **`Cell` is implicit.** You cannot write `ledger x: Cell<Field>` — write `ledger x: Field;`.
33. **[CRITIC] No official worked MerkleTree example exists** in `compact-by-example.org` (index covers only hello-world + tokens/ERC-style) or in bboard/counter/leaderboard. The **`ticket.compact` in `midnightntwrk/midnight-expert` is the closest thing to canonical** — start there and verify assert/witness syntax on first compile.

## 8.5 Runtime / operations

34. **Fees are paid in DUST generated from NIGHT.** Faucet → register for DUST generation → wait. **[CRITIC] The accrual rate is undocumented.** Register within hour 1 and poll `dust.balance > 0n` before deploying.
35. **The faucet wants the UNSHIELDED address** (`mn_addr_preview...` / `mn_addr_preprod...`), not shielded or dust. Captcha + rate limit (~1000 tNIGHT/request, several-hours cooldown after `Reached maximum number of requests`).
36. **Both faucet frontends work** (nethermind URLs are docs-canonical; `faucet.preprod.midnight.network` is also live). If one rate-limits, try the other — but **expect shared backend limits**.
37. **Do not mix networks.** A `'preprod'` networkId with preview indexer URLs (or vice versa) fails confusingly — docs explicitly call this out. Verify with `system_chain`.
38. **Wallet SDK `signRecipe` bug: `Failed to clone intent`** during deploy — `signRecipe` hardcodes a `'pre-proof'` marker. example-counter's `api.ts` ships a manual `signTransactionIntents` workaround (`'proof'` for `baseTransaction`, `'pre-proof'` for `balancingTransaction`). **Known follow-on: DUST balance can lock to 0 after a failed deploy — restart the app.**
39. **The proof server is never hosted.** Even against preview/preprod you run it yourself on `localhost:6300`.
40. **First proof-server run may fetch ZK parameters via its data provider** (override with `MIDNIGHT_PARAM_SOURCE`). A known forum issue involves missing zk params if that fetch fails.
41. **`indexer-standalone:4.3.3` requires a dummy `APP__INFRA__SPO_NODE__BLOCKFROST_ID` env var** to boot on a local devnet.
42. **Avoid proof-server 7.x on Apple Silicon** (hangs) — not relevant to this Windows host, but relevant if a teammate is on a Mac.
43. **CLI launchers run TypeScript directly** via `node --experimental-specifier-resolution=node --loader ts-node/esm` — no build step needed to *run*, **but compile + build the contract first** or you get `Cannot find module`.
44. **Don't mix the two SDK import styles** — mono `@midnight-ntwrk/midnight-js` with subpaths (counter) vs individual `midnight-js-*` packages + `midnight-js-protocol` subpaths (bboard/leaderboard).
45. **[CRITIC] Note on source integrity:** the merged research JSON handed to the critic was truncated mid-gotcha (`'Indexer GraphQL path differs b…'`). The lost text was the v3-vs-v4 indexer point, now fully covered in §7.3.

---

## Appendix A — every command, in one place

```bash
# --- Host setup (Windows PowerShell) ---
wsl -l -v
wsl --install -d Ubuntu
wsl -d Ubuntu
wsl --install -d ubuntu                     # docs' form; PowerShell as admin

# --- Inside WSL Ubuntu ---
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && nvm install 24
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source ~/.bashrc
source $HOME/.local/bin/env
export PATH="$HOME/.compact/bin:$PATH"

compact update
compact update 0.30.0
compact --version
compact compile --version
compact list
compact list --installed
compact check
compact clean
compact format --check --verbose
compact fixup
compact self update

compact compile <contract.compact> <output-dir>
compact compile --skip-zk <contract.compact> <output-dir>
compact compile +0.31.1 <contract.compact> <output-dir>
compact compile src/counter.compact src/managed/counter
compact compile src/bboard.compact ./src/managed/bboard
compact compile leaderboard.compact managed/leaderboard
compact compile src/contract.compact contract/managed

compactc --version && compactc --language-version && compactc --runtime-version && compactc --ledger-version
compactc src/test.compact obj/test

# --- Docker (Windows PowerShell, Docker Desktop) ---
docker pull midnightntwrk/proof-server:8.1.0
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
docker run -p 6301:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
docker ps | grep proof-server
docker compose -f proof-server.yml up
docker compose -f proof-server-local.yml up -d
docker compose down -v

# --- Project ---
npx create-mn-app my-app
npm run setup
npm run setup -- --network preview
npm run setup -- --network preprod
npm run cli
npm run test:e2e
npm install
cd contract && npm run compact && npm run build && npm run test
cd counter-cli && npm run standalone
cd counter-cli && npm run preprod-ps
cd bboard-cli && npm run standalone
cd bboard-cli && npm run preview-remote
cd bboard-cli && npm run preprod-remote
node --experimental-specifier-resolution=node --loader ts-node/esm src/launcher/preprod.ts

# --- Version checks ---
npm view @midnight-ntwrk/midnight-js-network-id version
npm view @midnight-ntwrk/midnight-js-contracts versions
npm list @midnight-ntwrk/compact-runtime
npm list @midnight-ntwrk/ledger-v8
npm list @midnight-ntwrk/onchain-runtime-v3

# --- Endpoint verification ---
curl -s -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}' https://rpc.preview.midnight.network
curl -s -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}' https://rpc.preprod.midnight.network
```

## Appendix B — key URLs

**Docs**
- Installation: https://docs.midnight.network/getting-started/installation
- Quickstart: https://docs.midnight.network/getting-started/quickstart
- Windows/WSL setup: https://docs.midnight.network/guides/windows-compact-setup
- Networks & environments: https://docs.midnight.network/guides/networks-and-environments
- Acquire tokens (faucet + DUST): https://docs.midnight.network/guides/acquire-tokens
- Query the blockchain: https://docs.midnight.network/guides/query-the-blockchain
- Deploy a DApp: https://docs.midnight.network/guides/deploy-mn-app
- React wallet connect: https://docs.midnight.network/guides/react-wallet-connect
- **Support matrix: https://docs.midnight.network/relnotes/support-matrix**
- Fix version mismatches: https://docs.midnight.network/how-to/fix-version-mismatches
- Release notes overview: https://docs.midnight.network/relnotes/overview
- Proof server 4.0.0 relnotes: https://docs.midnight.network/relnotes/proof-server/proof-server-4-0-0
- Proof server tutorial: https://docs.midnight.network/develop/tutorial/using/proof-server
- Compact language reference: https://docs.midnight.network/compact/reference/compact-reference
- **Ledger ADTs: https://docs.midnight.network/compact/reference/ledger-adt**
- **Standard library exports: https://docs.midnight.network/compact/standard-library/exports**
- Explicit disclosure: https://docs.midnight.network/compact/reference/explicit-disclosure
- Compiler usage: https://docs.midnight.network/compact/compilation-and-tooling/compiler-usage
- Dev-tool usage: https://docs.midnight.network/compact/compilation-and-tooling/dev-tool-usage
- Midnight.js API packages: https://docs.midnight.network/api-reference/midnight-js/packages
- DApp connector reference: https://docs.midnight.network/develop/reference/midnight-api/dapp-connector/
- Machine-readable index: **https://docs.midnight.network/llms.txt**
- Compact devtools blog: https://docs.midnight.network/blog/compact-developer-tools

**GitHub**
- Compact releases (artifact host): https://github.com/midnightntwrk/compact/releases
- Compact active dev: https://github.com/LFDT-Minokawa/compact/releases
- example-bboard: https://github.com/midnightntwrk/example-bboard
- example-counter (archived): https://github.com/midnightntwrk/example-counter
- midnight-leaderboard: https://github.com/midnightntwrk/midnight-leaderboard
- example-zkloan: https://github.com/midnightntwrk/example-zkloan
- midnight-expert (Compact patterns, ticket.compact): https://github.com/midnightntwrk/midnight-expert
- create-mn-app: https://github.com/midnightntwrk/create-mn-app
- midnight-js source: https://github.com/midnightntwrk/midnight-js
- midnight-docs source: https://github.com/midnightntwrk/midnight-docs

**Other**
- Docker Hub proof-server tags: https://hub.docker.com/v2/repositories/midnightntwrk/proof-server/tags
- Forum (getProvingProvider issue): https://forum.midnight.network/t/lace-wallet-doesnt-implement-getprovingprovider-expected-behavior-or-version-gap/1213
- Lace Midnight merge announcement: https://www.lace.io/blog/one-wallet-for-all-midnight-is-now-inside-lace
- compact-by-example (no Merkle example): https://compact-by-example.org/llms.txt

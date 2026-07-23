# codebase-memory-mcp

A local code-intelligence MCP server for this project. It builds a knowledge graph
of the codebase (functions, classes, call chains, HTTP routes, …) and exposes it
through MCP tools (`search_graph`, `trace_path`, `get_architecture`, …).

The binary is git-ignored. Run the install below once per machine, then restart
Cursor so it picks up `.cursor/mcp.json`.

## Install

### Windows (PowerShell)

```powershell
# Download v0.8.1
$tag = 'v0.8.1'
$asset = 'codebase-memory-mcp-windows-amd64.zip'
Invoke-WebRequest -Uri "https://github.com/DeusData/codebase-memory-mcp/releases/download/$tag/$asset" -OutFile "$env:TEMP\$asset" -UseBasicParsing
Invoke-WebRequest -Uri "https://github.com/DeusData/codebase-memory-mcp/releases/download/$tag/checksums.txt" -OutFile "$env:TEMP\checksums.txt" -UseBasicParsing

# Verify SHA-256
$expected = (Get-Content "$env:TEMP\checksums.txt" | Where-Object { $_ -like "*$asset*" } | Select-Object -First 1) -split '\s+')[0]
$actual = (Get-FileHash -Path "$env:TEMP\$asset" -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { throw "checksum mismatch: expected $expected, got $actual" }

# Extract here
Expand-Archive -Path "$env:TEMP\$asset" -DestinationPath $PSScriptRoot -Force
```

### macOS / Linux (bash)

```bash
tag=v0.8.1
asset="codebase-memory-mcp-linux-amd64.tar.gz"
[ "$(uname -m)" = "aarch64" ] && asset="codebase-memory-mcp-linux-arm64.tar.gz"
[ "$(uname)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ] && asset="codebase-memory-mcp-darwin-arm64.tar.gz"
[ "$(uname)" = "Darwin" ] && [ "$(uname -m)" = "x86_64" ] && asset="codebase-memory-mcp-darwin-amd64.tar.gz"

tmp="$(mktemp -d)"
curl -fsSL "https://github.com/DeusData/codebase-memory-mcp/releases/download/${tag}/${asset}" -o "${tmp}/${asset}"
curl -fsSL "https://github.com/DeusData/codebase-memory-mcp/releases/download/${tag}/checksums.txt" -o "${tmp}/checksums.txt"
expected="$(grep "${asset}" "${tmp}/checksums.txt" | awk '{print $1}')"
actual="$(sha256sum "${tmp}/${asset}" | awk '{print $1}')"
[ "$expected" = "$actual" ] || { echo "checksum mismatch"; exit 1; }

tar xzf "${tmp}/${asset}" -C "$(dirname "$0")"
```

## Smoke test

```powershell
& "$PSScriptRoot\codebase-memory-mcp.exe" --version
& "$PSScriptRoot\codebase-memory-mcp.exe" cli list_projects
```

You should see `codebase-memory-mcp 0.8.1` and a JSON response with `"projects":[]`.

## Wire up Cursor

`.cursor/mcp.json` already points at this binary via `${workspaceFolder}`. Restart
Cursor. The MCP server will appear under available tools with 14 tools:

`index_repository`, `list_projects`, `delete_project`, `index_status`,
`search_graph`, `trace_path`, `detect_changes`, `query_graph`, `get_graph_schema`,
`get_code_snippet`, `get_architecture`, `search_code`, `manage_adr`, `ingest_traces`.

## First index of this repo

Once the server is running, ask your agent:

> Index this project at the workspace root.

That writes the graph into `~/.cache/codebase-memory-mcp/` (not in this repo).
The per-project `.codebase-memory/` artifact is git-ignored.

## Update

```powershell
# Same commands as Install, with the new tag. Overwrite the existing files.
```

Or in CLI mode once the server is wired up:

```bash
codebase-memory-mcp update
```

## Uninstall

Remove this directory and the cache:

```powershell
Remove-Item -Recurse -Force "$PSScriptRoot\codebase-memory-mcp.exe"
Remove-Item -Recurse -Force "$PSScriptRoot\LICENSE"
Remove-Item -Recurse -Force "$PSScriptRoot\THIRD_PARTY_NOTICES.md"
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\codebase-memory-mcp"
```

Then delete the `codebase-memory` entry from `.cursor/mcp.json`.

## Security notes

- This binary reads your source code and writes to `~/.cache/codebase-memory-mcp/`.
  Everything happens locally — no network calls, no telemetry.
- Every release binary is SHA-256 checksummed and published alongside a SLSA-3
  provenance attestation. The install commands above verify the checksum.
- Source: https://github.com/DeusData/codebase-memory-mcp
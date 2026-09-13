# Azure DevOps Process Migrator for Node.js

This application provides you the ability to automate the [Process](https://docs.microsoft.com/en-us/vsts/work/customize/process/manage-process?view=vsts) export/import across Azure DevOps organizations through a Node.js CLI.

**NOTE:** This only works with 'Inherited Process'. For 'XML process' you may upload/download the process as a ZIP.

## Repository Status

This fork includes the upstream SDK/toolchain modernization (TypeScript 5 + `azure-devops-node-api` v17) and keeps usage/configuration guidance in this README aligned with this repository.

## Requirements

- **Node.js 20 LTS or later** (Node 22/24 are also supported)
- **npm 9+** (bundled with Node 20+)
- An Azure DevOps organization using **Inherited process model**

## Getting Started

### Run from source (recommended)

```bash
git clone https://github.com/DownAtTheBottomOfTheMoleHole/process-migrator.git
cd process-migrator
npm install
npm run build
node build/nodejs/nodejs/Main.js [--mode=<migrate|import|export>] [--config=<path>]
```

### Environment-variable based credentials (recommended)

Never put PATs directly in `configuration.json` if possible. Instead, pass them on the command line using `--sourceToken` / `--targetToken`:

```bash
node build/nodejs/nodejs/Main.js \
  --mode=migrate \
  --config=configuration.json \
  --sourceToken="$AZDO_SOURCE_TOKEN" \
  --targetToken="$AZDO_TARGET_TOKEN"
```

Or store them in a secrets manager and inject at runtime. The `configuration.json` file itself is plain JSONC — no environment variable substitution is performed.

### Install globally from GitHub

```bash
npm install -g github:DownAtTheBottomOfTheMoleHole/process-migrator
process-migrator [--mode=<migrate|import|export>] [--config=<path>]
```

## Contribute

```bash
npm install
npm run build
node build/nodejs/nodejs/Main.js <args>
```

## Documentation

### Command line parameters

- `--mode`: Optional, default `migrate`. Execution mode: `migrate` (export then import), `export`, or `import`.
- `--config`: Optional, default `./configuration.json`. Path to the configuration file.
- `--sourceToken`: Optional, override source PAT from command line.
- `--targetToken`: Optional, override target PAT from command line.
- `--overwriteProcessOnTarget`: Optional flag. Delete the process on target before import if it already exists.

### Required PAT scopes

| PAT | Minimum required scope |
|-----|----------------------|
| Source account | **Work Items** → Read |
| Target account | **Work Items** → Read, Write & Manage |

Both tokens also require **Processes** read/write access if your Azure DevOps version requires it separately.

### Configuration file structure

This file is in [JSONC](https://github.com/Microsoft/node-jsonc-parser) format (comments allowed).
The `AccountUrl` is the root URL to the organization, e.g. `https://dev.azure.com/MyOrgName`.

```json
{
    "sourceAccountUrl": "Source account URL. Required in export/migrate mode.",
    "sourceAccountToken": "PAT for source account. Required in export/migrate mode.",
    "targetAccountUrl": "Target account URL. Required in import/migrate mode.",
    "targetAccountToken": "PAT for target account. Required in import/migrate mode.",
    "sourceProcessName": "Source process name to export. Required in export/migrate mode.",
    "targetProcessName": "Optional. Override process name on import/migrate.",
    "options": {
        "processFilename": "Optional. File with process payload. Required in import mode.",
        "logLevel": "Verbosity: 'verbose'/'information'/'warning'/'error'",
        "logFilename": "Optional log file path. Defaults to 'output/processMigrator.log'.",
        "overwritePicklist": "Optional, default false. Overwrite picklist if it already exists on target.",
        "continueOnRuleImportFailure": "Optional, default false. Continue import on rule failures.",
        "continueOnIdentityDefaultValueFailure": "Optional, default false. Continue on identity default value failures.",
        "skipImportFormContributions": "Optional, default false. Skip importing form control contributions."
    }
}
```

### Notes

- If extensions used in the source account are not available in the target account, import **may** fail.
  Use `skipImportFormContributions: true` to skip custom form control contributions.
- If identities used in field default values or rules are not available in the target account, import **will** fail.
  Use `continueOnRuleImportFailure: true` or `continueOnIdentityDefaultValueFailure: true` to proceed past such failures.

### API / SDK changes (v17 upgrade)

This project now uses `azure-devops-node-api` v17. Key behavioral differences from the legacy v6 SDK:

| Area | Change |
|------|--------|
| Process list | `ProcessInfo[]` returned (was `ProcessModel[]`); `customizationType` field replaces `properties.class` |
| Behaviors | `ProcessBehavior[]` returned; `referenceName` field is the behavior ID (was `id`) |
| Rules | `ProcessRule[]` returned; `name` field is the rule name (was `friendlyName`) |
| Work item types | Retrieved via `WorkItemTrackingProcessDefinitionsApi.getWorkItemTypes()` (same types) |
| Process fields | Derived from per-WIT field queries (v17 SDK removed the process-level field list endpoint) |

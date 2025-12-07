// Picklist processing constants
export const PICKLIST_NO_ACTION = "PICKLIST_NO_ACTION";

// File system constants
export const defaultEncoding = "utf-8";
export const defaultConfigurationFilename = "configuration.json";
export const defaultLogFileName = "output\\processMigrator.log";
export const defaultProcessFilename = "output\\process.json";

// Command line parameter names
export const paramMode = "mode";
export const paramConfig = "config";
export const paramSourceToken = "sourceToken";
export const paramTargetToken = "targetToken";
export const paramOverwriteProcessOnTarget = "overwriteProcessOnTarget";
// Default configuration template with improved comments
export const defaultConfiguration =
    `{
        "sourceAccountUrl": "Required for export/migrate: Azure DevOps organization URL",
        "sourceAccountToken": "!!SECURE!! Required for export/migrate: Personal Access Token",
        "targetAccountUrl": "Required for import/migrate: Azure DevOps organization URL",
        "targetAccountToken": "!!SECURE!! Required for import/migrate: Personal Access Token",
        "sourceProcessName": "Required for export/migrate: Name of process to export",
        // "targetProcessName": "Optional: Override process name during import/migrate",
        "options": {
            // "processFilename": "Optional: Process definition file path (default: './output/process.json')",
            // "logLevel": "Optional: Logging level - Verbose/Information/Warning/Error (default: Information)",
            // "logFilename": "Optional: Log file path (default: 'output/processMigrator.log')",
            // "overwritePicklist": "Optional: Overwrite existing picklists on target (default: false)",
            // "continueOnRuleImportFailure": "Optional: Continue import if rule creation fails (default: false)",
            // "skipImportFormContributions": "Optional: Skip importing form contributions (default: false)",
        }
    }`;
// Regular expression to remove hyphens from GUIDs
export const regexRemoveHypen = new RegExp("-", "g");
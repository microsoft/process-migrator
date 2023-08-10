export const PICKLIST_NO_ACTION = "PICKLIST_NO_ACTION";
export const defaultEncoding = "utf-8";
export const defaultConfigurationFilename = "configuration.json";
export const defaultLogFileName = "output\\processMigrator.log";
export const defaultProcessFilename = "output\\process.json";
export const paramMode = "mode";
export const paramConfig = "config";
export const paramSourceToken = "sourceToken";
export const paramTargetToken = "targetToken";
export const paramOverwriteProcessOnTarget = "overwriteProcessOnTarget";
export const defaultConfiguration =
    `{
        "sourceAccountUrl": "Required in 'export'/'migrate' mode, source account url.",
        "sourceAccountToken": "!!TREAT THIS AS PASSWORD!! Required in 'export'/'migrate' mode, personal access token for source account.",
        "targetAccountUrl": "Required in 'import'/'migrate' mode, target account url.",
        "targetAccountToken": "!!TREAT THIS AS PASSWORD!! Required in 'import'/'migrate' mode, personal access token for target account.",
        "sourceProcessName": "Required in 'export'/'migrate' mode, source process name.",
        // "targetProcessName": "Optional, set to override process name in 'import'/'migrate' mode.",
        "options": {
            // "processFilename": "Required in 'import' mode, optional in 'export'/'migrate' mode to override default value './output/process.json'.",
            // "logLevel":"Optional, default as 'Information'. Logs at or higher than this level are outputed to console and rest in log file. Possiblee values are 'Verbose'/'Information'/'Warning'/'Error'.",
            // "logFilename":"Optional, default as 'output/processMigrator.log' - Set to override default log file name.",
            // "overwritePicklist": "Optional, default is 'false'. Set true to overwrite picklist if exists on target. Import will fail if picklist exists but different from source.",
            // "continueOnRuleImportFailure": "Optional, default is 'false', set true to continue import on failure importing rules, warning will be provided.",
            // "skipImportFormContributions": "Optional, default is 'false', set true to skip import control/group/form contributions on work item form.",
        }
    }`;
export const regexRemoveHypen = new RegExp("-", "g");
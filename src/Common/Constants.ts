export const PICKLIST_NO_ACTION = "PICKLIST_NO_ACTION";
export const defaultEncoding = "utf-8";
export const defaultConfigurationFilename = "configuration.json";
export const defaultLogFileName = "output\\pie.log";
export const defaultProcessFilename = "output\\process.json";
export const paramMode = "mode";
export const paramConfig = "config";
export const paramOverwriteProcessOnTarget = "overwriteProcessOnTarget";
export const defaultConfiguration =
    `{
        "sourceAccountUrl": "<Source account url>",
        "sourceAccountToken": "<Source account personal access token>",
        "targetAccountUrl": "<Target account url>",
        "targetAccountToken": "<Target account personal access token>",
        "sourceProcessName": "Process name for export, ignored in import only mode, required in export/both mode",
        // "targetProcessName": "Set to override process name on import",
        "options": {
            // "processFilename": "Default is 'output/process.json', set to override default export file name",
            // "logLevel": "Default is information, set to override log level, possible values are verbose/information/warning/error",
            // "logFilename": "Default is 'output/pie.log', set to override default log file name",
            // "continueOnRuleImportFailure": "Default is false, Set true to continue import on failure importing rules, warning will still be provided"
            // "skipImportControlContributions": "Default is false, Set true to skip import control contributions on work item form."
            // "skipImportGroupOrPageContributions": "Default is true, Set false to allow import group/page contributions on work item form. This should only be used when you want to hide contribution group/page."
            // "overwritePicklist": "Default is false, Set true to overwrite picklist if exist on target account."
        }
    }`;
export const regexRemoveHypen = new RegExp("-","g");
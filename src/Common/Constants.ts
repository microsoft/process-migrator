export const PICKLIST_NO_ACTION = "PICKLIST_NO_ACTION";
export const defaultEncoding = "utf-8";
export const defaultConfigurationFilename = "configuration.json";
export const defaultLogFileName = "output\\process_import_export.log";
export const defaultProcessFilename = "output\\process.json";
export const paramMode = "mode";
export const paramConfig = "config";
export const paramOverwriteProcessOnTarget = "overwriteProcessOnTarget";
export const defaultConfiguration =
    {
        "sourceAccountUrl": "<Source account url>",
        "sourceAccountToken": "<Source account PAT>",
        "targetAccountUrl": "<Target account url>",
        "targetAccountToken": "<Target account PAT>",
        "sourceProcessName": "Process name for export, optional in import only mode, required in export/both mode",
        "targetProcessName<Optional>": "Set to override process name on import, remove <Optional> from param name",
        "options": {
            "processFilename<Optional>": "Set to override default export file name, remove <Optional> from param name",
            "logLevel<Optional>": "Set to override default log level (Information), remove <Optional> from param name",
            "logFilename<Optional>": "Set to override default log file name, remove <Optional> from param name",
            "overwritePicklist": false
        }
    };
export const regexRemoveHypen = new RegExp("-","g");
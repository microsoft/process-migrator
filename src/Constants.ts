export const PICKLIST_NO_ACTION = "PICKLIST_NO_ACTION";
export const configurationFilename = "configuration.json";
export const defaultEncoding = "utf-8";
export const defaultLogFileName = "process_import_export.log";
export const defaultConfiguration = {
    "sourceAccountUrl": "<Source account url - eg: https://fabrikamSource.visualstudio.com>",
    "sourceAccountToken": "<Personal access token for source account>",
    "targetAccountUrl": "<Target account url - eg: https://fabrikamTarget.visualstudio.com>",
    "targetAccountToken": "<Personal access token for target account, may be same as source>",
    "options" : {
        "sourceProcessName": "<Process to import/export - eg: MyAgile>",
        "writeToFile": true,
        "onlineReImport": true
    }
};
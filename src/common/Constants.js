"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regexRemoveHypen = exports.defaultConfiguration = exports.paramOverwriteProcessOnTarget = exports.paramTargetToken = exports.paramSourceToken = exports.paramConfig = exports.paramMode = exports.defaultProcessFilename = exports.defaultLogFileName = exports.defaultConfigurationFilename = exports.defaultEncoding = exports.PICKLIST_NO_ACTION = void 0;
exports.PICKLIST_NO_ACTION = "PICKLIST_NO_ACTION";
exports.defaultEncoding = "utf-8";
exports.defaultConfigurationFilename = "configuration.json";
exports.defaultLogFileName = "output\\processMigrator.log";
exports.defaultProcessFilename = "output\\process.json";
exports.paramMode = "mode";
exports.paramConfig = "config";
exports.paramSourceToken = "sourceToken";
exports.paramTargetToken = "targetToken";
exports.paramOverwriteProcessOnTarget = "overwriteProcessOnTarget";
exports.defaultConfiguration = `{
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
exports.regexRemoveHypen = new RegExp("-", "g");
//# sourceMappingURL=Constants.js.map
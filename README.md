# VSTS Process Migrator for Node.js

This application provide you ability to automate the [Process](https://docs.microsoft.com/en-us/vsts/work/customize/process/manage-process?view=vsts) export/import across VSTS accounts through Node.js CLI.

NOTE: This only works with 'Inherited Process', for 'XML process' you may upload/download process as ZIP. 
 
# Getting Started

## Run

- Install npm if not yet - [link](https://www.npmjs.com/get-npm)
- Install this package through `npm install process-migrator -g` 
- Create and fill required information in config file *configuration.json*. See [doc section](#documentation) for details

   Just run ```processMigrator``` will create the file if not exist.

   ##### ![](https://imgplaceholder.com/100x17/cccccc/fe2904?text=WARNING&font-size=15) CONFIGURATION FILE HAS PAT, RIGHT PROTECT IT !
- Run `processMigrator [--mode=<migrate(default)import/export> [--config=<your-configuration-file-path>]`
  
## Contribute

- From the root of source, run `npm install`
- Build by `npm run build`
- Execute through `node build\nodejs\nodejs\main.js <args>`

## Documentation
##### Command line parameters
- --mode: Optional, defaulted to 'migrate'. Mode of the execution, can be 'migrate' (export and then import), 'export' (export only) or 'import' (import only).
- --config: Optional, default to './configuration.json'. Specify the configuration file.
##### Configuration file strcuture
- This file is in [JSONC](https://github.com/Microsoft/node-jsonc-parser) format, you don't have to remove comments lines for it to work. 
``` json
{
    "sourceAccountUrl": "Required in 'export'/'migrate' mode, source account url.",
    "sourceAccountToken": "!!TREAT THIS AS PASSWORD!! Required in 'export'/'migrate' mode, personal access token for source account.",
    "targetAccountUrl": "Required in 'import'/'migrate' mode, target account url.",
    "targetAccountToken": "!!TREAT THIS AS PASSWORD!! Required in 'import'/'migrate' mode, personal access token for target account.",
    "sourceProcessName": "Required in 'export'/'migrate' mode, source process name.",
    "targetProcessName": "Optional, set to override process name in 'import'/'migrate' mode.",
    "options": {
        "processFilename": "Required in 'import' mode, optional in 'export'/'migrate' mode to override default value './output/process.json'.",
        "logLevel":"Optional, default as 'Information'. Logs at or higher than this level are outputed to console and rest in log file. Possiblee values are 'Verbose'/'Information'/'Warning'/'Error'.",
        "logFilename":"Optional, default as 'output/processMigrator.log' - Set to override default log file name.",
        "overwritePicklist": "Optional, default is 'false'. Set true to overwrite picklist if exists on target. Import will fail if picklist exists but different from source.",
        "continueOnRuleImportFailure": "Optional, default is 'false', set true to continue import on failure importing rules, warning will be provided.",
        "skipImportFormContributions": "Optional, default is 'false', set true to skip import control contributions on work item form.",
    }
}
```

##### Notes 
- If extensions used by source account are not available in target account, import MAY fail
   1) Control/Group/Page contributions on work item form are by default imported, so it will fail if the extension is not available on target account. use 'skipImportFormContributions' option to skip importing custom controls.
- If identities used in field default value or rules are not available in target account, import WILL fail
   1) For rules you may use 'continueOnRuleImportFailure' option to proceed with rest of import when such error is occurred.
   2) For identity field default value, you may use 'continueOnFieldDefaultValueFailure' option to proceed with rest of import when such error is occurred.

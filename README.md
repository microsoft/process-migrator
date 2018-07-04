# VSTS Process Migrator for Node.js

This application provide you ability to automate the [Process](https://docs.microsoft.com/en-us/vsts/work/customize/process/manage-process?view=vsts) export/import across VSTS accounts through Node.js CLI.

NOTE: This only works with 'Inherited Process', for 'XML process' you may upload/download process as ZIP. 
 
# Getting Started

## Run

- Install npm if not yet - [link](https://www.npmjs.com/get-npm)
- Install this package through `npm install process-migrator -g` 
- Create and fill required information in config file *configuration.json*. See [document section](#documentation) for details

   Just run ```process-migrator``` without any argument will create the file if it does not exist.

   ##### ![](https://imgplaceholder.com/100x17/cccccc/fe2904?text=WARNING&font-size=15) CONFIGURATION FILE HAS PAT, RIGHT PROTECT IT !
- Run `process-migrator [--mode=<migrate(default)import/export> [--config=<your-configuration-file-path>]`
  
## Contribute

- From the root of source, run `npm install`
- Build by `npm run build`
- Execute through `node build\nodejs\nodejs\main.js <args>`

## Documentation
##### Command line parameters
- --mode: Optional, default as 'migrate'. Mode of the execution, can be 'migrate' (export and then import), 'export' (export only) or 'import' (import only).
- --config: Optional, default as './configuration.json'. Specify the configuration file.
##### Configuration file strcuture
- This file is in [JSONC](https://github.com/Microsoft/node-jsonc-parser) format, you don't have to remove comments lines for it to work. 
``` json
{
    "sourceAccountUrl": "Source account url. Required in export/migrate mode, ignored in import mode. ",
    "sourceAccountToken": "!!TREAT AS PASSWORD!! Personal access token for source account. Required in export/migrate mode, ignored in import mode.",
    "targetAccountUrl": "Target account url. Required in import/migrate mode, ignored in export mode. ",
    "targetAccountToken": "!!TREAT AS PASSWORD!! Personal access token for target account. Required in import/migrate mode, ignored in export mode.",
    "sourceProcessName": "Source process name to export. Required in export/migrate mode, ignored in import mode. ",
    "targetProcessName": "Optional. Set to override process name in import/migrate mode.",
    "options": {
        "processFilename": "File with process payload. Required in import mode, optional for export/migrate mode.",
        "logLevel":"Optional, log level for console. Possibe values are 'Verbose'/'Information'/'Warning'/'Error'.",
        "logFilename":"Optional, file name for log. defaulted to 'output/processMigrator.log'",
        "overwritePicklist": "Optional, default to 'false'. Set as true to overwrite picklist if exists on target or import will fail when picklist entries varies across source and target",
        "continueOnRuleImportFailure": "Optional, default to 'false', set true to continue import on failure importing rules, warning will be provided.",
        "skipImportFormContributions": "Optional, default to 'false', set true to skip import control contributions on work item form.",
    }
}
```

##### Notes 
- If extensions used by source account are not available in target account, import MAY fail
   1) Control/Group/Page contributions on work item form are by default imported, so it will fail if the extension is not available on target account. use 'skipImportFormContributions' option to skip importing custom controls.
- If identities used in field default value or rules are not available in target account, import WILL fail
   1) For rules you may use 'continueOnRuleImportFailure' option to proceed with rest of import when such error is occurred.
   2) For identity field default value, you may use 'continueOnFieldDefaultValueFailure' option to proceed with rest of import when such error is occurred.

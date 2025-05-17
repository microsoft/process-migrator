# VSTS Process Migrator for Node.js

**NOTE:** When running the process migrator on Node.js v23.10+ you will get the below error:

> C:\Users***\AppData\Roaming\npm\node_modules\process-migrator\build\nodejs\nodejs\NodeJsUtilities.js:23
> if (!util_1.isFunction(stdin.setRawMode)) {
> ^
> TypeError: util_1.isFunction is not a function

We are working on resolving this (see issues #107, #108).

This application provide you ability to automate the [Process](https://docs.microsoft.com/en-us/vsts/work/customize/process/manage-process?view=vsts) export/import across VSTS accounts through Node.js CLI.

**NOTE:** This only works with 'Inherited Process', for 'XML process' you may upload/download process as ZIP. 
 
# Getting Started

## Run

To run this tool you must have both NodeJS and NPM installed. They are available as a single package and instructions are below.

- Install Node from https://nodejs.org/en/download/ or https://nodejs.org/en/download/package-manager/
- Install this package through `npm install process-migrator -g` 
- Create and fill required information in config file *configuration.json*. See [document section](#documentation) for details

   Just run ```process-migrator``` without any argument will create the file if it does not exist.

   ##### ![](https://imgplaceholder.com/100x17/cccccc/fe2904?text=WARNING&font-size=15) CONFIGURATION FILE HAS PAT, RIGHT PROTECT IT !
- Run `process-migrator [--mode=<migrate(default)/import/export>] [--config=<your-configuration-file-path>]`
  
## Contribute

- From the root of source, run `npm install`
- Build by `npm run build`
- Execute through `node build\nodejs\nodejs\Main.js <args>`

## Documentation

##### Command line parameters
- --mode: Optional, default as 'migrate'. Mode of the execution, can be 'migrate' (export and then import), 'export' (export only) or 'import' (import only).
- --config: Optional, default as './configuration.json'. Specify the configuration file.

##### Configuration file structure
- This file is in [JSONC](https://github.com/Microsoft/node-jsonc-parser) format, you don't have to remove comments lines for it to work. 
- The AccountUrl for the source and target is the root URL to the organization. Example: https://dev.azure.com/MyOrgName.
- The Personal Access Token (PAT) for both the source and target must have the Work Items 'Read, Write, & Manage' permission scope.

``` json
{
    "sourceAccountUrl": "Source account url. Required in export/migrate mode, ignored in import mode.",
    "sourceAccountToken": "!!TREAT AS PASSWORD!! In Azure DevOps click on user settings personal access tokens an generate a token for source account. Required in export/migrate mode, ignored in import mode.",
    "targetAccountUrl": "Target account url. Required in import/migrate mode, ignored in export mode.",
    "targetAccountToken": "!!TREAT AS PASSWORD!! In Azure DevOps click on user settings personal access tokens and generate a token for target account. Required in import/migrate mode, ignored in export mode.",
    "sourceProcessName": "Source process name to export. Required in export/migrate mode, ignored in import mode.",
    "targetProcessName": "Optional. Set to override process name in import/migrate mode.",
    "options": {
        "processFilename": "Optional File with process payload. Required in import mode, optional for export/migrate mode.",
        "logLevel":"log level for console. Possible values are 'verbose'/'information'/'warning'/'error' or null.",
        "logFilename":"Optional, file name for log. defaulted to 'output/processMigrator.log'.",
        "overwritePicklist": "Optional, default to 'false'. Set as true to overwrite picklist if exists on target or import will fail when picklist entries varies across source and target.",
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
- Personal Access Token (PAT) needs to allow "Read, write, & manage" access for the "Work Items" scope
   1) The tool needs to be able to modify the definition of work items and work item types (to add custom fields for example).

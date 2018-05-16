# VSTS Process Import/Export for Node.js

This application provide you ability to automate the [Process](https://docs.microsoft.com/en-us/vsts/work/customize/process/manage-process?view=vsts) import/export across VSTS accounts through Node.js commmand line interface.

NOTE: This only works with 'Inherited Process', for 'XML process' you can upload/download process as ZIP. 

 
# Getting Started

## Run

- Install npm if haven't - [link](https://www.npmjs.com/get-npm)
- Install this package through `npm install vsts-process-import-export -g` 
- Create a configuration.json, see [doc section](#documentation) for explanation on details 
- Run `vstspie --mode=<import/export/both> [--config=<your-configuration-file-path>] [--overwriteProcessOnTarget]`
  
## Contribute

- From the root of source, run `npm install`
- Build by `npm run build`
- Execute through `node build\main.js <args>`

## Documentation
##### Command line parameters
- --mode: Mode of the application, can be import, export or both 
- --config: Optional, use to specify a non-default configuration file. (Default is Configuration.json under current folder)
- --overwriteProcessOnTarget: Optional, if set to true import will delete the process with same name before start, otherwise import fails if process exists on target account. 
##### Configuration file strcuture
``` json
{
    "sourceAccountUrl": "Required in 'export/both' mode, source account url.",
    "sourceAccountToken": "Required in 'export/both' mode, personal access token for source account.",
    "targetAccountUrl": "Required in 'import/both' mode, target account url.",
    "targetAccountToken": "Required in 'import/both' mode, personal access token for target account.",
    "sourceProcessName": "Process name for export, required in 'export/both' mode and not used in 'import' mode.",
    "targetProcessName": "Optional - Set to override process name on import.",
    "options": {
        "processFilename": "Required in 'import' mode, optional in 'export/both' mode to override default process export file name.",
        "logLevel":"Optional - Set to override default log level (Information), possible values are 'Verbose'/'Information'/'Warning'/'Error'.",
        "logFilename":"Optional - Set to override default log file name",
        "overwritePicklist": "Set true to overwrite picklist if exists on target, otherwise import will fail if picklist exists but different from source."
    }
}
```
# Introduction

The Process Import/Export (PIE) feature provides users with a way to automate the [Process](https://docs.microsoft.com/en-us/vsts/work/customize/process/manage-process?view=vsts) replication across accounts through a Node.js command line interface.

The tool gives user option to export a Process from an account, and save it locally, and/or to do an online re-import into another account.

  
# Getting Started


**1. Prerequisite**

- Install [npm](https://www.npmjs.com/get-npm)
- From repository root, run `npm install` 
  
**2. Build**

- In root directory of repository, run `npm run build`

**3. Run**

- Set up `configuration.json`
	- Configure account url and credentials. Source account is required; target account credentials required only if doing online re-import.
	- `"sourceProcessName"` name of the Process on the source account to export.
	- `"targetProcessName"` optional new name to give to Process in the target account.
	-  `"writeToFile"` serialize exported Process to file (not mutually exclusive with onlineReImport)
	- `"onlineReImport"` whether exported Process should be imported into specified target account.
	- `"overwritePicklist"` property that specifies which to keep if there is a conflict (by refName) between the picklists on source and target.

- Launch application `node ./build/ImportExportProcess.js` on root directory of repository.
import { existsSync, writeFileSync } from "fs";
import * as vsts from "vso-node-api/WebApi";
import * as WITProcessDefinitionsInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import { IWorkItemTrackingProcessDefinitionsApi as WITProcessDefinitionApi } from "vso-node-api/WorkItemTrackingProcessDefinitionsApi";
import { IWorkItemTrackingProcessApi as WITProcessApi } from "vso-node-api/WorkItemTrackingProcessApi";
import { IWorkItemTrackingApi as WITApi } from "vso-node-api/WorkItemTrackingApi";
import { defaultProcessFilename } from "./Constants";
import { ExportError } from "./Errors";
import { IConfigurationFile, IDictionaryStringTo, IProcessPayload, IWITBehaviors, IWITBehaviorsInfo, IWITFieldPicklist, IWITLayout, IWITRules, IWITStates, IWITypeFields } from "./Interfaces";
import { logger } from "./Logger";
import { Engine } from "./Engine";
import { Utility } from "./Utilities";
import { dirname, resolve } from "path";
import { sync as mkdirpSync } from "mkdirp";
import { ProcessClass } from "vso-node-api/interfaces/WorkItemTrackingProcessInterfaces";

export class ProcessExporter {
    private _vstsWebApi: vsts.WebApi;
    private _witProcessApi: WITProcessApi;
    private _witProcessDefinitionApi: WITProcessDefinitionApi;
    private _witApi: WITApi;

    constructor(vstsWebApi: vsts.WebApi, private _config: IConfigurationFile) {
        this._vstsWebApi = vstsWebApi;
    }

    private async _getApis() {
        this._witApi = await this._vstsWebApi.getWorkItemTrackingApi();
        this._witProcessApi = await this._vstsWebApi.getWorkItemTrackingProcessApi();
        this._witProcessDefinitionApi = await this._vstsWebApi.getWorkItemTrackingProcessDefinitionApi();
    }

    private async _getSourceProcessId(): Promise<string> {
        const processes = await Utility.tryCatchWithKnownError(() => this._witProcessApi.getProcesses(),
            () => new ExportError(`Error getting processes on source account '${this._config.sourceAccountUrl}, check account url, token and token permissions.`));

        if (!processes) { // most likely 404
            throw new ExportError(`Failed to get processes on source account '${this._config.sourceAccountUrl}', check account url.`);
        }

        const lowerCaseSourceProcessName = this._config.sourceProcessName.toLocaleLowerCase();
        const matchProcesses = processes.filter(p => p.name.toLocaleLowerCase() === lowerCaseSourceProcessName);
        if (matchProcesses.length === 0) {
            throw new ExportError(`Process '${this._config.sourceProcessName}' is not found on source account.`);
        }

        const process = matchProcesses[0];
        if (process.properties.class !== ProcessClass.Derived) {
            throw new ExportError(`Proces '${this._config.sourceProcessName}' is not a derived process, not supported.`);
        }
        return process.typeId;
    }

    private async _getComponents(processId: string): Promise<IProcessPayload> {
        let _process: WITProcessInterfaces.ProcessModel;
        let _behaviorsCollectionScope: WITProcessInterfaces.WorkItemBehavior[];
        let _fieldsCollectionScope: WITProcessInterfaces.FieldModel[];
        const _fieldsWorkitemtypeScope: IWITypeFields[] = [];
        const _layouts: IWITLayout[] = [];
        const _states: IWITStates[] = [];
        const _rules: IWITRules[] = [];
        const _behaviorsWITypeScope: IWITBehaviors[] = [];
        const _picklists: IWITFieldPicklist[] = [];
        const knownPicklists: IDictionaryStringTo<boolean> = {};
        const _nonSystemWorkItemTypes: WITProcessDefinitionsInterfaces.WorkItemTypeModel[] = [];
        const processPromises: Promise<any>[] = [];

        processPromises.push(this._witProcessApi.getProcessById(processId).then(process => _process = process));
        processPromises.push(this._witProcessApi.getFields(processId).then(fields => _fieldsCollectionScope = fields));
        processPromises.push(this._witProcessApi.getBehaviors(processId).then(behaviors => _behaviorsCollectionScope = behaviors));
        processPromises.push(this._witProcessApi.getWorkItemTypes(processId).then(workitemtypes => {
            const perWitPromises: Promise<any>[] = [];

            for (const workitemtype of workitemtypes) {
                const currentWitPromises: Promise<any>[] = [];

                currentWitPromises.push(this._witProcessDefinitionApi.getBehaviorsForWorkItemType(processId, workitemtype.id).then(behaviors => {
                    const witBehaviorsInfo: IWITBehaviorsInfo = { refName: workitemtype.id, workItemTypeClass: workitemtype.class };
                    const witBehaviors: IWITBehaviors = {
                        workItemType: witBehaviorsInfo,
                        behaviors: behaviors
                    }
                    _behaviorsWITypeScope.push(witBehaviors);
                }));

                if (workitemtype.class !== WITProcessInterfaces.WorkItemTypeClass.System) {
                    _nonSystemWorkItemTypes.push(workitemtype);

                    currentWitPromises.push(this._witProcessDefinitionApi.getWorkItemTypeFields(processId, workitemtype.id).then(fields => {
                        const witFields: IWITypeFields = {
                            workItemTypeRefName: workitemtype.id,
                            fields: fields
                        };
                        _fieldsWorkitemtypeScope.push(witFields);

                        const picklistPromises: Promise<any>[] = [];
                        for (const field of fields) {
                            if (field.pickList && !knownPicklists[field.referenceName]) { // Same picklist field may exist in multiple work item types but we only need to export once (At this moment the picklist is still collection-scoped)
                                knownPicklists[field.pickList.id] = true;
                                picklistPromises.push(this._witProcessDefinitionApi.getList(field.pickList.id).then(picklist => _picklists.push(
                                    {
                                        workitemtypeRefName: workitemtype.id,
                                        fieldRefName: field.referenceName,
                                        picklist: picklist
                                    })));
                            }
                        }
                        return Promise.all(picklistPromises)
                    }));

                    let layoutForm: WITProcessDefinitionsInterfaces.FormLayout;
                    currentWitPromises.push(this._witProcessDefinitionApi.getFormLayout(processId, workitemtype.id).then(layout => {
                        const witLayout: IWITLayout = {
                            workItemTypeRefName: workitemtype.id,
                            layout: layout
                        }
                        _layouts.push(witLayout);
                    }));

                    currentWitPromises.push(this._witProcessDefinitionApi.getStateDefinitions(processId, workitemtype.id).then(states => {
                        const witStates: IWITStates = {
                            workItemTypeRefName: workitemtype.id,
                            states: states
                        }
                        _states.push(witStates);
                    }));

                    currentWitPromises.push(this._witProcessApi.getWorkItemTypeRules(processId, workitemtype.id).then(rules => {
                        const witRules: IWITRules = {
                            workItemTypeRefName: workitemtype.id,
                            rules: rules
                        }
                        _rules.push(witRules);
                    }));
                }
                perWitPromises.push(Promise.all(currentWitPromises));
            }

            return Promise.all(perWitPromises);
        }));

        //NOTE: it maybe out of order for per-workitemtype artifacts for different work item types 
        //      for example, you may have Bug and then Feature for 'States' but Feature comes before Bug for 'Rules'
        //      the order does not matter since we stamp the work item type information 
        await Promise.all(processPromises);

        const processPayload: IProcessPayload = {
            process: _process,
            fields: _fieldsCollectionScope,
            workItemTypeFields: _fieldsWorkitemtypeScope,
            workItemTypes: _nonSystemWorkItemTypes,
            layouts: _layouts,
            states: _states,
            rules: _rules,
            behaviors: _behaviorsCollectionScope,
            workItemTypeBehaviors: _behaviorsWITypeScope,
            witFieldPicklists: _picklists
        };

        return processPayload;
    }

    private async _writeProcessPayload(exportFilename: string, payload: IProcessPayload) {
        const folder = dirname(exportFilename);
        if (!existsSync(folder)) {
            mkdirpSync(folder);
        }
        await writeFileSync(exportFilename, JSON.stringify(payload, null, 2), { flag: "w" });
    }

    public async exportProcess(): Promise<IProcessPayload> {
        logger.logInfo("Export process started.");

        await Utility.tryCatchWithKnownError(
            () => this._getApis(),
            () => new ExportError(`Failed to connect or authenticate with source account '${this._config.sourceAccountUrl}' - check url and token.`));


        const processId = await Engine.Task(() => this._getSourceProcessId(), "Get source process Id from name");
        const payload = await Engine.Task(() => this._getComponents(processId), "Get artifacts from source process");

        const exportFilename = (this._config.options && this._config.options.processFilename) || defaultProcessFilename;
        await Engine.Task(() => this._writeProcessPayload(exportFilename, payload), "Write process payload to file")
        logger.logInfo(`Export process completed successfully to '${resolve(exportFilename)}'.`);
        return payload;
    }
}

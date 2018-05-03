import { writeFileSync } from "fs";
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

export class ProcessExporter {
    private vstsWebApi: vsts.WebApi;
    private witProcessApi: WITProcessApi;
    private witProcessDefinitionApi: WITProcessDefinitionApi;
    private witApi: WITApi;

    constructor(vstsWebApi: vsts.WebApi, private config: IConfigurationFile) {
        this.vstsWebApi = vstsWebApi;
    }

    public async getApis() {
        this.witApi = await this.vstsWebApi.getWorkItemTrackingApi();
        this.witProcessApi = await this.vstsWebApi.getWorkItemTrackingProcessApi();
        this.witProcessDefinitionApi = await this.vstsWebApi.getWorkItemTrackingProcessDefinitionApi();
    }

    private async getSourceProcessId(): Promise<string> {
        let processes: WITProcessInterfaces.ProcessModel[];
        try {
            processes = await this.witProcessApi.getProcesses();
        }
        catch (error) {
            logger.logException(error);
            throw new ExportError(`Error getting processes on source account '${this.config.sourceAccountUrl}, check account url, token and token permission`);
        }
        if (!processes) { // most likely 404
            throw new ExportError("Failed to get processes on source account '${this.configurationOptions.sourceAccountUrl}', check account url");
        }

        const lowerCaseSourceProcessName = this.config.sourceProcessName.toLocaleLowerCase();
        const matchProcesses = processes.filter(p => p.name.toLocaleLowerCase() === lowerCaseSourceProcessName);
        if (matchProcesses.length === 0) {
            throw new ExportError(`Process '${this.config.sourceProcessName}' is not found on source account`);
        }
        return matchProcesses[0].typeId;
    }

    private async getComponents(processId: string): Promise<IProcessPayload> {
        let _process: WITProcessInterfaces.ProcessModel;
        let _behaviorsCollectionScope: WITProcessDefinitionsInterfaces.BehaviorModel[];
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

        processPromises.push(this.witProcessApi.getProcessById(processId).then(process => _process = process));
        processPromises.push(this.witProcessApi.getFields(processId).then(fields => _fieldsCollectionScope = fields));
        processPromises.push(this.witProcessDefinitionApi.getBehaviors(processId).then(behaviors => _behaviorsCollectionScope = behaviors));
        processPromises.push(this.witProcessApi.getWorkItemTypes(processId).then(workitemtypes => {
            const perWitPromises: Promise<any>[] = [];

            for (const workitemtype of workitemtypes) {
                const currentWitPromises: Promise<any>[] = [];

                currentWitPromises.push(this.witProcessDefinitionApi.getBehaviorsForWorkItemType(processId, workitemtype.id).then(behaviors => {
                    const witBehaviorsInfo: IWITBehaviorsInfo = { refName: workitemtype.id, workItemTypeClass: workitemtype.class };
                    const witBehaviors: IWITBehaviors = {
                        workItemType: witBehaviorsInfo,
                        behaviors: behaviors
                    }
                    _behaviorsWITypeScope.push(witBehaviors);
                }));

                if (workitemtype.class !== WITProcessInterfaces.WorkItemTypeClass.System) {
                    _nonSystemWorkItemTypes.push(workitemtype);

                    currentWitPromises.push(this.witProcessDefinitionApi.getWorkItemTypeFields(processId, workitemtype.id).then(fields => {
                        const witFields: IWITypeFields = {
                            workItemTypeRefName: workitemtype.id,
                            fields: fields
                        };
                        _fieldsWorkitemtypeScope.push(witFields);

                        const picklistPromises: Promise<any>[] = [];
                        for (const field of fields) {
                            if (field.pickList && !knownPicklists[field.referenceName]) { // Same picklist field may exist in multiple work item types but we only need to export once (At this moment the picklist is still collection-scoped)
                                knownPicklists[field.pickList.id] = true;
                                picklistPromises.push(this.witProcessDefinitionApi.getList(field.pickList.id).then(picklist => _picklists.push(
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
                    currentWitPromises.push(this.witProcessDefinitionApi.getFormLayout(processId, workitemtype.id).then(layout => {
                        const witLayout: IWITLayout = {
                            workItemTypeRefName: workitemtype.id,
                            layout: layout
                        }
                        _layouts.push(witLayout);
                    }));

                    currentWitPromises.push(this.witProcessDefinitionApi.getStateDefinitions(processId, workitemtype.id).then(states => {
                        const witStates: IWITStates = {
                            workItemTypeRefName: workitemtype.id,
                            states: states
                        }
                        _states.push(witStates);
                    }));

                    currentWitPromises.push(this.witProcessApi.getWorkItemTypeRules(processId, workitemtype.id).then(rules => {
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

    public async exportProcess(): Promise<IProcessPayload> {
        logger.logInfo("Export process started.");
        try {
            await this.getApis();
        }
        catch (error) {
            logger.logException(error);
            throw new ExportError(`Failed to connect to source account '${this.config.sourceAccountUrl}' - check url and token`);
        }

        let processPayload: IProcessPayload;
        const processId = await this.getSourceProcessId();
        processPayload = await Engine.Task(() => this.getComponents(processId), "Get artifacts from source process");

        logger.logVerbose("Writing process payload started");
        const exportFilename = (this.config.options && this.config.options.processFilename) || defaultProcessFilename;
        await writeFileSync(exportFilename, JSON.stringify(processPayload, null, 2), { flag: "w" });
        logger.logVerbose("Writing process payload completed successfully.");

        logger.logInfo("Export process completed successfully.");
        return processPayload;
    }
}

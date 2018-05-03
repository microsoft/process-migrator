import * as assert from "assert";
import { format } from "path";
import { writeFileSync, readFileSync, appendFileSync, existsSync, unlinkSync } from "fs";
import { isFunction } from "util";
import * as url from "url";
import * as readline from "readline";
import * as minimist from "minimist";
import { Guid } from "guid-typescript";
import * as vsts from "vso-node-api/WebApi";
import * as WITProcessDefinitionsInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import * as WITInterfaces from "vso-node-api/interfaces/WorkItemTrackingInterfaces";
import { IWorkItemTrackingProcessDefinitionsApi as WITProcessDefinitionApi, IWorkItemTrackingProcessDefinitionsApi } from "vso-node-api/WorkItemTrackingProcessDefinitionsApi";
import { IWorkItemTrackingProcessApi as WITProcessApi, IWorkItemTrackingProcessApi } from "vso-node-api/WorkItemTrackingProcessApi";
import { IWorkItemTrackingApi as WITApi } from "vso-node-api/WorkItemTrackingApi";
import { PICKLIST_NO_ACTION, defaultConfiguration, defaultConfigurationFilename, defaultEncoding, defaultLogFileName, paramConfig, paramMode, Modes, paramOverwriteProcessOnTarget, defaultProcessFilename } from "./Constants";
import { IExportOptions, IConfigurationOptions, IProcessPayload, IDictionaryStringTo, IWITLayout, IWITRules, IWITBehaviors, IWITFieldPicklist, IWITStates, IWITypeFields, IWITBehaviorsInfo, LogLevel, IConfigurationFile, IImportConfiguration } from "./Interfaces";
import { ImportError, ExportError, ValidationError, CancellationError, KnownError } from "./Errors";
import { Logger } from "./Logger";

let logger: Logger;

export class Engine {
    public static async Task<T>(step: () => Promise<T>, stepName?: string): Promise<T> {
        if (Utility.didUserCancel()) {
            throw new CancellationError();
        }
        logger.logVerbose(`Executing step '${stepName}'.`);
        return step().then((ret) => { logger.logVerbose(`Finished step '${stepName}'.`); return ret; });
    }
}

export class Utility {
    /** Convert from WITProcess FieldModel to WITProcessDefinitions FieldModel
     * @param fieldModel 
     */
    public static WITProcessToWITProcessDefinitionsFieldModel(fieldModel: WITProcessInterfaces.FieldModel): WITProcessDefinitionsInterfaces.FieldModel {

        let outField: WITProcessDefinitionsInterfaces.FieldModel = {
            description: fieldModel.description,
            id: fieldModel.id,
            name: fieldModel.name,
            type: fieldModel.isIdentity ? WITProcessDefinitionsInterfaces.FieldType.Identity : fieldModel.type,
            url: fieldModel.url,
            pickList: null
        }
        return outField;
    }

    /** Convert from WorkItemTrackingProcess FieldType to WorkItemTracking FieldType
     * @param witProcessFieldType 
     */
    public static WITProcessToWITFieldType(witProcessFieldType: number, fieldIsIdentity: boolean): number {
        if (fieldIsIdentity) { return WITInterfaces.FieldType.Identity; }

        switch (witProcessFieldType) {
            case WITProcessInterfaces.FieldType.String: { return WITInterfaces.FieldType.String; }
            case WITProcessInterfaces.FieldType.Integer: { return WITInterfaces.FieldType.Integer; }
            case WITProcessInterfaces.FieldType.DateTime: { return WITInterfaces.FieldType.DateTime; }
            case WITProcessInterfaces.FieldType.PlainText: { return WITInterfaces.FieldType.PlainText; }
            case WITProcessInterfaces.FieldType.Html: { return WITInterfaces.FieldType.Html; }
            case WITProcessInterfaces.FieldType.TreePath: { return WITInterfaces.FieldType.TreePath; }
            case WITProcessInterfaces.FieldType.History: { return WITInterfaces.FieldType.History; }
            case WITProcessInterfaces.FieldType.Double: { return WITInterfaces.FieldType.Double; }
            case WITProcessInterfaces.FieldType.Guid: { return WITInterfaces.FieldType.Guid; }
            case WITProcessInterfaces.FieldType.Boolean: { return WITInterfaces.FieldType.Boolean; }
            case WITProcessInterfaces.FieldType.Identity: { return WITInterfaces.FieldType.Identity; }
            case WITProcessInterfaces.FieldType.PicklistInteger: { return WITInterfaces.FieldType.PicklistInteger; }
            case WITProcessInterfaces.FieldType.PicklistString: { return WITInterfaces.FieldType.PicklistString; }
            case WITProcessInterfaces.FieldType.PicklistDouble: { return WITInterfaces.FieldType.PicklistDouble; }
            default: { throw new Error(`Failed to convert from WorkItemTrackingProcess.FieldType to WorkItemTracking.FieldType, unrecognized enum value '${witProcessFieldType}'`) }
        }
    }

    /**Convert process from ProcessModel to CreateProcessModel
     * @param processModel
    */
    public static ProcessModelToCreateProcessModel(processModel: WITProcessInterfaces.ProcessModel): WITProcessInterfaces.CreateProcessModel {
        const createModel: WITProcessInterfaces.CreateProcessModel = {
            description: processModel.description,
            name: processModel.name,
            parentProcessTypeId: processModel.properties.parentProcessTypeId,
            referenceName: processModel.referenceName
        };
        return createModel;
    }

    /**Convert group from getLayout group interface to WITProcessDefinitionsInterfaces.Group
     * @param group
    */
    public static toCreateGroup(group: any/*TODO: Change this type, not any*/): WITProcessDefinitionsInterfaces.Group {
        let createGroup: WITProcessDefinitionsInterfaces.Group = {
            id: group.id,
            inherited: group.inherited,
            label: group.label,
            isContribution: group.isContribution,
            visible: group.visible,
            controls: null,
            contribution: null,
            height: null,
            order: null,
            overridden: null
        }
        return createGroup;
    }

    /**Convert control from getLayout control interface to WITProcessDefinitionsInterfaces.Control
     * @param control
    */
    public static toCreateControl(control: any/*TODO: Change this type, not any*/): WITProcessDefinitionsInterfaces.Control {
        let createControl: WITProcessDefinitionsInterfaces.Control = {
            id: control.id,
            inherited: control.inherited,
            label: control.label,
            controlType: control.controlType,
            readOnly: control.readOnly,
            watermark: control.watermark,
            metadata: control.metadata,
            visible: control.visible,
            isContribution: control.isContribution,
            contribution: null,
            height: null,
            order: null,
            overridden: null
        }
        return createControl;
    }

    /**Convert page from getLayout page interface to WITProcessDefinitionsInterfaces.Page
      * @param control
     */
    public static toCreatePage(page: any/*TODO: Change this type, not any*/): WITProcessDefinitionsInterfaces.Page {
        let createPage: WITProcessDefinitionsInterfaces.Page = {
            id: page.id,
            inherited: page.inherited,
            label: page.label,
            pageType: page.pageType,
            locked: page.loacked,
            visible: page.visible,
            isContribution: page.isContribution,
            sections: null,//yeah??
            contribution: null,
            order: null,
            overridden: null
        }
        return createPage;
    }

    public static toCreateBehavior(behavior: WITProcessDefinitionsInterfaces.BehaviorModel): WITProcessDefinitionsInterfaces.BehaviorCreateModel {
        let createBehavior: WITProcessDefinitionsInterfaces.BehaviorCreateModel = {
            color: behavior.color,
            inherits: behavior.inherits.id,
            name: behavior.name
        }
        return createBehavior;
    }

    public static toReplaceBehavior(behavior: WITProcessDefinitionsInterfaces.BehaviorModel): WITProcessDefinitionsInterfaces.BehaviorReplaceModel {
        let replaceBehavior: WITProcessDefinitionsInterfaces.BehaviorReplaceModel = {
            color: behavior.color,
            name: behavior.name
        }
        return replaceBehavior;
    }

    public static startCanellationListener() {
        const stdin = process.stdin;
        if (!isFunction(stdin.setRawMode)) {
            logger.logInfo(`We are running inside a TTY does not support RAW mode, you must cancel operation with CTRL+C`);
            return;
        }
        stdin.setRawMode(true);
        readline.emitKeypressEvents(stdin);
        stdin.addListener("keypress", this._listener);
        logger.logVerbose("Keyboard listener added");
    }

    public static didUserCancel(): boolean {
        return Utility.isCancelled;
    }

    public static getLogFilePath(options: IConfigurationOptions): string {
        const logFilename = format({
            root: ".",
            base: options.logFilename ? options.logFilename : defaultLogFileName
        })
        return logFilename;
    }

    public static getWebApi(accountUrl: string, PAT: string): vsts.WebApi {
        const authHandlerSRC = vsts.getPersonalAccessTokenHandler(PAT);
        return new vsts.WebApi(accountUrl, authHandlerSRC);
    }

    public static validateConfiguration(configuration: IConfigurationFile, mode: Modes): boolean {
        if (mode === Modes.export || mode === Modes.both) {
            if (!configuration.sourceAccountUrl || !url.parse(configuration.sourceAccountUrl).host) {
                console.log(`[Configuration validation] Missing or invalid source account url: '${configuration.sourceAccountUrl}'.`);
                return false;
            }
            if (!configuration.sourceAccountToken) {
                console.log(`[Configuration validation] Missing personal access token for source account.`);
                return false;
            }
            if (!configuration.sourceProcessName) {
                console.log(`[Configuration validation] Missing source process name.`);
                return false;
            }
        }

        if (mode === Modes.import || mode === Modes.both) {
            if (!configuration.targetAccountUrl || !url.parse(configuration.targetAccountUrl).host) {
                console.log(`[Configuration validation] Missing or invalid target account url: '${configuration.targetAccountUrl}'.`);
                return false;
            }
            if (!configuration.targetAccountToken) {
                console.log(`[Configuration validation] Personal access token for target account is empty.`);
                return false;
            }
            if (configuration.options && configuration.options.overwritePicklist && (configuration.options.overwritePicklist !== true && configuration.options.overwritePicklist !== false)) {
                console.log(`[Configuration validation] Option 'overwritePicklist' is not a valid boolean.`);
                return false;
            }
        }

        if (configuration.options && configuration.options.logLevel && LogLevel[configuration.options.logLevel] === undefined) {
            console.log(`[Configuration validation] Option 'logLevel' is not a valid log level.`);
            return false;
        }

        return true;
    }

    public static handleKnownError(error: any) {
        if (error instanceof KnownError) { throw error; }
        logger.logException(error);
    }

    private static _listener = (str: string, key: readline.Key) => {
        if (key.name.toLocaleLowerCase() === "q") {
            logger.logVerbose("Setting isCancelled to true.");
            Utility.isCancelled = true;
        }
    };

    private static isCancelled = false;
}

export class ProcessImporter {
    private vstsWebApi: vsts.WebApi;
    private witProcessApi: WITProcessApi;
    private witProcessDefinitionApi: WITProcessDefinitionApi;
    private witApi: WITApi;

    constructor(vstsWebApi: vsts.WebApi, private config?: IImportConfiguration) {
        this.vstsWebApi = vstsWebApi;
    }

    public async getApis() {
        this.witApi = await this.vstsWebApi.getWorkItemTrackingApi();
        this.witProcessApi = await this.vstsWebApi.getWorkItemTrackingProcessApi();
        this.witProcessDefinitionApi = await this.vstsWebApi.getWorkItemTrackingProcessDefinitionApi();
    }

    private async importWorkItemTypes(payload: IProcessPayload): Promise<void> {
        for (const wit of payload.workItemTypes) {
            if (wit.class === WITProcessInterfaces.WorkItemTypeClass.System) {
                //The exported payload should not have exported System WITypes, so fail on import.
                throw new ImportError(`Work item type '${wit.name}' is a system work item type with no modifications, cannot import.`);
            }
            else {
                logger.logVerbose(`Creating work item type '${wit.name}'`);
                const createdWorkItemType = await this.witProcessDefinitionApi.createWorkItemType(wit, payload.process.typeId);
                if (!createdWorkItemType || createdWorkItemType.id !== wit.id) {
                    throw new ImportError(`Failed to create work item type '${wit.id}', server returned empty or reference name does not match.`);
                }
                logger.logVerbose(`Created work item type '${wit.name}'`);
            }
        }
    }

    /**
     * This process payload from export and return fields that need create also fix Identity field type and picklist id
     */
    private async getFieldsToCreate(payload: IProcessPayload): Promise<WITProcessDefinitionsInterfaces.FieldModel[]> {
        assert(payload.targetAccountInformation && payload.targetAccountInformation.fieldRefNameToPicklistId, "[Unexpected] - targetInformation not properly populated");

        let fieldsOnTarget: WITInterfaces.WorkItemField[];
        try {
            fieldsOnTarget = await this.witApi.getFields();
            if (!fieldsOnTarget || fieldsOnTarget.length <= 0) { // most likely 404
                throw new ImportError("Error getting fields from target account, server returned empty result");
            }
        }
        catch (error) {
            logger.logException(error);
            throw new ImportError("Error getting fields from target account, see logs for details.")
        }

        // Build a lookup to know if a field is picklist field.
        const isPicklistField: IDictionaryStringTo<boolean> = {};
        for (const e of payload.witFieldPicklists) {
            isPicklistField[e.fieldRefName] = true;
        }

        const outputFields: WITProcessDefinitionsInterfaces.FieldModel[] = [];
        for (const sourceField of payload.fields) {
            const fieldExist = fieldsOnTarget.some(targetField => targetField.referenceName === sourceField.id);
            if (!fieldExist) {
                const createField: WITProcessDefinitionsInterfaces.FieldModel = Utility.WITProcessToWITProcessDefinitionsFieldModel(sourceField);
                if (sourceField.isIdentity) {
                    createField.type = WITProcessDefinitionsInterfaces.FieldType.Identity;
                }
                if (isPicklistField[sourceField.id]) {
                    const picklistId = payload.targetAccountInformation.fieldRefNameToPicklistId[sourceField.id];
                    assert(picklistId !== PICKLIST_NO_ACTION, "[Unexpected] We are creating the field which we found the matching field earlier on collection")
                    createField.pickList = {
                        id: picklistId,
                        isSuggested: null,
                        name: null,
                        type: null,
                        url: null
                    };
                }
                outputFields.push(createField);
            }
        }
        return outputFields;
    }

    /**Create fields at a collection scope*/
    private async importFields(payload: IProcessPayload): Promise<void> {
        const fieldsToCreate: WITProcessDefinitionsInterfaces.FieldModel[] = await Engine.Task(() => this.getFieldsToCreate(payload), "Get fields to be created on target process");

        if (fieldsToCreate.length > 0) {
            const createFieldPromises: Promise<any>[] = [];
            for (const field of fieldsToCreate) {
                field && createFieldPromises.push(this.witProcessDefinitionApi.createField(field, payload.process.typeId).then(fieldCreated => {
                    if (!fieldCreated) {
                        throw new ImportError(`Create field '${field.name}' failed, server returned empty object`);
                    }
                    if (fieldCreated.id !== field.id) {
                        throw new ImportError(`Create field '${field.name}' actually returned referenace name '${fieldCreated.id}' instead of anticipated '${field.id}', are you on latest VSTS?`);
                    }
                }, (error) => {
                    logger.logException(error)
                    throw new ImportError(`Create field '${field.name}' failed, see log for details.`);
                }));
            }
            logger.logInfo(`Started creating fields: ${fieldsToCreate.map(f => f.name).join(",")}`);
            await Promise.all(createFieldPromises);
            logger.logInfo(`Completed creating fields successfully.`);
        }
    }

    /**Add fields at a Work Item Type scope*/
    private async addFieldsToWorkItemTypes(payload: IProcessPayload): Promise<void> {
        const addFieldsPromises: Promise<any>[] = [];
        for (const entry of payload.workItemTypeFields) {
            for (const field of entry.fields) {
                // TODO: Disable parallel import due to server concurrency issue we have today.
                //addFieldsPromises.push(
                await this.witProcessDefinitionApi.addFieldToWorkItemType(field, payload.process.typeId, entry.workItemTypeRefName).then(
                    (fieldAdded) => {
                        if (!fieldAdded || fieldAdded.referenceName !== field.referenceName) {
                            throw new ImportError(`Failed to add field '${field.referenceName}' to work item type '${entry.workItemTypeRefName}', server returned empty result or reference name does not match.`);
                        }
                    },
                    (error) => {
                        logger.logException(error);
                        throw new ImportError(`Failed to add field '${field.referenceName}' to work item type '${entry.workItemTypeRefName}', see logs for details.`);
                    }
                )
                //);
            }
        }
        await Promise.all(addFieldsPromises);
    }

    private async createGroup(createGroup: WITProcessDefinitionsInterfaces.Group,
        page: WITProcessDefinitionsInterfaces.Page,
        section: WITProcessDefinitionsInterfaces.Section,
        witLayout: IWITLayout,
        payload: IProcessPayload
    ) {
        let newGroup: WITProcessDefinitionsInterfaces.Group;

        try {
            newGroup = await this.witProcessDefinitionApi.addGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id);
        }
        catch (error) {
            logger.logException(error);
            throw new ImportError(`Failed to create group '${createGroup.id}' in page '${page.id}', see logs for details.`)
        }

        if (!newGroup || !newGroup.id) {
            throw new ImportError(`Failed to create group '${createGroup.id}' in page '${page.id}', server returned empty result or non-matching id.`)
        }

        return newGroup;
    }

    private async editGroup(createGroup: WITProcessDefinitionsInterfaces.Group,
        page: WITProcessDefinitionsInterfaces.Page,
        section: WITProcessDefinitionsInterfaces.Section,
        group: WITProcessDefinitionsInterfaces.Group,
        witLayout: IWITLayout,
        payload: IProcessPayload
    ) {
        let newGroup: WITProcessDefinitionsInterfaces.Group;

        try {
            newGroup = await this.witProcessDefinitionApi.editGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id, group.id);
        }
        catch (error) {
            logger.logException(error);
            throw new ImportError(`Failed to edit group '${group.id}' in page '${page.id}', see logs for details.`)
        }

        if (!newGroup || newGroup.id !== group.id) {
            throw new ImportError(`Failed to create group '${group.id}' in page '${page.id}', server returned empty result or id.`)
        }
        return newGroup;
    }

    private async importPage(targetLayout: WITProcessDefinitionsInterfaces.FormLayout, witLayout: IWITLayout, page: WITProcessDefinitionsInterfaces.Page, payload: IProcessPayload) {
        if (!page) {
            throw new ImportError(`Encourtered null page in work item type '${witLayout.workItemTypeRefName}'`);
        }

        let newPage: WITProcessDefinitionsInterfaces.Page; //The newly created page, contains the pageId required to create groups.
        const createPage: WITProcessDefinitionsInterfaces.Page = Utility.toCreatePage(page);
        const sourcePagesOnTarget: WITProcessDefinitionsInterfaces.Page[] = targetLayout.pages.filter(p => p.id === page.id);
        try {
            newPage = sourcePagesOnTarget.length === 0
                ? await this.witProcessDefinitionApi.addPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName)
                : await this.witProcessDefinitionApi.editPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName);
        }
        catch (error) {
            logger.logException(error);
            throw new ImportError(`Failed to create or edit '${page.id}' page in ${witLayout.workItemTypeRefName}, see logs for details.`);
        }
        if (!newPage || !newPage.id) {
            throw new ImportError(`Failed to create or edit '${page.id}' page in ${witLayout.workItemTypeRefName}, server returned empty result.`);
        }

        page.id = newPage.id;
        for (const section of page.sections) {
            for (const group of section.groups) {
                let newGroup: WITProcessDefinitionsInterfaces.Group;

                if (group.controls.length !== 0 && group.controls[0].controlType === "HtmlFieldControl") {
                    //Handle groups with HTML Controls
                    try {
                        const createGroup: WITProcessDefinitionsInterfaces.Group = Utility.toCreateGroup(group);

                        if (group.inherited) {
                            if (group.overridden) {
                                newGroup = await this.editGroup(createGroup, page, section, group, witLayout, payload);

                                const htmlControl = group.controls[0];
                                if (htmlControl.overridden) {
                                    // If the HTML control is overriden, we must update that as well 
                                    let updatedHtmlControl: WITProcessDefinitionsInterfaces.Control;
                                    try {
                                        updatedHtmlControl = await this.witProcessDefinitionApi.editControl(htmlControl, payload.process.typeId, witLayout.workItemTypeRefName, newGroup.id, htmlControl.id);
                                    }
                                    catch (error) {
                                        logger.logException(error);
                                        throw new ImportError(`Failed to edit HTML control '${htmlControl.id} in group'${group.id}' in page '${page.id}', see logs for details.`)
                                    }

                                    if (!updatedHtmlControl || updatedHtmlControl.id !== htmlControl.id) {
                                        throw new ImportError(`Failed to edit group '${group.id}' in page '${page.id}', server returned empty result or non-matching id.`)
                                    }
                                }
                            }
                            else {
                                // no-op since the group is not overriden
                            }
                        }
                        else {
                            // special handling for HTML control - we must create a group containing the HTML control at same time.
                            createGroup.controls = group.controls;
                            await this.createGroup(createGroup, page, section, witLayout, payload);
                        }
                    }
                    catch (error) {
                        Utility.handleKnownError(error);
                        throw new ImportError(`Unable to add ${group} HTML group to ${witLayout.workItemTypeRefName}, see logs for details.`);
                    }
                }
                else {
                    //Groups with no HTML Controls
                    try {
                        let createGroup: WITProcessDefinitionsInterfaces.Group = Utility.toCreateGroup(group);

                        if (group.inherited) {
                            if (group.overridden) {
                                //edit
                                await this.editGroup(createGroup, page, section, group, witLayout, payload);
                            }
                        }
                        else {
                            //create
                            newGroup = await this.createGroup(createGroup, page, section, witLayout, payload);
                            group.id = newGroup.id;
                        }
                    }
                    catch (error) {
                        Utility.handleKnownError(error);
                        throw new ImportError(`Unable to add ${group} group to ${witLayout.workItemTypeRefName}. ${error}`);
                    }

                    for (const control of group.controls) {
                        if (!control.inherited || control.overridden) {
                            try {
                                let createControl: WITProcessDefinitionsInterfaces.Control = Utility.toCreateControl(control);

                                if (control.inherited) {
                                    if (control.overridden) {
                                        //edit
                                        await this.witProcessDefinitionApi.editControl(createControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id, control.id);
                                    }
                                }
                                else {
                                    //create
                                    await this.witProcessDefinitionApi.addControlToGroup(createControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id);
                                }
                            }
                            catch (error) {
                                Utility.handleKnownError(error);
                                throw new ImportError(`Unable to add '${control}' control to page '${page}' in '${witLayout.workItemTypeRefName}'. ${error}`);
                            }
                        }
                    }
                }
            }
        }
    }

    private async importLayouts(payload: IProcessPayload): Promise<void> {
        /** Notes:
         * HTML controls need to be created at the same tme as the group they are in.
         * Non HTML controls need to be added 1 by 1 after the group they are in has been created.
         */
        const importPagePromises: Promise<any>[] = [];

        for (const witLayout of payload.layouts) {
            const targetLayout: WITProcessDefinitionsInterfaces.FormLayout = await this.witProcessDefinitionApi.getFormLayout(payload.process.typeId, witLayout.workItemTypeRefName);
            for (const page of witLayout.layout.pages) {
                //TODO: Disable parallel execution, we have server concurrency bug today not handling that well. 
                // if (page.pageType === WITProcessDefinitionsInterfaces.PageType.Custom) {
                //     importPagePromises.push(this.importPage(targetLayout, witLayout, page, payload).then(() => { return; }, (error) => {
                //         Utility.handleKnownError(error);
                //         throw new ImportError(`Failed to import page '${page.id}' in work item type '${witLayout.workItemTypeRefName}'`);
                //     }));
                // }
                await this.importPage(targetLayout, witLayout, page, payload);
            }
        }

        await Promise.all(importPagePromises);
    }

    private async importWITStates(entry: IWITStates, payload: IProcessPayload) {
        let targetWITStates: WITProcessDefinitionsInterfaces.WorkItemStateResultModel[];
        try {
            targetWITStates = await this.witProcessApi.getStateDefinitions(payload.process.typeId, entry.workItemTypeRefName);
            if (!targetWITStates || targetWITStates.length <= 0) {
                throw new ImportError(`Failed to get states definitions from work item type '${entry.workItemTypeRefName}' on target account, server returned empty result.`)
            }
        }
        catch (error) {
            Utility.handleKnownError(error);
            throw new ImportError(`Failed to get states definitions from work item type '${entry.workItemTypeRefName}' on target account, see logs for details.`)
        }

        for (const sourceState of entry.states) {
            try {
                const existingStates: WITProcessDefinitionsInterfaces.WorkItemStateResultModel[] = targetWITStates.filter(targetState => sourceState.name === targetState.name);
                if (existingStates.length === 0) {  //does not exist on target
                    const createdState = await this.witProcessDefinitionApi.createStateDefinition(sourceState, payload.process.typeId, entry.workItemTypeRefName);
                    if (!createdState || !createdState.id) {
                        throw new ImportError(`Unable to create state '${sourceState.name}' in '${entry.workItemTypeRefName}' work item type, server returned empty result or id.`);
                    }
                }
                else {
                    if (sourceState.hidden) { // if state exists on target, only update if hidden 
                        const updatedState = await this.witProcessDefinitionApi.hideStateDefinition({ hidden: true }, payload.process.typeId, entry.workItemTypeRefName, existingStates[0].id);
                        if (!updatedState || updatedState.id !== sourceState.id || !updatedState.hidden) {
                            throw new ImportError(`Unable to hide state '${sourceState.name}' in '${entry.workItemTypeRefName}' work item type, server returned empty result, id or state is not hidden.`);
                        }
                    }
                }
            }
            catch (error) {
                Utility.handleKnownError(error);
                throw new ImportError(`Unable to create/hide state '${sourceState.name}' in '${entry.workItemTypeRefName}' work item type, see logs for details`);
            }
        }
    }

    private async importStates(payload: IProcessPayload): Promise<void> {
        const statesPromises: Promise<any>[] = [];
        for (const entry of payload.states) {
            statesPromises.push(this.importWITStates(entry, payload));
        }
        await Promise.all(statesPromises);
    }

    private async importWITRule(rule: WITProcessInterfaces.FieldRuleModel, entry: IWITRules, payload: IProcessPayload) {
        try {
            const createdRule = await this.witProcessApi.addWorkItemTypeRule(rule, payload.process.typeId, entry.workItemTypeRefName);
            if (!createdRule || !createdRule.id) {
                throw new ImportError(`Unable to create rule '${rule.id}' in work item type '${entry.workItemTypeRefName}', server returned empty result or id.`);
            }
        }
        catch (error) {
            Utility.handleKnownError(error);
            throw new ImportError(`Unable to create rule '${rule.id}' in work item type '${entry.workItemTypeRefName}', see logs for details.`);
        }
    }

    private async importRules(payload: IProcessPayload): Promise<void> {
        const rulesPromises: Promise<any>[] = [];
        for (const entry of payload.rules) {
            for (const rule of entry.rules) {
                if (!rule.isSystem) {
                    rulesPromises.push(this.importWITRule(rule, entry, payload));
                }
            }
        }
        await Promise.all(rulesPromises);
    }

    private async importBehaviors(payload: IProcessPayload): Promise<void> {
        for (const behavior of payload.behaviors) {
            try {
                if (!behavior.overridden) {
                    const createBehavior: WITProcessDefinitionsInterfaces.BehaviorCreateModel = Utility.toCreateBehavior(behavior);
                    this.witProcessDefinitionApi.createBehavior(createBehavior, payload.process.typeId);
                }
                else {
                    const replaceBehavior: WITProcessDefinitionsInterfaces.BehaviorReplaceModel = Utility.toReplaceBehavior(behavior);
                    this.witProcessDefinitionApi.replaceBehavior(replaceBehavior, payload.process.typeId, behavior.id);
                }
            }
            catch (error) {
                throw new ImportError(`Unable to import behavior ${behavior.name}`);
            }
        }
    }

    private async addBehaviorsToWorkItemTypes(payload: IProcessPayload): Promise<void> {
        for (let IWorkItemTypeBehaviors of payload.workItemTypeBehaviors) {
            for (let behavior of IWorkItemTypeBehaviors.behaviors) {
                try {
                    if (IWorkItemTypeBehaviors.workItemType.workItemTypeClass === WITProcessDefinitionsInterfaces.WorkItemTypeClass.Custom) {
                        await this.witProcessDefinitionApi.addBehaviorToWorkItemType(behavior, payload.process.typeId, IWorkItemTypeBehaviors.workItemType.refName);
                    }
                }
                catch (error) {
                    throw new ImportError(`Unable to add ${behavior.behavior.id} field to ${IWorkItemTypeBehaviors.workItemType.refName} WIT: ${error}`);
                }
            }
        }
    }

    private async importPicklists(payload: IProcessPayload): Promise<void> {
        assert(payload.targetAccountInformation && payload.targetAccountInformation.fieldRefNameToPicklistId, "[Unexpected] - targetInformation not properly populated");

        const targetFieldToPicklistId = payload.targetAccountInformation.fieldRefNameToPicklistId;
        const processedFieldRefNames: IDictionaryStringTo<boolean> = {};
        for (const picklistEntry of payload.witFieldPicklists) {
            if (processedFieldRefNames[picklistEntry.fieldRefName] === true) {
                continue; // Skip since we already processed the field, it might be referenced by different work item type
            }

            const targetPicklistId = targetFieldToPicklistId[picklistEntry.fieldRefName];
            if (targetPicklistId && targetPicklistId !== PICKLIST_NO_ACTION) {
                // Picklist exists but items not match, update items
                let newpicklist: WITProcessDefinitionsInterfaces.PickListModel = <any>{};
                Object.assign(newpicklist, picklistEntry.picklist);
                newpicklist.id = targetPicklistId;
                try {
                    const updatedPicklist = await this.witProcessDefinitionApi.updateList(newpicklist, targetPicklistId);

                    // validate the updated list matches expectation
                    if (!updatedPicklist || !updatedPicklist.id) {
                        throw new ImportError(`[Unexpected] Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}' was not successful, result is emtpy, possibly the picklist does not exist on target collection`);
                    }

                    if (updatedPicklist.items.length !== picklistEntry.picklist.items.length) {
                        throw new ImportError(`[Unexpected] Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}' was not successful, items number does not match.`);
                    }

                    for (const item of updatedPicklist.items) {
                        if (!picklistEntry.picklist.items.some(i => i.value === item.value)) {
                            throw new ImportError(`[Unexpected] Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}' was not successful, item '${item.value}' does not match expected`);
                        }
                    }
                }
                catch (err) {
                    throw new ImportError(`Error when update picklist '${targetPicklistId} for field '${picklistEntry.fieldRefName}', server error message: '${err.message}'`);
                }
            }
            else if (!targetPicklistId) {
                // Target field does not exist we need create picklist to be used when create field.
                picklistEntry.picklist.name = `picklist_${Guid.create()}`; // Avoid conflict on target
                const createdPicklist = await this.witProcessDefinitionApi.createList(picklistEntry.picklist);
                if (!createdPicklist || !createdPicklist.id) {
                    throw new ImportError(`Create picklist for field ${picklistEntry.fieldRefName} was not successful`);
                }
                targetFieldToPicklistId[picklistEntry.fieldRefName] = createdPicklist.id;

            }
            processedFieldRefNames[picklistEntry.fieldRefName] = true;
        }
    }

    private async createComponents(payload: IProcessPayload): Promise<void> {
        await Engine.Task(() => this.importPicklists(payload), "Import picklists on target account"); // This must be before field import
        await Engine.Task(() => this.importFields(payload), "Import fields on target account");
        await Engine.Task(() => this.importWorkItemTypes(payload), "Import work item types on target process");
        await Engine.Task(() => this.addFieldsToWorkItemTypes(payload), "Add field to work item types on target process");
        await Engine.Task(() => this.importLayouts(payload), "Import work item form layouts on target process");
        await Engine.Task(() => this.importStates(payload), "Import states on target process");
        await Engine.Task(() => this.importRules(payload), "Import rules on target process");
        await Engine.Task(() => this.importBehaviors(payload), "Import behaviors on target process");
        await Engine.Task(() => this.addBehaviorsToWorkItemTypes(payload), "Add behavior to work item types on target process");
    }

    private async  validateProcess(payload: IProcessPayload): Promise<void> {
        let targetProcesses: WITProcessInterfaces.ProcessModel[];
        try {
            targetProcesses = await this.witProcessApi.getProcesses();
        }
        catch (error) {
            throw new ValidationError("Failed to get processes on target acccount, check account url, token and token permission");
        }

        if (!targetProcesses) { // most likely 404
            throw new ValidationError("Failed to get processes on target acccount, check account url");
        }

        for (const process of targetProcesses) {
            if (payload.process.name.toLowerCase() === process.name.toLowerCase()) {
                throw new ValidationError("Process with same name or reference name already exists on target account.");
            }
        }
    }

    private async validateFields(payload: IProcessPayload): Promise<void> {
        const currentFieldsOnTarget: WITInterfaces.WorkItemField[] = await this.witApi.getFields();
        if (!currentFieldsOnTarget) { // most likely 404
            throw new ValidationError("Failed to get fields on target account.")
        }
        payload.targetAccountInformation.collectionFields = currentFieldsOnTarget;

        for (const sourceField of payload.fields) {
            const convertedSrcFieldType: number = Utility.WITProcessToWITFieldType(sourceField.type, sourceField.isIdentity);
            const conflictingFields: WITInterfaces.WorkItemField[] = currentFieldsOnTarget.filter(targetField =>
                ((targetField.referenceName === sourceField.id) || (targetField.name === sourceField.name)) // match by name or reference name
                && convertedSrcFieldType !== targetField.type // but with a different type 
                && (!sourceField.isIdentity || !targetField.isIdentity)); // with exception if both are identity - known issue we export identity field type = string 

            if (conflictingFields.length > 0) {
                throw new ValidationError(`Field in target Collection conflicts with '${sourceField.name}' field with a diffrent refrence name or type.`);
            }
        }
    }

    private async populatePicklistDictionary(fields: WITInterfaces.WorkItemField[]): Promise<IDictionaryStringTo<WITProcessDefinitionsInterfaces.PickListModel>> {
        const ret: IDictionaryStringTo<WITProcessDefinitionsInterfaces.PickListModel> = {};
        for (const field of fields) {
            assert(field.isPicklist || !field.picklistId, "Non picklist field should not have picklist")
            if (field.isPicklist && field.picklistId) {
                ret[field.referenceName] = await this.witProcessDefinitionApi.getList(field.picklistId);
            }
        }
        return ret;
    }

    /**
     * Validate picklist and output to payload.targetAccountInformation.fieldRefNameToPicklistId for directions under different case
     * 1) Picklist field does not exist -> importPicklists will create picklist and importFields will use the picklist created
     * 2) Picklist field exist and items match -> no-op for importPicklists/importFields
     * 3) Picklist field exists but items does not match -> if 'overwritePicklist' enabled, importPicklists will update items and importFields will skip
     * @param payload 
     */
    private async validatePicklists(payload: IProcessPayload): Promise<void> {
        assert(payload.targetAccountInformation && payload.targetAccountInformation.collectionFields, "[Unexpected] - targetInformation not properly populated");

        const fieldToPicklistIdMapping = payload.targetAccountInformation.fieldRefNameToPicklistId; // This is output for import picklist/field
        const currentTargetFieldToPicklist = await this.populatePicklistDictionary(payload.targetAccountInformation.collectionFields);

        for (const picklistEntry of payload.witFieldPicklists) {
            const fieldRefName = picklistEntry.fieldRefName;
            const currentTargetPicklist = currentTargetFieldToPicklist[fieldRefName];
            if (currentTargetPicklist) {
                // Compare the pick list items 
                let conflict: boolean;
                if (currentTargetPicklist.items.length === picklistEntry.picklist.items.length && !currentTargetPicklist.isSuggested === !picklistEntry.picklist.isSuggested) {
                    for (const sourceItem of picklistEntry.picklist.items) {
                        if (currentTargetPicklist.items.filter(targetItem => targetItem.value === sourceItem.value).length !== 1) {
                            conflict = true;
                            break;
                        }
                    }
                }
                else {
                    conflict = true;
                }

                if (conflict) {
                    if (!(this.config.options && this.config.options.overwritePicklist === true)) {
                        throw new ValidationError(`Picklist field ${fieldRefName} exist on target account but have different items than source, set 'overwritePicklist' option to overwrite`);
                    }
                    else {
                        fieldToPicklistIdMapping[fieldRefName] = currentTargetPicklist.id; // We will need to update the picklist later when import picklists
                    }
                }
                else {
                    fieldToPicklistIdMapping[fieldRefName] = PICKLIST_NO_ACTION; // No action needed since picklist values match.
                }
            }
            else {
                // No-op, leave payload.targetAccountInformation.fieldRefNameToPicklistId[picklistEntry.fieldRefName] = undefined, which indicates creating new picklist.
            }
        }
    }

    private async preImportValidation(payload: IProcessPayload): Promise<void> {
        payload.targetAccountInformation = {
            fieldRefNameToPicklistId: {}
        }; // set initial value for target account information

        if (!this.config.removeProcessOnTarget) { // only validate if we are not cleaning up target
            await Engine.Task(() => this.validateProcess(payload), "Validate process existence on target account");
        }
        await Engine.Task(() => this.validateFields(payload), "Validate fields on target account");
        await Engine.Task(() => this.validatePicklists(payload), "Validate picklists on target account");
    }

    //MAIN IMPORT
    public async importProcess(processPayload: IProcessPayload): Promise<void> {
        try {
            await this.getApis();
        }
        catch (error) {
            logger.logException(error);
            throw new ExportError(`Failed to connect to target account '${this.config.targetAccountUrl}' - check url and token`);
        }

        try {
            if (this.config.targetProcessName) {
                //TODO: validate process name here right away
                processPayload.process.name = this.config.targetProcessName;
            }
            logger.logVerbose("Pre-import validation started.");
            await Engine.Task(() => this.preImportValidation(processPayload), "Pre-import validation on target account");
            logger.logVerbose("Pre-import validation completed successfully.");

            if (this.config.removeProcessOnTarget) {
                const targetProcessName = this.config.targetProcessName || processPayload.process.name;
                const processes = await this.witProcessApi.getProcesses();
                for (const process of processes.filter(p => p.name.toLocaleLowerCase() === targetProcessName.toLocaleLowerCase())) {
                    logger.logInfo(`Begin delete process '${process.name}' on target account before import.`);
                    await this.witProcessApi.deleteProcess(process.typeId);
                    logger.logInfo(`Process '${process.name}' on target account was deleted.`);
                }
            }

            logger.logVerbose("Create process on target account started.");
            const createProcessModel: WITProcessInterfaces.CreateProcessModel = Utility.ProcessModelToCreateProcessModel(processPayload.process);
            const createdProcess = await this.witProcessApi.createProcess(createProcessModel);
            if (!createdProcess) {
                throw new ImportError("Failed to create process on target account.");
            }
            logger.logVerbose("Create process on target account completed successfully.");
            processPayload.process.typeId = createdProcess.typeId;
            await Engine.Task(() => this.createComponents(processPayload), "Create artifacts on target process");
        }
        catch (error) {
            if (error instanceof ValidationError) {
                logger.logError("Pre-Import validation failed. No artifacts were created on target process")
            }
            throw error;
        }
    }
}

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

async function main() {
    //Parse command line 
    const parseOptions: minimist.Opts = {
        boolean: true,
        alias: {
            "help": "h",
            paramMode: "m",
            paramConfig: "c"
        }
    }
    const parsedArgs = minimist(process.argv, parseOptions);
    if (parsedArgs["h"]) {
        console.log(`Usage: node ImportExportProcess.js --mode=<import/export/both> [--config=<configuration file path>] [--overwriteProcessOnTarget]`);
        process.exit(0);
    }

    const configFileName = parsedArgs[paramConfig] || defaultConfigurationFilename
    //Load configuration file
    if (!existsSync(configFileName)) {
        console.log(`Cannot find configuration file '${configFileName}'`);
        if (!parsedArgs[paramConfig] && !existsSync(defaultConfigurationFilename)) {
            writeFileSync(defaultConfigurationFilename, JSON.stringify(defaultConfiguration, null, 2));
            console.log(`Generated default configuration file as '${defaultConfigurationFilename}'.`);
        }
        process.exit(1);
    }

    const userSpecifiedMode = <string>parsedArgs[paramMode];
    let mode;
    if (userSpecifiedMode) {
        switch (userSpecifiedMode.toLocaleLowerCase()) {
            case "export": mode = Modes.export; break;
            case "import": mode = Modes.import; break;
            case "both": mode = Modes.both; break;
            default: console.log(`Invalid mode, allowed values are 'import','export' and 'both'.`); process.exit(1);
        }
    }
    else {
        // Default to both import/export
        mode = Modes.both;
    }
    const configuration = <IConfigurationFile>JSON.parse(await readFileSync(configFileName, defaultEncoding));
    if (!Utility.validateConfiguration(configuration, mode)) {
        process.exit(1);
    }

    // Initialize logger
    const logLevel = configuration.options.logLevel ? configuration.options.logLevel : LogLevel.Information;
    logger = new Logger(Utility.getLogFilePath(configuration.options), logLevel);

    // Read configuration and get webApis
    const userOptions = configuration.options as IConfigurationOptions;
    try {
        let processPayload: IProcessPayload;
        if (mode === Modes.export || mode === Modes.both) {
            const sourceWebApi = Utility.getWebApi(configuration.sourceAccountUrl, configuration.sourceAccountToken);
            const exporter: ProcessExporter = new ProcessExporter(sourceWebApi, configuration);
            processPayload = await exporter.exportProcess();
        }

        //TODO: Remove or formalize this - dev only for now
        if (mode === Modes.both || mode === Modes.import) {
            if (mode === Modes.import) { // Read payload from file;
                const processFileName = (configuration.options && configuration.options.processFilename) || defaultProcessFilename;
                logger.logVerbose(`Start read process payload from '${processFileName}'.`);
                processPayload = JSON.parse(await readFileSync(processFileName, defaultEncoding));
                logger.logVerbose(`Complete read process payload.`);
            }

            const targetWebApi = Utility.getWebApi(configuration.targetAccountUrl, configuration.targetAccountToken);

            const importConfiguration: IImportConfiguration = configuration;
            importConfiguration.removeProcessOnTarget = parsedArgs[paramOverwriteProcessOnTarget] === true;

            const importer: ProcessImporter = new ProcessImporter(targetWebApi, importConfiguration);
            logger.logInfo("Process import started.");
            await importer.importProcess(processPayload);
            logger.logInfo("Process import completed successfully.");
        }
    }
    catch (error) {
        logger.logException(error);
        if (error instanceof KnownError) {
            // Known errors, just log error message
            logger.logError(error.message);
        }
        else {
            logger.logError(`Hit unknown error, check log file for details.`)
        }
        process.exit(1);
    }
    process.exit(0);
}

main();
import * as assert from "assert";
import { Guid } from "guid-typescript";
import * as vsts from "vso-node-api/WebApi";
import * as WITInterfaces from "vso-node-api/interfaces/WorkItemTrackingInterfaces";
import * as WITProcessDefinitionsInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import { IWorkItemTrackingProcessDefinitionsApi as WITProcessDefinitionApi, IWorkItemTrackingProcessDefinitionsApi } from "vso-node-api/WorkItemTrackingProcessDefinitionsApi";
import { IWorkItemTrackingProcessApi as WITProcessApi, IWorkItemTrackingProcessApi } from "vso-node-api/WorkItemTrackingProcessApi";
import { IWorkItemTrackingApi as WITApi } from "vso-node-api/WorkItemTrackingApi";
import { PICKLIST_NO_ACTION } from "./Constants";
import { Engine } from "./Engine";
import { ImportError, ValidationError } from "./Errors";
import { ICommandLineOptions, IConfigurationFile, IDictionaryStringTo, IProcessPayload, IWITLayout, IWITRules, IWITStates } from "./Interfaces";
import { logger } from "./Logger";
import { Utility } from "./Utilities";

export class ProcessImporter {
    private _vstsWebApi: vsts.WebApi;
    private _witProcessApi: WITProcessApi;
    private _witProcessDefinitionApi: WITProcessDefinitionApi;
    private _witApi: WITApi;

    constructor(vstsWebApi: vsts.WebApi, private _config?: IConfigurationFile, private _commandLineOptions?: ICommandLineOptions) {
        this._vstsWebApi = vstsWebApi;
    }

    private async _getApis() {
        this._witApi = await this._vstsWebApi.getWorkItemTrackingApi();
        this._witProcessApi = await this._vstsWebApi.getWorkItemTrackingProcessApi();
        this._witProcessDefinitionApi = await this._vstsWebApi.getWorkItemTrackingProcessDefinitionApi();
    }

    private async _importWorkItemTypes(payload: IProcessPayload): Promise<void> {
        for (const wit of payload.workItemTypes) {
            if (wit.class === WITProcessInterfaces.WorkItemTypeClass.System) {
                //The exported payload should not have exported System WITypes, so fail on import.
                throw new ImportError(`Work item type '${wit.name}' is a system work item type with no modifications, cannot import.`);
            }
            else {
                logger.logVerbose(`Creating work item type '${wit.name}'`);
                const createdWorkItemType = await this._witProcessDefinitionApi.createWorkItemType(wit, payload.process.typeId);
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
    private async _getFieldsToCreate(payload: IProcessPayload): Promise<WITProcessDefinitionsInterfaces.FieldModel[]> {
        assert(payload.targetAccountInformation && payload.targetAccountInformation.fieldRefNameToPicklistId, "[Unexpected] - targetInformation not properly populated");

        let fieldsOnTarget: WITInterfaces.WorkItemField[];
        try {
            fieldsOnTarget = await this._witApi.getFields();
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
    private async _importFields(payload: IProcessPayload): Promise<void> {
        const fieldsToCreate: WITProcessDefinitionsInterfaces.FieldModel[] = await Engine.Task(() => this._getFieldsToCreate(payload), "Get fields to be created on target process");

        if (fieldsToCreate.length > 0) {
            const createFieldPromises: Promise<any>[] = [];
            for (const field of fieldsToCreate) {
                field && createFieldPromises.push(this._witProcessDefinitionApi.createField(field, payload.process.typeId).then(fieldCreated => {
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
    private async _addFieldsToWorkItemTypes(payload: IProcessPayload): Promise<void> {
        const addFieldsPromises: Promise<any>[] = [];
        for (const entry of payload.workItemTypeFields) {
            for (const field of entry.fields) {
                // TODO: Disable parallel import due to server concurrency issue we have today.
                //addFieldsPromises.push(
                await this._witProcessDefinitionApi.addFieldToWorkItemType(field, payload.process.typeId, entry.workItemTypeRefName).then(
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

    private async _createGroup(createGroup: WITProcessDefinitionsInterfaces.Group,
        page: WITProcessDefinitionsInterfaces.Page,
        section: WITProcessDefinitionsInterfaces.Section,
        witLayout: IWITLayout,
        payload: IProcessPayload
    ) {
        let newGroup: WITProcessDefinitionsInterfaces.Group;

        try {
            newGroup = await this._witProcessDefinitionApi.addGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id);
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

    private async _editGroup(createGroup: WITProcessDefinitionsInterfaces.Group,
        page: WITProcessDefinitionsInterfaces.Page,
        section: WITProcessDefinitionsInterfaces.Section,
        group: WITProcessDefinitionsInterfaces.Group,
        witLayout: IWITLayout,
        payload: IProcessPayload
    ) {
        let newGroup: WITProcessDefinitionsInterfaces.Group;

        try {
            newGroup = await this._witProcessDefinitionApi.editGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id, group.id);
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

    private async _importPage(targetLayout: WITProcessDefinitionsInterfaces.FormLayout, witLayout: IWITLayout, page: WITProcessDefinitionsInterfaces.Page, payload: IProcessPayload) {
        if (!page) {
            throw new ImportError(`Encourtered null page in work item type '${witLayout.workItemTypeRefName}'`);
        }

        let newPage: WITProcessDefinitionsInterfaces.Page; //The newly created page, contains the pageId required to create groups.
        const createPage: WITProcessDefinitionsInterfaces.Page = Utility.toCreatePage(page);
        const sourcePagesOnTarget: WITProcessDefinitionsInterfaces.Page[] = targetLayout.pages.filter(p => p.id === page.id);
        try {
            newPage = sourcePagesOnTarget.length === 0
                ? await this._witProcessDefinitionApi.addPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName)
                : await this._witProcessDefinitionApi.editPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName);
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
                                newGroup = await this._editGroup(createGroup, page, section, group, witLayout, payload);

                                const htmlControl = group.controls[0];
                                if (htmlControl.overridden) {
                                    // If the HTML control is overriden, we must update that as well 
                                    let updatedHtmlControl: WITProcessDefinitionsInterfaces.Control;
                                    try {
                                        updatedHtmlControl = await this._witProcessDefinitionApi.editControl(htmlControl, payload.process.typeId, witLayout.workItemTypeRefName, newGroup.id, htmlControl.id);
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
                            await this._createGroup(createGroup, page, section, witLayout, payload);
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
                                await this._editGroup(createGroup, page, section, group, witLayout, payload);
                            }
                        }
                        else {
                            //create
                            newGroup = await this._createGroup(createGroup, page, section, witLayout, payload);
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
                                        await this._witProcessDefinitionApi.editControl(createControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id, control.id);
                                    }
                                }
                                else {
                                    //create
                                    await this._witProcessDefinitionApi.addControlToGroup(createControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id);
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

    private async _importLayouts(payload: IProcessPayload): Promise<void> {
        /** Notes:
         * HTML controls need to be created at the same tme as the group they are in.
         * Non HTML controls need to be added 1 by 1 after the group they are in has been created.
         */
        const importPagePromises: Promise<any>[] = [];

        for (const witLayout of payload.layouts) {
            const targetLayout: WITProcessDefinitionsInterfaces.FormLayout = await this._witProcessDefinitionApi.getFormLayout(payload.process.typeId, witLayout.workItemTypeRefName);
            for (const page of witLayout.layout.pages) {
                //TODO: Disable parallel execution, we have server concurrency bug today not handling that well. 
                // if (page.pageType === WITProcessDefinitionsInterfaces.PageType.Custom) {
                //     importPagePromises.push(this.importPage(targetLayout, witLayout, page, payload).then(() => { return; }, (error) => {
                //         Utility.handleKnownError(error);
                //         throw new ImportError(`Failed to import page '${page.id}' in work item type '${witLayout.workItemTypeRefName}'`);
                //     }));
                // }
                await this._importPage(targetLayout, witLayout, page, payload);
            }
        }

        await Promise.all(importPagePromises);
    }

    private async _importWITStates(entry: IWITStates, payload: IProcessPayload) {
        let targetWITStates: WITProcessDefinitionsInterfaces.WorkItemStateResultModel[];
        try {
            targetWITStates = await this._witProcessApi.getStateDefinitions(payload.process.typeId, entry.workItemTypeRefName);
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
                    const createdState = await this._witProcessDefinitionApi.createStateDefinition(sourceState, payload.process.typeId, entry.workItemTypeRefName);
                    if (!createdState || !createdState.id) {
                        throw new ImportError(`Unable to create state '${sourceState.name}' in '${entry.workItemTypeRefName}' work item type, server returned empty result or id.`);
                    }
                }
                else {
                    if (sourceState.hidden) { // if state exists on target, only update if hidden 
                        const updatedState = await this._witProcessDefinitionApi.hideStateDefinition({ hidden: true }, payload.process.typeId, entry.workItemTypeRefName, existingStates[0].id);
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

    private async _importStates(payload: IProcessPayload): Promise<void> {
        const statesPromises: Promise<any>[] = [];
        for (const entry of payload.states) {
            statesPromises.push(this._importWITStates(entry, payload));
        }
        await Promise.all(statesPromises);
    }

    private async _importWITRule(rule: WITProcessInterfaces.FieldRuleModel, entry: IWITRules, payload: IProcessPayload) {
        try {
            const createdRule = await this._witProcessApi.addWorkItemTypeRule(rule, payload.process.typeId, entry.workItemTypeRefName);
            if (!createdRule || !createdRule.id) {
                throw new ImportError(`Unable to create rule '${rule.id}' in work item type '${entry.workItemTypeRefName}', server returned empty result or id.`);
            }
        }
        catch (error) {
            Utility.handleKnownError(error);
            throw new ImportError(`Unable to create rule '${rule.id}' in work item type '${entry.workItemTypeRefName}', see logs for details.`);
        }
    }

    private async _importRules(payload: IProcessPayload): Promise<void> {
        const rulesPromises: Promise<any>[] = [];
        for (const entry of payload.rules) {
            for (const rule of entry.rules) {
                if (!rule.isSystem) {
                    rulesPromises.push(this._importWITRule(rule, entry, payload));
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
                    this._witProcessDefinitionApi.createBehavior(createBehavior, payload.process.typeId);
                }
                else {
                    const replaceBehavior: WITProcessDefinitionsInterfaces.BehaviorReplaceModel = Utility.toReplaceBehavior(behavior);
                    this._witProcessDefinitionApi.replaceBehavior(replaceBehavior, payload.process.typeId, behavior.id);
                }
            }
            catch (error) {
                throw new ImportError(`Unable to import behavior ${behavior.name}`);
            }
        }
    }

    private async _addBehaviorsToWorkItemTypes(payload: IProcessPayload): Promise<void> {
        for (let IWorkItemTypeBehaviors of payload.workItemTypeBehaviors) {
            for (let behavior of IWorkItemTypeBehaviors.behaviors) {
                try {
                    if (IWorkItemTypeBehaviors.workItemType.workItemTypeClass === WITProcessDefinitionsInterfaces.WorkItemTypeClass.Custom) {
                        await this._witProcessDefinitionApi.addBehaviorToWorkItemType(behavior, payload.process.typeId, IWorkItemTypeBehaviors.workItemType.refName);
                    }
                }
                catch (error) {
                    throw new ImportError(`Unable to add ${behavior.behavior.id} field to ${IWorkItemTypeBehaviors.workItemType.refName} WIT: ${error}`);
                }
            }
        }
    }

    private async _importPicklists(payload: IProcessPayload): Promise<void> {
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
                    const updatedPicklist = await this._witProcessDefinitionApi.updateList(newpicklist, targetPicklistId);

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
                const createdPicklist = await this._witProcessDefinitionApi.createList(picklistEntry.picklist);
                if (!createdPicklist || !createdPicklist.id) {
                    throw new ImportError(`Create picklist for field ${picklistEntry.fieldRefName} was not successful`);
                }
                targetFieldToPicklistId[picklistEntry.fieldRefName] = createdPicklist.id;

            }
            processedFieldRefNames[picklistEntry.fieldRefName] = true;
        }
    }

    private async _createComponents(payload: IProcessPayload): Promise<void> {
        await Engine.Task(() => this._importPicklists(payload), "Import picklists on target account"); // This must be before field import
        await Engine.Task(() => this._importFields(payload), "Import fields on target account");
        await Engine.Task(() => this._importWorkItemTypes(payload), "Import work item types on target process");
        await Engine.Task(() => this._addFieldsToWorkItemTypes(payload), "Add field to work item types on target process");
        await Engine.Task(() => this._importLayouts(payload), "Import work item form layouts on target process");
        await Engine.Task(() => this._importStates(payload), "Import states on target process");
        await Engine.Task(() => this._importRules(payload), "Import rules on target process");
        await Engine.Task(() => this.importBehaviors(payload), "Import behaviors on target process");
        await Engine.Task(() => this._addBehaviorsToWorkItemTypes(payload), "Add behavior to work item types on target process");
    }

    private async _validateProcess(payload: IProcessPayload): Promise<void> {
        let targetProcesses: WITProcessInterfaces.ProcessModel[];
        try {
            targetProcesses = await this._witProcessApi.getProcesses();
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

    private async _validateFields(payload: IProcessPayload): Promise<void> {
        const currentFieldsOnTarget: WITInterfaces.WorkItemField[] = await this._witApi.getFields();
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

    private async _populatePicklistDictionary(fields: WITInterfaces.WorkItemField[]): Promise<IDictionaryStringTo<WITProcessDefinitionsInterfaces.PickListModel>> {
        const ret: IDictionaryStringTo<WITProcessDefinitionsInterfaces.PickListModel> = {};
        for (const field of fields) {
            assert(field.isPicklist || !field.picklistId, "Non picklist field should not have picklist")
            if (field.isPicklist && field.picklistId) {
                ret[field.referenceName] = await this._witProcessDefinitionApi.getList(field.picklistId);
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
    private async _validatePicklists(payload: IProcessPayload): Promise<void> {
        assert(payload.targetAccountInformation && payload.targetAccountInformation.collectionFields, "[Unexpected] - targetInformation not properly populated");

        const fieldToPicklistIdMapping = payload.targetAccountInformation.fieldRefNameToPicklistId; // This is output for import picklist/field
        const currentTargetFieldToPicklist = await this._populatePicklistDictionary(payload.targetAccountInformation.collectionFields);

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
                    if (!(this._config.options && this._config.options.overwritePicklist === true)) {
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

    private async _preImportValidation(payload: IProcessPayload): Promise<void> {
        payload.targetAccountInformation = {
            fieldRefNameToPicklistId: {}
        }; // set initial value for target account information

        if (!this._commandLineOptions.overwriteProcessOnTarget) { // only validate if we are not cleaning up target
            await Engine.Task(() => this._validateProcess(payload), "Validate process existence on target account");
        }
        await Engine.Task(() => this._validateFields(payload), "Validate fields on target account");
        await Engine.Task(() => this._validatePicklists(payload), "Validate picklists on target account");
    }

    public async importProcess(processPayload: IProcessPayload): Promise<void> {
        try {
            await this._getApis();
        }
        catch (error) {
            logger.logException(error);
            throw new ImportError(`Failed to connect to target account '${this._config.targetAccountUrl}' - check url and token`);
        }

        try {
            if (this._config.targetProcessName) {
                //TODO: validate process name here right away
                processPayload.process.name = this._config.targetProcessName;
            }
            logger.logVerbose("Pre-import validation started.");
            await Engine.Task(() => this._preImportValidation(processPayload), "Pre-import validation on target account");
            logger.logVerbose("Pre-import validation completed successfully.");

            if (this._commandLineOptions.overwriteProcessOnTarget) {
                const targetProcessName = this._config.targetProcessName || processPayload.process.name;
                const processes = await this._witProcessApi.getProcesses();
                for (const process of processes.filter(p => p.name.toLocaleLowerCase() === targetProcessName.toLocaleLowerCase())) {
                    logger.logInfo(`Begin delete process '${process.name}' on target account before import.`);
                    await this._witProcessApi.deleteProcess(process.typeId);
                    logger.logInfo(`Process '${process.name}' on target account was deleted.`);
                }
            }

            logger.logVerbose("Create process on target account started.");
            const createProcessModel: WITProcessInterfaces.CreateProcessModel = Utility.ProcessModelToCreateProcessModel(processPayload.process);
            const createdProcess = await this._witProcessApi.createProcess(createProcessModel);
            if (!createdProcess) {
                throw new ImportError("Failed to create process on target account.");
            }
            logger.logVerbose("Create process on target account completed successfully.");
            processPayload.process.typeId = createdProcess.typeId;
            await Engine.Task(() => this._createComponents(processPayload), "Create artifacts on target process");
        }
        catch (error) {
            if (error instanceof ValidationError) {
                logger.logError("Pre-Import validation failed. No artifacts were created on target process")
            }
            throw error;
        }
    }
}
import * as assert from "assert";
import { Guid } from "guid-typescript";

import * as WITInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import * as WITProcessDefinitionsInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import { IWorkItemTrackingProcessDefinitionsApi as WITProcessDefinitionApi_NOREQUIRE } from "azure-devops-node-api/WorkItemTrackingProcessDefinitionsApi";
import { IWorkItemTrackingProcessApi as WITProcessApi_NOREQUIRE } from "azure-devops-node-api/WorkItemTrackingProcessApi";
import { IWorkItemTrackingApi as WITApi_NOREQUIRE } from "azure-devops-node-api/WorkItemTrackingApi";

import { PICKLIST_NO_ACTION } from "./Constants";
import { Engine } from "./Engine";
import { ImportError, ValidationError } from "./Errors";
import { ICommandLineOptions, IConfigurationFile, IDictionaryStringTo, IProcessPayload, IWITLayout, IWITRules, IWITStates, IRestClients } from "./Interfaces";
import { logger } from "./Logger";
import { Utility } from "./Utilities";

export class ProcessImporter {
    private _witProcessApi: WITProcessApi_NOREQUIRE;
    private _witProcessDefinitionApi: WITProcessDefinitionApi_NOREQUIRE;
    private _witApi: WITApi_NOREQUIRE;

    constructor(restClients: IRestClients, private _config?: IConfigurationFile, private _commandLineOptions?: ICommandLineOptions) {
        this._witApi = restClients.witApi;
        this._witProcessApi = restClients.witProcessApi;
        this._witProcessDefinitionApi = restClients.witProcessDefinitionApi;
    }

    private async _importWorkItemTypes(payload: IProcessPayload): Promise<void> {
        for (const wit of payload.workItemTypes) {
            if (wit.class === WITProcessInterfaces.WorkItemTypeClass.System) {
                //The exported payload should not have exported System WITypes, so fail on import.
                throw new ImportError(`Work item type '${wit.name}' is a system work item type with no modifications, cannot import.`);
            }
            else {
                const createdWorkItemType = await Utility.tryCatchWithKnownError(() => this._witProcessDefinitionApi.createWorkItemType(wit, payload.process.typeId),
                    () => new ImportError(`Failed to create work item type '${wit.id}, see logs for details.`));
                if (!createdWorkItemType || createdWorkItemType.id !== wit.id) {
                    throw new ImportError(`Failed to create work item type '${wit.id}', server returned empty or reference name does not match.`);
                }
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
                throw new ImportError("Failed to get fields from target account, server returned empty result");
            }
        }
        catch (error) {
            Utility.handleKnownError(error);
            throw new ImportError("Failed to get fields from target account, see logs for details.")
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
            for (const field of fieldsToCreate) {
                try {
                    const fieldCreated = await Engine.Task(() => this._witProcessDefinitionApi.createField(field, payload.process.typeId), `Create field '${field.id}'`);
                    if (!fieldCreated) {
                        throw new ImportError(`Create field '${field.name}' failed, server returned empty object`);
                    }
                    if (fieldCreated.id !== field.id) {
                        throw new ImportError(`Create field '${field.name}' actually returned referenace name '${fieldCreated.id}' instead of anticipated '${field.id}', are you on latest VSTS?`);
                    }

                }
                catch (error) {
                    Utility.handleKnownError(error);
                    throw new ImportError(`Create field '${field.name}' failed, see log for details.`);
                }
            };
        }
    }

    /**Add fields at a Work Item Type scope*/
    private async _addFieldsToWorkItemTypes(payload: IProcessPayload): Promise<void> {
        for (const entry of payload.workItemTypeFields) {
            for (const field of entry.fields) {
                try {
                    // Make separate call to set default value on identity field allow failover 
                    const defaultValue = field.defaultValue;
                    field.defaultValue = field.type === WITProcessDefinitionsInterfaces.FieldType.Identity ? null : defaultValue;

                    const fieldAdded = await Engine.Task(
                        () => this._witProcessDefinitionApi.addFieldToWorkItemType(field, payload.process.typeId, entry.workItemTypeRefName),
                        `Add field '${field.referenceName}' to work item type '${entry.workItemTypeRefName}'`);

                    if (!fieldAdded || fieldAdded.referenceName !== field.referenceName) {
                        throw new ImportError(`Failed to add field '${field.referenceName}' to work item type '${entry.workItemTypeRefName}', server returned empty result or reference name does not match.`);
                    }

                    if (defaultValue) {
                        field.defaultValue = defaultValue;
                        try {
                            const fieldAddedWithDefaultValue = await Engine.Task(
                                () => this._witProcessDefinitionApi.addFieldToWorkItemType(field, payload.process.typeId, entry.workItemTypeRefName),
                                `Updated field '${field.referenceName}' with default value to work item type '${entry.workItemTypeRefName}'`);
                        }
                        catch (error) {
                            if (this._config.options && this._config.options.continueOnIdentityDefaultValueFailure === true) {
                                logger.logWarning(`Failed to set field '${field.referenceName}' with default value '${JSON.stringify(defaultValue, null, 2)}' to work item type '${entry.workItemTypeRefName}', continue because 'skipImportControlContributions' is set to true`);
                            }
                            else {
                                logger.logException(error);
                                throw new ImportError(`Failed to set field '${field.referenceName}' with default value '${JSON.stringify(defaultValue, null, 2)}' to work item type '${entry.workItemTypeRefName}'. You may set skipImportControlContributions = true in configuraiton file to continue.`);
                            }
                        }
                    }
                }
                catch (error) {
                    Utility.handleKnownError(error);
                    throw new ImportError(`Failed to add field '${field.referenceName}' to work item type '${entry.workItemTypeRefName}', see logs for details.`);
                }
            }
        }
    }

    private async _createGroup(createGroup: WITProcessDefinitionsInterfaces.Group,
        page: WITProcessDefinitionsInterfaces.Page,
        section: WITProcessDefinitionsInterfaces.Section,
        witLayout: IWITLayout,
        payload: IProcessPayload
    ) {
        let newGroup: WITProcessDefinitionsInterfaces.Group;
        try {
            newGroup = await Engine.Task(
                () => this._witProcessDefinitionApi.addGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id),
                `Create group '${createGroup.id}' in page '${page.id}'`);
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
            newGroup = await Engine.Task(
                () => this._witProcessDefinitionApi.editGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id, group.id),
                `edit group '${group.id}' in page '${page.id}'`);
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
            throw new ImportError(`Encountered null page in work item type '${witLayout.workItemTypeRefName}'`);
        }

        if (page.isContribution && this._config.options.skipImportFormContributions === true) {
            // skip import page contriubtion unless user explicitly asks so
            return;
        }

        let newPage: WITProcessDefinitionsInterfaces.Page; //The newly created page, contains the pageId required to create groups.
        const createPage = Utility.toCreatePage(page);
        const sourcePagesOnTarget = targetLayout.pages.filter(p => p.id === page.id);
        try {
            newPage = sourcePagesOnTarget.length === 0
                ? await Engine.Task(() => this._witProcessDefinitionApi.addPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName),
                    `Create '${page.id}' page in ${witLayout.workItemTypeRefName}`)
                : await Engine.Task(() => this._witProcessDefinitionApi.editPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName),
                    `Edit '${page.id}' page in ${witLayout.workItemTypeRefName}`);
        }
        catch (error) {
            logger.logException(error);
            throw new ImportError(`Failed to create or edit '${page.id}' page in ${witLayout.workItemTypeRefName}, see logs for details.`);
        }
        if (!newPage || !newPage.id) {
            throw new ImportError(`Failed to create or edit '${page.id}' page in ${witLayout.workItemTypeRefName}, server returned empty result.`);
        }

        page.id = newPage.id;
        // First pass - process inherited groups first (in case a custom group uses inherited group name causing conflict)
        await this._importInheritedGroups(witLayout, page, payload);

        // Second pass - process custom groups and controls 
        await this._importOtherGroupsAndControls(witLayout, page, payload);
    }

    private async _importInheritedGroups(
        witLayout: IWITLayout,
        page: WITProcessDefinitionsInterfaces.Page,
        payload: IProcessPayload
    ) {
        logger.logVerbose(`Start import inherited group changes`);
        for (const section of page.sections) {
            for (const group of section.groups) {
                if (group.inherited && group.overridden) {
                    const updatedGroup: WITProcessDefinitionsInterfaces.Group = Utility.toCreateGroup(group);
                    await this._editGroup(updatedGroup, page, section, group, witLayout, payload);
                }
            }
        }
    }

    private async _importOtherGroupsAndControls(
        witLayout: IWITLayout,
        page: WITProcessDefinitionsInterfaces.Page,
        payload: IProcessPayload
    ) {
        logger.logVerbose(`Start import custom groups and all controls`);
        for (const section of page.sections) {
            for (const group of section.groups) {
                let newGroup: WITProcessDefinitionsInterfaces.Group;

                if (group.isContribution === true && this._config.options.skipImportFormContributions === true) {
                    // skip import group contriubtion unless user explicitly asks so
                    continue;
                }

                if (group.controls.length !== 0 && group.controls[0].controlType === "HtmlFieldControl") {
                    //Handle groups with HTML Controls
                    if (group.inherited) {
                        if (group.overridden) {
                            // No handling on group update since we have done this already in 1st pass
                            const htmlControl = group.controls[0];
                            if (htmlControl.overridden) {
                                // If the HTML control is overriden, we must update that as well 
                                let updatedHtmlControl: WITProcessDefinitionsInterfaces.Control;
                                try {
                                    updatedHtmlControl = await Engine.Task(
                                        () => this._witProcessDefinitionApi.editControl(htmlControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id, htmlControl.id),
                                        `Edit HTML control '${htmlControl.id} in group'${group.id}' in page '${page.id}'`);
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
                        const createGroup: WITProcessDefinitionsInterfaces.Group = Utility.toCreateGroup(group);
                        createGroup.controls = group.controls;
                        await this._createGroup(createGroup, page, section, witLayout, payload);
                    }
                }
                else {
                    //Groups with no HTML Controls

                    if (!group.inherited) {
                        //create the group if it's not inherited
                        const createGroup = Utility.toCreateGroup(group);
                        newGroup = await this._createGroup(createGroup, page, section, witLayout, payload);
                        group.id = newGroup.id;
                    }

                    for (const control of group.controls) {
                        if (!control.inherited || control.overridden) {
                            try {
                                let createControl: WITProcessDefinitionsInterfaces.Control = Utility.toCreateControl(control);

                                if (control.controlType === "WebpageControl" || (control.isContribution === true && this._config.options.skipImportFormContributions === true)) {
                                    // Skip web page control for now since not supported in inherited process.
                                    continue;
                                }

                                if (control.inherited) {
                                    if (control.overridden) {
                                        //edit
                                        await Engine.Task(() => this._witProcessDefinitionApi.editControl(createControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id, control.id),
                                            `Edit control '${control.id}' in group '${group.id}' in page '${page.id}' in work item type '${witLayout.workItemTypeRefName}'.`);
                                    }
                                }
                                else {
                                    //create
                                    await Engine.Task(() => this._witProcessDefinitionApi.addControlToGroup(createControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id),
                                        `Create control '${control.id}' in group '${group.id}' in page '${page.id}' in work item type '${witLayout.workItemTypeRefName}'.`);
                                }
                            }
                            catch (error) {
                                Utility.handleKnownError(error);
                                throw new ImportError(`Unable to add '${control.id}' control to group '${group.id}' in page '${page.id}' in '${witLayout.workItemTypeRefName}'. ${error}`);
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
        for (const witLayoutEntry of payload.layouts) {
            const targetLayout: WITProcessDefinitionsInterfaces.FormLayout = await Engine.Task(
                () => this._witProcessDefinitionApi.getFormLayout(payload.process.typeId, witLayoutEntry.workItemTypeRefName),
                `Get layout on target process for work item type '${witLayoutEntry.workItemTypeRefName}'`);
            for (const page of witLayoutEntry.layout.pages) {
                if (page.pageType === WITProcessDefinitionsInterfaces.PageType.Custom) {
                    await this._importPage(targetLayout, witLayoutEntry, page, payload);
                }
            }
        }
    }

    private async _importWITStates(witStateEntry: IWITStates, payload: IProcessPayload) {
        let targetWITStates: WITProcessDefinitionsInterfaces.WorkItemStateResultModel[];
        try {
            targetWITStates = await Engine.Task(
                () => this._witProcessApi.getStateDefinitions(payload.process.typeId, witStateEntry.workItemTypeRefName),
                `Get states on target process for work item type '${witStateEntry.workItemTypeRefName}'`);
            if (!targetWITStates || targetWITStates.length <= 0) {
                throw new ImportError(`Failed to get states definitions from work item type '${witStateEntry.workItemTypeRefName}' on target account, server returned empty result.`)
            }
        }
        catch (error) {
            Utility.handleKnownError(error);
            throw new ImportError(`Failed to get states definitions from work item type '${witStateEntry.workItemTypeRefName}' on target account, see logs for details.`)
        }

        for (const sourceState of witStateEntry.states) {
            try {
                const existingStates: WITProcessDefinitionsInterfaces.WorkItemStateResultModel[] = targetWITStates.filter(targetState => sourceState.name === targetState.name);
                if (existingStates.length === 0) {  // does not exist on target
                    const createdState = await Engine.Task(
                        () => this._witProcessDefinitionApi.createStateDefinition(Utility.toCreateOrUpdateStateDefinition(sourceState), payload.process.typeId, witStateEntry.workItemTypeRefName),
                        `Create state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type`);
                    if (!createdState || !createdState.id) {
                        throw new ImportError(`Unable to create state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, server returned empty result or id.`);
                    }
                }
                else {
                    if (sourceState.hidden) { // if state exists on target, only update if hidden 
                        const hiddenState = await Engine.Task(
                            () => this._witProcessDefinitionApi.hideStateDefinition({ hidden: true }, payload.process.typeId, witStateEntry.workItemTypeRefName, existingStates[0].id),
                            `Hide state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type`);
                        if (!hiddenState || hiddenState.name !== sourceState.name || !hiddenState.hidden) {
                            throw new ImportError(`Unable to hide state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, server returned empty result, id or state is not hidden.`);
                        }
                    }

                    const existingState = existingStates[0];
                    if (sourceState.color !== existingState.color || sourceState.stateCategory !== existingState.stateCategory || sourceState.name !== existingState.name) {
                        // Inherited state can be edited in custom work item types.
                        const updatedState = await Engine.Task(
                            () => this._witProcessDefinitionApi.updateStateDefinition(Utility.toCreateOrUpdateStateDefinition(sourceState), payload.process.typeId, witStateEntry.workItemTypeRefName, existingState.id),
                            `Update state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type`);
                        if (!updatedState || updatedState.name !== sourceState.name) {
                            throw new ImportError(`Unable to update state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, server returned empty result, id or state is not hidden.`);
                        }
                    }
                }
            }
            catch (error) {
                Utility.handleKnownError(error);
                throw new ImportError(`Unable to create/hide/update state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, see logs for details`);
            }
        }

        for (const targetState of targetWITStates) {
            const sourceStateMatchingTarget: WITProcessDefinitionsInterfaces.WorkItemStateResultModel[] = witStateEntry.states.filter(sourceState => sourceState.name === targetState.name);
            if (sourceStateMatchingTarget.length === 0) {
                try {
                    await Engine.Task(() => this._witProcessDefinitionApi.deleteStateDefinition(payload.process.typeId, witStateEntry.workItemTypeRefName, targetState.id),
                        `Delete state '${targetState.name}' in '${witStateEntry.workItemTypeRefName}' work item type`);
                }
                catch (error) {
                    throw new ImportError(`Unable to delete state '${targetState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, see logs for details`);
                }
            }
        }
    }

    private async _importStates(payload: IProcessPayload): Promise<void> {
        for (const witStateEntry of payload.states) {
            await this._importWITStates(witStateEntry, payload);
        }
    }

    private async _importWITRule(rule: WITProcessInterfaces.FieldRuleModel, witRulesEntry: IWITRules, payload: IProcessPayload) {
        try {
            const createdRule = await Engine.Task(
                () => this._witProcessApi.addWorkItemTypeRule(rule, payload.process.typeId, witRulesEntry.workItemTypeRefName),
                `Create rule '${rule.id}' in work item type '${witRulesEntry.workItemTypeRefName}'`);

            if (!createdRule || !createdRule.id) {
                throw new ImportError(`Unable to create rule '${rule.id}' in work item type '${witRulesEntry.workItemTypeRefName}', server returned empty result or id.`);
            }
        }
        catch (error) {
            if (this._config.options.continueOnRuleImportFailure === true) {
                logger.logWarning(`Failed to import rule below, continue importing rest of process.\r\n:Error:${error}\r\n${JSON.stringify(rule, null, 2)}`);
            }
            else {
                Utility.handleKnownError(error);
                throw new ImportError(`Unable to create rule '${rule.id}' in work item type '${witRulesEntry.workItemTypeRefName}', see logs for details.`);
            }
        }
    }

    private async _importRules(payload: IProcessPayload): Promise<void> {
        for (const witRulesEntry of payload.rules) {
            for (const rule of witRulesEntry.rules) {
                if (!rule.isSystem) {
                    await this._importWITRule(rule, witRulesEntry, payload);
                }
            }
        }
    }

    private async _importBehaviors(payload: IProcessPayload): Promise<void> {
        const behaviorsOnTarget = await Utility.tryCatchWithKnownError(
            async () => {
                return await Engine.Task(
                    () => this._witProcessApi.getBehaviors(payload.process.typeId),
                    `Get behaviors on target account`);
            }, () => new ImportError(`Failed to get behaviors on target account.`));

        const behaviorIdToRealNameBehavior: { [id: string]: WITProcessDefinitionsInterfaces.BehaviorReplaceModel } = {};

        for (const behavior of payload.behaviors) {
            try {
                const existing = behaviorsOnTarget.some(b => b.id === behavior.id);
                if (!existing) {
                    const createBehavior: WITProcessDefinitionsInterfaces.BehaviorCreateModel = Utility.toCreateBehavior(behavior);
                    // Use a random name to avoid conflict on scenarios involving a name swap 
                    behaviorIdToRealNameBehavior[behavior.id] = Utility.toReplaceBehavior(behavior);
                    createBehavior.name = Utility.createGuidWithoutHyphen();
                    const createdBehavior = await Engine.Task(
                        () => this._witProcessDefinitionApi.createBehavior(createBehavior, payload.process.typeId),
                        `Create behavior '${behavior.id}' with fake name '${behavior.name}'`);
                    if (!createdBehavior || createdBehavior.id !== behavior.id) {
                        throw new ImportError(`Failed to create behavior '${behavior.name}', server returned empty result or id does not match.`)
                    }
                }
                else {
                    const replaceBehavior: WITProcessDefinitionsInterfaces.BehaviorReplaceModel = Utility.toReplaceBehavior(behavior);
                    behaviorIdToRealNameBehavior[behavior.id] = Utility.toReplaceBehavior(behavior);
                    replaceBehavior.name = Utility.createGuidWithoutHyphen();
                    const replacedBehavior = await Engine.Task(
                        () => this._witProcessDefinitionApi.replaceBehavior(replaceBehavior, payload.process.typeId, behavior.id),
                        `Replace behavior '${behavior.id}' with fake name '${behavior.name}'`);
                    if (!replacedBehavior) {
                        throw new ImportError(`Failed to replace behavior '${behavior.name}', server returned empty result.`)
                    }
                }
            }
            catch (error) {
                logger.logException(error);
                throw new ImportError(`Failed to import behavior ${behavior.name}, see logs for details.`);
            }
        }

        // Recover the behavior names to what they should be
        for (const id in behaviorIdToRealNameBehavior) {
            const behaviorWithRealName = behaviorIdToRealNameBehavior[id];
            const replacedBehavior = await Engine.Task(
                () => this._witProcessDefinitionApi.replaceBehavior(behaviorWithRealName, payload.process.typeId, id),
                `Replace behavior '${id}' to it's real name '${behaviorWithRealName.name}'`);
            if (!replacedBehavior) {
                throw new ImportError(`Failed to replace behavior id '${id}' to its real name, server returned empty result.`)
            }
        }
    }

    private async _addBehaviorsToWorkItemTypes(payload: IProcessPayload): Promise<void> {
        for (const witBehaviorsEntry of payload.workItemTypeBehaviors) {
            for (const behavior of witBehaviorsEntry.behaviors) {
                try {
                    if (witBehaviorsEntry.workItemType.workItemTypeClass === WITProcessDefinitionsInterfaces.WorkItemTypeClass.Custom) {
                        const addedBehavior = await Engine.Task(
                            () => this._witProcessDefinitionApi.addBehaviorToWorkItemType(behavior, payload.process.typeId, witBehaviorsEntry.workItemType.refName),
                            `Add behavior '${behavior.behavior.id}' to work item type '${witBehaviorsEntry.workItemType.refName}'`);

                        if (!addedBehavior || addedBehavior.behavior.id !== behavior.behavior.id) {
                            throw new ImportError(`Failed to add behavior '${behavior.behavior.id}' to work item type '${witBehaviorsEntry.workItemType.refName}, server returned empty result or id does not match`);
                        }
                    }
                }
                catch (error) {
                    Utility.handleKnownError(error);
                    throw new ImportError(`Failed to add behavior '${behavior.behavior.id}' to work item type '${witBehaviorsEntry.workItemType.refName}', check logs for details.`);
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
                    const updatedPicklist = await Engine.Task(
                        () => this._witProcessDefinitionApi.updateList(newpicklist, targetPicklistId),
                        `Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}'`);

                    // validate the updated list matches expectation
                    if (!updatedPicklist || !updatedPicklist.id) {
                        throw new ImportError(`Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}' was not successful, result is emtpy, possibly the picklist does not exist on target collection`);
                    }

                    if (updatedPicklist.items.length !== picklistEntry.picklist.items.length) {
                        throw new ImportError(`Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}' was not successful, items number does not match.`);
                    }

                    for (const item of updatedPicklist.items) {
                        if (!picklistEntry.picklist.items.some(i => i.value === item.value)) {
                            throw new ImportError(`Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}' was not successful, item '${item.value}' does not match expected`);
                        }
                    }
                }
                catch (error) {
                    Utility.handleKnownError(error);
                    throw new ImportError(`Failed to update picklist '${targetPicklistId} for field '${picklistEntry.fieldRefName}', check logs for details.`);
                }
            }
            else if (!targetPicklistId) {
                // Target field does not exist we need create picklist to be used when create field.
                picklistEntry.picklist.name = `picklist_${Guid.create()}`; // Avoid conflict on target
                try {
                    const createdPicklist = await Engine.Task(
                        () => this._witProcessDefinitionApi.createList(picklistEntry.picklist),
                        `Create picklist for field ${picklistEntry.fieldRefName}`);

                    if (!createdPicklist || !createdPicklist.id) {
                        throw new ImportError(`Failed to create picklist for field ${picklistEntry.fieldRefName}, server returned empty result or id.`);
                    }

                    targetFieldToPicklistId[picklistEntry.fieldRefName] = createdPicklist.id;
                }
                catch (error) {
                    Utility.handleKnownError(error);
                    throw new ImportError(`Failed to create picklist for field ${picklistEntry.fieldRefName}, see logs for details.`);
                }
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
        await Engine.Task(() => this._importBehaviors(payload), "Import behaviors on target process");
        await Engine.Task(() => this._addBehaviorsToWorkItemTypes(payload), "Add behavior to work item types on target process");
    }

    private async _validateProcess(payload: IProcessPayload): Promise<void> {
        if (payload.process.properties.class != WITProcessInterfaces.ProcessClass.Derived) {
            throw new ValidationError("Only inherited process is supported to be imported.");
        }

        const targetProcesses: WITProcessInterfaces.ProcessModel[] =
            await Utility.tryCatchWithKnownError(async () => {
                return await Engine.Task(() => this._witProcessApi.getProcesses(), `Get processes on target account`);
            }, () => new ValidationError("Failed to get processes on target acccount, check account url, token and token permission."));

        if (!targetProcesses) { // most likely 404
            throw new ValidationError("Failed to get processes on target acccount, check account url.");
        }

        for (const process of targetProcesses) {
            if (payload.process.name.toLowerCase() === process.name.toLowerCase()) {
                throw new ValidationError("Process with same name already exists on target account.");
            }
        }
    }

    private async _validateFields(payload: IProcessPayload): Promise<void> {
        const currentFieldsOnTarget: WITInterfaces.WorkItemField[] =
            await Utility.tryCatchWithKnownError(async () => {
                return await Engine.Task(
                    () => this._witApi.getFields(),
                    `Get fields on target account`);
            }, () => new ValidationError("Failed to get fields on target account."));

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
        const promises: Promise<any>[] = [];
        for (const field of fields) {
            const anyField = <any>field; // TODO: When vso-node-api updates, remove this hack
            assert(field.isPicklist || !anyField.picklistId, "Non picklist field should not have picklist")
            if (field.isPicklist && anyField.picklistId) {
                promises.push(this._witProcessDefinitionApi.getList(anyField.picklistId).then(list => ret[field.referenceName] = list));
            }
        }
        await Promise.all(promises);
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

    private async _deleteProcessOnTarget(targetProcessName: string) {
        const processes = await this._witProcessApi.getProcesses();
        for (const process of processes.filter(p => p.name.toLocaleLowerCase() === targetProcessName.toLocaleLowerCase())) {
            await Utility.tryCatchWithKnownError(
                async () => await Engine.Task(
                    () => this._witProcessApi.deleteProcess(process.typeId),
                    `Delete process '${process.name}' on target account`),
                () => new ImportError(`Failed to delete process on target, do you have projects created using that project?`));
        }
    }

    private async _createProcess(payload: IProcessPayload) {
        const createProcessModel: WITProcessInterfaces.CreateProcessModel = Utility.ProcessModelToCreateProcessModel(payload.process);
        const createdProcess = await Engine.Task(
            () => this._witProcessApi.createProcess(createProcessModel),
            `Create process '${createProcessModel.name}'`);
        if (!createdProcess) {
            throw new ImportError(`Failed to create process '${createProcessModel.name}' on target account.`);
        }
        payload.process.typeId = createdProcess.typeId;
    }

    public async importProcess(payload: IProcessPayload): Promise<void> {
        logger.logInfo("Process import started.");

        try {
            if (this._config.targetProcessName) {
                payload.process.name = this._config.targetProcessName;
            }

            await Engine.Task(() => this._preImportValidation(payload), "Pre-import validation on target account");

            if (this._commandLineOptions.overwriteProcessOnTarget) {
                await Engine.Task(() => this._deleteProcessOnTarget(payload.process.name), "Delete process (if exist) on target account");
            }

            await Engine.Task(() => this._createProcess(payload), "Create process on target account");
            await Engine.Task(() => this._createComponents(payload), "Create artifacts on target process");
        }
        catch (error) {
            if (error instanceof ValidationError) {
                logger.logError("Pre-Import validation failed. No artifacts were created on target process")
            }
            throw error;
        }

        logger.logInfo("Process import completed successfully.");
    }
}
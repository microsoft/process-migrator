"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessImporter = void 0;
const assert = __importStar(require("assert"));
const guid_typescript_1 = require("guid-typescript");
const WITProcessDefinitionsInterfaces = __importStar(require("azure-devops-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces"));
const WITProcessInterfaces = __importStar(require("azure-devops-node-api/interfaces/WorkItemTrackingProcessInterfaces"));
const Constants_1 = require("./Constants");
const Engine_1 = require("./Engine");
const Errors_1 = require("./Errors");
const Logger_1 = require("./Logger");
const Utilities_1 = require("./Utilities");
class ProcessImporter {
    constructor(restClients, _config, _commandLineOptions) {
        this._config = _config;
        this._commandLineOptions = _commandLineOptions;
        this._witApi = restClients.witApi;
        this._witProcessApi = restClients.witProcessApi;
        this._witProcessDefinitionApi = restClients.witProcessDefinitionApi;
    }
    async _importWorkItemTypes(payload) {
        for (const wit of payload.workItemTypes) {
            if (wit.class === WITProcessInterfaces.WorkItemTypeClass.System) {
                throw new Errors_1.ImportError(`Work item type '${wit.name}' is a system work item type with no modifications, cannot import.`);
            }
            else {
                const createdWorkItemType = await Utilities_1.Utility.tryCatchWithKnownError(() => this._witProcessDefinitionApi.createWorkItemType(wit, payload.process.typeId), () => new Errors_1.ImportError(`Failed to create work item type '${wit.id}, see logs for details.`));
                if (!createdWorkItemType || createdWorkItemType.id !== wit.id) {
                    throw new Errors_1.ImportError(`Failed to create work item type '${wit.id}', server returned empty or reference name does not match.`);
                }
            }
        }
    }
    async _getFieldsToCreate(payload) {
        assert(payload.targetAccountInformation && payload.targetAccountInformation.fieldRefNameToPicklistId, "[Unexpected] - targetInformation not properly populated");
        let fieldsOnTarget;
        try {
            fieldsOnTarget = await this._witApi.getFields();
            if (!fieldsOnTarget || fieldsOnTarget.length <= 0) {
                throw new Errors_1.ImportError("Failed to get fields from target account, server returned empty result");
            }
        }
        catch (error) {
            Utilities_1.Utility.handleKnownError(error);
            throw new Errors_1.ImportError("Failed to get fields from target account, see logs for details.");
        }
        const isPicklistField = {};
        for (const e of payload.witFieldPicklists) {
            isPicklistField[e.fieldRefName] = true;
        }
        const outputFields = [];
        for (const sourceField of payload.fields) {
            const fieldExist = fieldsOnTarget.some(targetField => targetField.referenceName === sourceField.id);
            if (!fieldExist) {
                const createField = Utilities_1.Utility.WITProcessToWITProcessDefinitionsFieldModel(sourceField);
                if (sourceField.isIdentity) {
                    createField.type = WITProcessDefinitionsInterfaces.FieldType.Identity;
                }
                if (isPicklistField[sourceField.id]) {
                    const picklistId = payload.targetAccountInformation.fieldRefNameToPicklistId[sourceField.id];
                    assert(picklistId !== Constants_1.PICKLIST_NO_ACTION, "[Unexpected] We are creating the field which we found the matching field earlier on collection");
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
    async _importFields(payload) {
        const fieldsToCreate = await Engine_1.Engine.Task(() => this._getFieldsToCreate(payload), "Get fields to be created on target process");
        if (fieldsToCreate.length > 0) {
            for (const field of fieldsToCreate) {
                try {
                    const fieldCreated = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.createField(field, payload.process.typeId), `Create field '${field.id}'`);
                    if (!fieldCreated) {
                        throw new Errors_1.ImportError(`Create field '${field.name}' failed, server returned empty object`);
                    }
                    if (fieldCreated.id !== field.id) {
                        throw new Errors_1.ImportError(`Create field '${field.name}' actually returned referenace name '${fieldCreated.id}' instead of anticipated '${field.id}', are you on latest VSTS?`);
                    }
                }
                catch (error) {
                    Utilities_1.Utility.handleKnownError(error);
                    throw new Errors_1.ImportError(`Create field '${field.name}' failed, see log for details.`);
                }
            }
            ;
        }
    }
    async _addFieldsToWorkItemTypes(payload) {
        for (const entry of payload.workItemTypeFields) {
            for (const field of entry.fields) {
                try {
                    const defaultValue = field.defaultValue;
                    field.defaultValue = field.type === WITProcessDefinitionsInterfaces.FieldType.Identity ? null : defaultValue;
                    const fieldAdded = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.addFieldToWorkItemType(field, payload.process.typeId, entry.workItemTypeRefName), `Add field '${field.referenceName}' to work item type '${entry.workItemTypeRefName}'`);
                    if (!fieldAdded || fieldAdded.referenceName !== field.referenceName) {
                        throw new Errors_1.ImportError(`Failed to add field '${field.referenceName}' to work item type '${entry.workItemTypeRefName}', server returned empty result or reference name does not match.`);
                    }
                    if (defaultValue) {
                        field.defaultValue = defaultValue;
                        try {
                            const fieldAddedWithDefaultValue = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.addFieldToWorkItemType(field, payload.process.typeId, entry.workItemTypeRefName), `Updated field '${field.referenceName}' with default value to work item type '${entry.workItemTypeRefName}'`);
                        }
                        catch (error) {
                            if (this._config.options && this._config.options.continueOnIdentityDefaultValueFailure === true) {
                                Logger_1.logger.logWarning(`Failed to set field '${field.referenceName}' with default value '${JSON.stringify(defaultValue, null, 2)}' to work item type '${entry.workItemTypeRefName}', continue because 'skipImportControlContributions' is set to true`);
                            }
                            else {
                                Logger_1.logger.logException(error);
                                throw new Errors_1.ImportError(`Failed to set field '${field.referenceName}' with default value '${JSON.stringify(defaultValue, null, 2)}' to work item type '${entry.workItemTypeRefName}'. You may set skipImportControlContributions = true in configuraiton file to continue.`);
                            }
                        }
                    }
                }
                catch (error) {
                    Utilities_1.Utility.handleKnownError(error);
                    throw new Errors_1.ImportError(`Failed to add field '${field.referenceName}' to work item type '${entry.workItemTypeRefName}', see logs for details.`);
                }
            }
        }
    }
    async _createGroup(createGroup, page, section, witLayout, payload) {
        let newGroup;
        try {
            newGroup = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.addGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id), `Create group '${createGroup.id}' in page '${page.id}'`);
        }
        catch (error) {
            Logger_1.logger.logException(error);
            throw new Errors_1.ImportError(`Failed to create group '${createGroup.id}' in page '${page.id}', see logs for details.`);
        }
        if (!newGroup || !newGroup.id) {
            throw new Errors_1.ImportError(`Failed to create group '${createGroup.id}' in page '${page.id}', server returned empty result or non-matching id.`);
        }
        return newGroup;
    }
    async _editGroup(createGroup, page, section, group, witLayout, payload) {
        let newGroup;
        try {
            newGroup = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.editGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id, group.id), `edit group '${group.id}' in page '${page.id}'`);
        }
        catch (error) {
            Logger_1.logger.logException(error);
            throw new Errors_1.ImportError(`Failed to edit group '${group.id}' in page '${page.id}', see logs for details.`);
        }
        if (!newGroup || newGroup.id !== group.id) {
            throw new Errors_1.ImportError(`Failed to create group '${group.id}' in page '${page.id}', server returned empty result or id.`);
        }
        return newGroup;
    }
    async _importPage(targetLayout, witLayout, page, payload) {
        if (!page) {
            throw new Errors_1.ImportError(`Encountered null page in work item type '${witLayout.workItemTypeRefName}'`);
        }
        if (page.isContribution && this._config.options.skipImportFormContributions === true) {
            return;
        }
        let newPage;
        const createPage = Utilities_1.Utility.toCreatePage(page);
        const sourcePagesOnTarget = targetLayout.pages.filter(p => p.id === page.id);
        try {
            newPage = sourcePagesOnTarget.length === 0
                ? await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.addPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName), `Create '${page.id}' page in ${witLayout.workItemTypeRefName}`)
                : await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.editPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName), `Edit '${page.id}' page in ${witLayout.workItemTypeRefName}`);
        }
        catch (error) {
            Logger_1.logger.logException(error);
            throw new Errors_1.ImportError(`Failed to create or edit '${page.id}' page in ${witLayout.workItemTypeRefName}, see logs for details.`);
        }
        if (!newPage || !newPage.id) {
            throw new Errors_1.ImportError(`Failed to create or edit '${page.id}' page in ${witLayout.workItemTypeRefName}, server returned empty result.`);
        }
        page.id = newPage.id;
        await this._importInheritedGroups(witLayout, page, payload);
        await this._importOtherGroupsAndControls(witLayout, page, payload);
    }
    async _importInheritedGroups(witLayout, page, payload) {
        Logger_1.logger.logVerbose(`Start import inherited group changes`);
        for (const section of page.sections) {
            for (const group of section.groups) {
                if (group.inherited && group.overridden) {
                    const updatedGroup = Utilities_1.Utility.toCreateGroup(group);
                    await this._editGroup(updatedGroup, page, section, group, witLayout, payload);
                }
            }
        }
    }
    async _importOtherGroupsAndControls(witLayout, page, payload) {
        Logger_1.logger.logVerbose(`Start import custom groups and all controls`);
        for (const section of page.sections) {
            for (const group of section.groups) {
                let newGroup;
                if (group.isContribution === true && this._config.options.skipImportFormContributions === true) {
                    continue;
                }
                if (group.controls.length !== 0 && group.controls[0].controlType === "HtmlFieldControl") {
                    if (group.inherited) {
                        if (group.overridden) {
                            const htmlControl = group.controls[0];
                            if (htmlControl.overridden) {
                                let updatedHtmlControl;
                                try {
                                    updatedHtmlControl = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.editControl(htmlControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id, htmlControl.id), `Edit HTML control '${htmlControl.id} in group'${group.id}' in page '${page.id}'`);
                                }
                                catch (error) {
                                    Logger_1.logger.logException(error);
                                    throw new Errors_1.ImportError(`Failed to edit HTML control '${htmlControl.id} in group'${group.id}' in page '${page.id}', see logs for details.`);
                                }
                                if (!updatedHtmlControl || updatedHtmlControl.id !== htmlControl.id) {
                                    throw new Errors_1.ImportError(`Failed to edit group '${group.id}' in page '${page.id}', server returned empty result or non-matching id.`);
                                }
                            }
                        }
                        else {
                        }
                    }
                    else {
                        const createGroup = Utilities_1.Utility.toCreateGroup(group);
                        createGroup.controls = group.controls;
                        await this._createGroup(createGroup, page, section, witLayout, payload);
                    }
                }
                else {
                    if (!group.inherited) {
                        const createGroup = Utilities_1.Utility.toCreateGroup(group);
                        newGroup = await this._createGroup(createGroup, page, section, witLayout, payload);
                        group.id = newGroup.id;
                    }
                    for (const control of group.controls) {
                        if (!control.inherited || control.overridden) {
                            try {
                                let createControl = Utilities_1.Utility.toCreateControl(control);
                                if (control.controlType === "WebpageControl" || (control.isContribution === true && this._config.options.skipImportFormContributions === true)) {
                                    continue;
                                }
                                if (control.inherited) {
                                    if (control.overridden) {
                                        await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.editControl(createControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id, control.id), `Edit control '${control.id}' in group '${group.id}' in page '${page.id}' in work item type '${witLayout.workItemTypeRefName}'.`);
                                    }
                                }
                                else {
                                    await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.addControlToGroup(createControl, payload.process.typeId, witLayout.workItemTypeRefName, group.id), `Create control '${control.id}' in group '${group.id}' in page '${page.id}' in work item type '${witLayout.workItemTypeRefName}'.`);
                                }
                            }
                            catch (error) {
                                Utilities_1.Utility.handleKnownError(error);
                                throw new Errors_1.ImportError(`Unable to add '${control.id}' control to group '${group.id}' in page '${page.id}' in '${witLayout.workItemTypeRefName}'. ${error}`);
                            }
                        }
                    }
                }
            }
        }
    }
    async _importLayouts(payload) {
        for (const witLayoutEntry of payload.layouts) {
            const targetLayout = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.getFormLayout(payload.process.typeId, witLayoutEntry.workItemTypeRefName), `Get layout on target process for work item type '${witLayoutEntry.workItemTypeRefName}'`);
            for (const page of witLayoutEntry.layout.pages) {
                if (page.pageType === WITProcessDefinitionsInterfaces.PageType.Custom) {
                    await this._importPage(targetLayout, witLayoutEntry, page, payload);
                }
            }
        }
    }
    async _importWITStates(witStateEntry, payload) {
        let targetWITStates;
        try {
            targetWITStates = await Engine_1.Engine.Task(() => this._witProcessApi.getStateDefinitions(payload.process.typeId, witStateEntry.workItemTypeRefName), `Get states on target process for work item type '${witStateEntry.workItemTypeRefName}'`);
            if (!targetWITStates || targetWITStates.length <= 0) {
                throw new Errors_1.ImportError(`Failed to get states definitions from work item type '${witStateEntry.workItemTypeRefName}' on target account, server returned empty result.`);
            }
        }
        catch (error) {
            Utilities_1.Utility.handleKnownError(error);
            throw new Errors_1.ImportError(`Failed to get states definitions from work item type '${witStateEntry.workItemTypeRefName}' on target account, see logs for details.`);
        }
        for (const sourceState of witStateEntry.states) {
            try {
                const existingStates = targetWITStates.filter(targetState => sourceState.name === targetState.name);
                if (existingStates.length === 0) {
                    const createdState = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.createStateDefinition(Utilities_1.Utility.toCreateOrUpdateStateDefinition(sourceState), payload.process.typeId, witStateEntry.workItemTypeRefName), `Create state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type`);
                    if (!createdState || !createdState.id) {
                        throw new Errors_1.ImportError(`Unable to create state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, server returned empty result or id.`);
                    }
                }
                else {
                    if (sourceState.hidden) {
                        const hiddenState = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.hideStateDefinition({ hidden: true }, payload.process.typeId, witStateEntry.workItemTypeRefName, existingStates[0].id), `Hide state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type`);
                        if (!hiddenState || hiddenState.name !== sourceState.name || !hiddenState.hidden) {
                            throw new Errors_1.ImportError(`Unable to hide state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, server returned empty result, id or state is not hidden.`);
                        }
                    }
                    const existingState = existingStates[0];
                    if (sourceState.color !== existingState.color || sourceState.stateCategory !== existingState.stateCategory || sourceState.name !== existingState.name) {
                        const updatedState = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.updateStateDefinition(Utilities_1.Utility.toCreateOrUpdateStateDefinition(sourceState), payload.process.typeId, witStateEntry.workItemTypeRefName, existingState.id), `Update state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type`);
                        if (!updatedState || updatedState.name !== sourceState.name) {
                            throw new Errors_1.ImportError(`Unable to update state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, server returned empty result, id or state is not hidden.`);
                        }
                    }
                }
            }
            catch (error) {
                Utilities_1.Utility.handleKnownError(error);
                throw new Errors_1.ImportError(`Unable to create/hide/update state '${sourceState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, see logs for details`);
            }
        }
        for (const targetState of targetWITStates) {
            const sourceStateMatchingTarget = witStateEntry.states.filter(sourceState => sourceState.name === targetState.name);
            if (sourceStateMatchingTarget.length === 0) {
                try {
                    await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.deleteStateDefinition(payload.process.typeId, witStateEntry.workItemTypeRefName, targetState.id), `Delete state '${targetState.name}' in '${witStateEntry.workItemTypeRefName}' work item type`);
                }
                catch (error) {
                    throw new Errors_1.ImportError(`Unable to delete state '${targetState.name}' in '${witStateEntry.workItemTypeRefName}' work item type, see logs for details`);
                }
            }
        }
    }
    async _importStates(payload) {
        for (const witStateEntry of payload.states) {
            await this._importWITStates(witStateEntry, payload);
        }
    }
    async _importWITRule(rule, witRulesEntry, payload) {
        try {
            const createRequest = {
                name: rule.name,
                actions: rule.actions,
                conditions: rule.conditions,
                isDisabled: rule.isDisabled
            };
            const createdRule = await Engine_1.Engine.Task(() => this._witProcessApi.addProcessWorkItemTypeRule(createRequest, payload.process.typeId, witRulesEntry.workItemTypeRefName), `Create rule '${rule.id}' in work item type '${witRulesEntry.workItemTypeRefName}'`);
            if (!createdRule || !createdRule.id) {
                throw new Errors_1.ImportError(`Unable to create rule '${rule.id}' in work item type '${witRulesEntry.workItemTypeRefName}', server returned empty result or id.`);
            }
        }
        catch (error) {
            if (this._config.options.continueOnRuleImportFailure === true) {
                Logger_1.logger.logWarning(`Failed to import rule below, continue importing rest of process.\r\n:Error:${error}\r\n${JSON.stringify(rule, null, 2)}`);
            }
            else {
                Utilities_1.Utility.handleKnownError(error);
                throw new Errors_1.ImportError(`Unable to create rule '${rule.id}' in work item type '${witRulesEntry.workItemTypeRefName}', see logs for details.`);
            }
        }
    }
    async _importRules(payload) {
        for (const witRulesEntry of payload.rules) {
            for (const rule of witRulesEntry.rules) {
                if (rule.customizationType !== WITProcessInterfaces.CustomizationType.System) {
                    await this._importWITRule(rule, witRulesEntry, payload);
                }
            }
        }
    }
    async _importBehaviors(payload) {
        const behaviorsOnTarget = await Utilities_1.Utility.tryCatchWithKnownError(async () => {
            return await Engine_1.Engine.Task(() => this._witProcessApi.getProcessBehaviors(payload.process.typeId), `Get behaviors on target account`);
        }, () => new Errors_1.ImportError(`Failed to get behaviors on target account.`));
        const behaviorIdToRealNameBehavior = {};
        for (const behavior of payload.behaviors) {
            try {
                const existing = behaviorsOnTarget.some(b => b.referenceName === behavior.referenceName);
                if (!existing) {
                    const createBehavior = Utilities_1.Utility.toCreateBehavior(behavior);
                    behaviorIdToRealNameBehavior[behavior.referenceName] = Utilities_1.Utility.toReplaceBehavior(behavior);
                    createBehavior.name = Utilities_1.Utility.createGuidWithoutHyphen();
                    const createdBehavior = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.createBehavior(createBehavior, payload.process.typeId), `Create behavior '${behavior.referenceName}' with fake name '${behavior.name}'`);
                    if (!createdBehavior || createdBehavior.id !== behavior.referenceName) {
                        throw new Errors_1.ImportError(`Failed to create behavior '${behavior.name}', server returned empty result or id does not match.`);
                    }
                }
                else {
                    const replaceBehavior = Utilities_1.Utility.toReplaceBehavior(behavior);
                    behaviorIdToRealNameBehavior[behavior.referenceName] = Utilities_1.Utility.toReplaceBehavior(behavior);
                    replaceBehavior.name = Utilities_1.Utility.createGuidWithoutHyphen();
                    const replacedBehavior = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.replaceBehavior(replaceBehavior, payload.process.typeId, behavior.referenceName), `Replace behavior '${behavior.referenceName}' with fake name '${behavior.name}'`);
                    if (!replacedBehavior) {
                        throw new Errors_1.ImportError(`Failed to replace behavior '${behavior.name}', server returned empty result.`);
                    }
                }
            }
            catch (error) {
                Logger_1.logger.logException(error);
                throw new Errors_1.ImportError(`Failed to import behavior ${behavior.name}, see logs for details.`);
            }
        }
        for (const id in behaviorIdToRealNameBehavior) {
            const behaviorWithRealName = behaviorIdToRealNameBehavior[id];
            const replacedBehavior = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.replaceBehavior(behaviorWithRealName, payload.process.typeId, id), `Replace behavior '${id}' to it's real name '${behaviorWithRealName.name}'`);
            if (!replacedBehavior) {
                throw new Errors_1.ImportError(`Failed to replace behavior id '${id}' to its real name, server returned empty result.`);
            }
        }
    }
    async _addBehaviorsToWorkItemTypes(payload) {
        for (const witBehaviorsEntry of payload.workItemTypeBehaviors) {
            for (const behavior of witBehaviorsEntry.behaviors) {
                try {
                    if (witBehaviorsEntry.workItemType.workItemTypeClass === WITProcessDefinitionsInterfaces.WorkItemTypeClass.Custom) {
                        const addedBehavior = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.addBehaviorToWorkItemType(behavior, payload.process.typeId, witBehaviorsEntry.workItemType.refName), `Add behavior '${behavior.behavior.id}' to work item type '${witBehaviorsEntry.workItemType.refName}'`);
                        if (!addedBehavior || addedBehavior.behavior.id !== behavior.behavior.id) {
                            throw new Errors_1.ImportError(`Failed to add behavior '${behavior.behavior.id}' to work item type '${witBehaviorsEntry.workItemType.refName}, server returned empty result or id does not match`);
                        }
                    }
                }
                catch (error) {
                    Utilities_1.Utility.handleKnownError(error);
                    throw new Errors_1.ImportError(`Failed to add behavior '${behavior.behavior.id}' to work item type '${witBehaviorsEntry.workItemType.refName}', check logs for details.`);
                }
            }
        }
    }
    async _importPicklists(payload) {
        assert(payload.targetAccountInformation && payload.targetAccountInformation.fieldRefNameToPicklistId, "[Unexpected] - targetInformation not properly populated");
        const targetFieldToPicklistId = payload.targetAccountInformation.fieldRefNameToPicklistId;
        const processedFieldRefNames = {};
        for (const picklistEntry of payload.witFieldPicklists) {
            if (processedFieldRefNames[picklistEntry.fieldRefName] === true) {
                continue;
            }
            const targetPicklistId = targetFieldToPicklistId[picklistEntry.fieldRefName];
            if (targetPicklistId && targetPicklistId !== Constants_1.PICKLIST_NO_ACTION) {
                let newpicklist = {};
                Object.assign(newpicklist, picklistEntry.picklist);
                newpicklist.id = targetPicklistId;
                try {
                    const updatedPicklist = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.updateList(newpicklist, targetPicklistId), `Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}'`);
                    if (!updatedPicklist || !updatedPicklist.id) {
                        throw new Errors_1.ImportError(`Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}' was not successful, result is emtpy, possibly the picklist does not exist on target collection`);
                    }
                    if (updatedPicklist.items.length !== picklistEntry.picklist.items.length) {
                        throw new Errors_1.ImportError(`Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}' was not successful, items number does not match.`);
                    }
                    for (const item of updatedPicklist.items) {
                        if (!picklistEntry.picklist.items.some(i => i.value === item.value)) {
                            throw new Errors_1.ImportError(`Update picklist '${targetPicklistId}' for field '${picklistEntry.fieldRefName}' was not successful, item '${item.value}' does not match expected`);
                        }
                    }
                }
                catch (error) {
                    Utilities_1.Utility.handleKnownError(error);
                    throw new Errors_1.ImportError(`Failed to update picklist '${targetPicklistId} for field '${picklistEntry.fieldRefName}', check logs for details.`);
                }
            }
            else if (!targetPicklistId) {
                picklistEntry.picklist.name = `picklist_${guid_typescript_1.Guid.create()}`;
                try {
                    const createdPicklist = await Engine_1.Engine.Task(() => this._witProcessDefinitionApi.createList(picklistEntry.picklist), `Create picklist for field ${picklistEntry.fieldRefName}`);
                    if (!createdPicklist || !createdPicklist.id) {
                        throw new Errors_1.ImportError(`Failed to create picklist for field ${picklistEntry.fieldRefName}, server returned empty result or id.`);
                    }
                    targetFieldToPicklistId[picklistEntry.fieldRefName] = createdPicklist.id;
                }
                catch (error) {
                    Utilities_1.Utility.handleKnownError(error);
                    throw new Errors_1.ImportError(`Failed to create picklist for field ${picklistEntry.fieldRefName}, see logs for details.`);
                }
            }
            processedFieldRefNames[picklistEntry.fieldRefName] = true;
        }
    }
    async _createComponents(payload) {
        await Engine_1.Engine.Task(() => this._importPicklists(payload), "Import picklists on target account");
        await Engine_1.Engine.Task(() => this._importFields(payload), "Import fields on target account");
        await Engine_1.Engine.Task(() => this._importWorkItemTypes(payload), "Import work item types on target process");
        await Engine_1.Engine.Task(() => this._addFieldsToWorkItemTypes(payload), "Add field to work item types on target process");
        await Engine_1.Engine.Task(() => this._importLayouts(payload), "Import work item form layouts on target process");
        await Engine_1.Engine.Task(() => this._importStates(payload), "Import states on target process");
        await Engine_1.Engine.Task(() => this._importRules(payload), "Import rules on target process");
        await Engine_1.Engine.Task(() => this._importBehaviors(payload), "Import behaviors on target process");
        await Engine_1.Engine.Task(() => this._addBehaviorsToWorkItemTypes(payload), "Add behavior to work item types on target process");
    }
    async _validateProcess(payload) {
        if (payload.process.customizationType !== WITProcessInterfaces.CustomizationType.Inherited) {
            throw new Errors_1.ValidationError("Only inherited process is supported to be imported.");
        }
        const targetProcesses = await Utilities_1.Utility.tryCatchWithKnownError(async () => {
            return await Engine_1.Engine.Task(() => this._witProcessApi.getListOfProcesses(), `Get processes on target account`);
        }, () => new Errors_1.ValidationError("Failed to get processes on target acccount, check account url, token and token permission."));
        if (!targetProcesses) {
            throw new Errors_1.ValidationError("Failed to get processes on target acccount, check account url.");
        }
        for (const process of targetProcesses) {
            if (payload.process.name.toLowerCase() === process.name.toLowerCase()) {
                throw new Errors_1.ValidationError("Process with same name already exists on target account.");
            }
        }
    }
    async _validateFields(payload) {
        const currentFieldsOnTarget = await Utilities_1.Utility.tryCatchWithKnownError(async () => {
            return await Engine_1.Engine.Task(() => this._witApi.getFields(), `Get fields on target account`);
        }, () => new Errors_1.ValidationError("Failed to get fields on target account."));
        if (!currentFieldsOnTarget) {
            throw new Errors_1.ValidationError("Failed to get fields on target account.");
        }
        payload.targetAccountInformation.collectionFields = currentFieldsOnTarget;
        const fieldErrors = [];
        for (const sourceField of payload.fields) {
            const convertedSrcFieldType = Utilities_1.Utility.WITProcessToWITFieldType(sourceField.type, sourceField.isIdentity);
            const conflictingFields = currentFieldsOnTarget.filter(targetField => ((targetField.referenceName === sourceField.id) || (targetField.name === sourceField.name))
                && convertedSrcFieldType !== targetField.type
                && (!sourceField.isIdentity || !targetField.isIdentity));
            if (conflictingFields.length > 0) {
                fieldErrors.push(`Field in target Collection conflicts with '${sourceField.name}' field with a different reference name or type.`);
            }
        }
        if (fieldErrors.length > 0) {
            throw new Errors_1.AggregateValidationError(fieldErrors);
        }
    }
    async _populatePicklistDictionary(fields) {
        const ret = {};
        const promises = [];
        for (const field of fields) {
            const anyField = field;
            assert(field.isPicklist || !anyField.picklistId, "Non picklist field should not have picklist");
            if (field.isPicklist && anyField.picklistId) {
                promises.push(this._witProcessDefinitionApi.getList(anyField.picklistId).then(list => ret[field.referenceName] = list));
            }
        }
        await Promise.all(promises);
        return ret;
    }
    async _validatePicklists(payload) {
        assert(payload.targetAccountInformation && payload.targetAccountInformation.collectionFields, "[Unexpected] - targetInformation not properly populated");
        const fieldToPicklistIdMapping = payload.targetAccountInformation.fieldRefNameToPicklistId;
        const currentTargetFieldToPicklist = await this._populatePicklistDictionary(payload.targetAccountInformation.collectionFields);
        const picklistErrors = [];
        for (const picklistEntry of payload.witFieldPicklists) {
            const fieldRefName = picklistEntry.fieldRefName;
            const currentTargetPicklist = currentTargetFieldToPicklist[fieldRefName];
            if (currentTargetPicklist) {
                let conflict;
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
                        picklistErrors.push(`Picklist field ${fieldRefName} exist on target account but have different items than source, set 'overwritePicklist' option to overwrite`);
                    }
                    else {
                        fieldToPicklistIdMapping[fieldRefName] = currentTargetPicklist.id;
                    }
                }
                else {
                    fieldToPicklistIdMapping[fieldRefName] = Constants_1.PICKLIST_NO_ACTION;
                }
            }
            else {
            }
        }
        if (picklistErrors.length > 0) {
            throw new Errors_1.AggregateValidationError(picklistErrors);
        }
    }
    async _preImportValidation(payload) {
        payload.targetAccountInformation = {
            fieldRefNameToPicklistId: {}
        };
        if (!this._commandLineOptions.overwriteProcessOnTarget) {
            await Engine_1.Engine.Task(() => this._validateProcess(payload), "Validate process existence on target account");
        }
        const allValidationErrors = [];
        try {
            await Engine_1.Engine.Task(() => this._validateFields(payload), "Validate fields on target account");
        }
        catch (error) {
            if (error instanceof Errors_1.AggregateValidationError) {
                allValidationErrors.push(...error.errors);
            }
            else {
                throw error;
            }
        }
        try {
            await Engine_1.Engine.Task(() => this._validatePicklists(payload), "Validate picklists on target account");
        }
        catch (error) {
            if (error instanceof Errors_1.AggregateValidationError) {
                allValidationErrors.push(...error.errors);
            }
            else {
                throw error;
            }
        }
        if (allValidationErrors.length > 0) {
            throw new Errors_1.AggregateValidationError(allValidationErrors);
        }
    }
    async _deleteProcessOnTarget(targetProcessName) {
        const processes = await this._witProcessApi.getListOfProcesses();
        for (const process of processes.filter(p => p.name.toLocaleLowerCase() === targetProcessName.toLocaleLowerCase())) {
            await Utilities_1.Utility.tryCatchWithKnownError(async () => await Engine_1.Engine.Task(() => this._witProcessApi.deleteProcessById(process.typeId), `Delete process '${process.name}' on target account`), () => new Errors_1.ImportError(`Failed to delete process on target, do you have projects created using that project?`));
        }
    }
    async _createProcess(payload) {
        const createProcessModel = Utilities_1.Utility.ProcessModelToCreateProcessModel(payload.process);
        const createdProcess = await Engine_1.Engine.Task(() => this._witProcessApi.createNewProcess(createProcessModel), `Create process '${createProcessModel.name}'`);
        if (!createdProcess) {
            throw new Errors_1.ImportError(`Failed to create process '${createProcessModel.name}' on target account.`);
        }
        payload.process.typeId = createdProcess.typeId;
    }
    async importProcess(payload) {
        Logger_1.logger.logInfo("Process import started.");
        try {
            if (this._config.targetProcessName) {
                payload.process.name = this._config.targetProcessName;
            }
            await Engine_1.Engine.Task(() => this._preImportValidation(payload), "Pre-import validation on target account");
            if (this._commandLineOptions.overwriteProcessOnTarget) {
                await Engine_1.Engine.Task(() => this._deleteProcessOnTarget(payload.process.name), "Delete process (if exist) on target account");
            }
            await Engine_1.Engine.Task(() => this._createProcess(payload), "Create process on target account");
            await Engine_1.Engine.Task(() => this._createComponents(payload), "Create artifacts on target process");
        }
        catch (error) {
            if (error instanceof Errors_1.ValidationError) {
                Logger_1.logger.logError("Pre-Import validation failed. No artifacts were created on target process");
            }
            throw error;
        }
        Logger_1.logger.logInfo("Process import completed successfully.");
    }
}
exports.ProcessImporter = ProcessImporter;
//# sourceMappingURL=ProcessImporter.js.map
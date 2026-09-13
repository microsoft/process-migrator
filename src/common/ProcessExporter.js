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
exports.ProcessExporter = void 0;
const WITProcessDefinitionsInterfaces = __importStar(require("azure-devops-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces"));
const WITProcessInterfaces = __importStar(require("azure-devops-node-api/interfaces/WorkItemTrackingProcessInterfaces"));
const Errors_1 = require("./Errors");
const Logger_1 = require("./Logger");
const Engine_1 = require("./Engine");
const Utilities_1 = require("./Utilities");
class ProcessExporter {
    constructor(restClients, _config) {
        this._config = _config;
        this._witApi = restClients.witApi;
        this._witProcessApi = restClients.witProcessApi;
        this._witProcessDefinitionApi = restClients.witProcessDefinitionApi;
    }
    async _getSourceProcessId() {
        const processes = await Utilities_1.Utility.tryCatchWithKnownError(() => this._witProcessApi.getListOfProcesses(), () => new Errors_1.ExportError(`Error getting processes on source account '${this._config.sourceAccountUrl}, check account url, token and token permissions.`));
        if (!processes) {
            throw new Errors_1.ExportError(`Failed to get processes on source account '${this._config.sourceAccountUrl}', check account url.`);
        }
        const lowerCaseSourceProcessName = this._config.sourceProcessName.toLocaleLowerCase();
        const matchProcesses = processes.filter(p => p.name.toLocaleLowerCase() === lowerCaseSourceProcessName);
        if (matchProcesses.length === 0) {
            throw new Errors_1.ExportError(`Process '${this._config.sourceProcessName}' is not found on source account.`);
        }
        const process = matchProcesses[0];
        if (process.customizationType !== WITProcessInterfaces.CustomizationType.Inherited) {
            throw new Errors_1.ExportError(`Process '${this._config.sourceProcessName}' is not a derived process, not supported.`);
        }
        return process.typeId;
    }
    async _getComponents(processId) {
        let _process;
        let _behaviorsCollectionScope;
        let _fieldsCollectionScope;
        const _fieldsWorkitemtypeScope = [];
        const _layouts = [];
        const _states = [];
        const _rules = [];
        const _behaviorsWITypeScope = [];
        const _picklists = [];
        const knownPicklists = {};
        const _nonSystemWorkItemTypes = [];
        const processPromises = [];
        processPromises.push(this._witProcessApi.getProcessByItsId(processId).then(process => _process = process));
        processPromises.push(this._witProcessApi.getProcessBehaviors(processId).then(behaviors => _behaviorsCollectionScope = behaviors));
        processPromises.push(this._witProcessDefinitionApi.getWorkItemTypes(processId).then(workitemtypes => {
            const perWitPromises = [];
            for (const workitemtype of workitemtypes) {
                const currentWitPromises = [];
                currentWitPromises.push(this._witProcessDefinitionApi.getBehaviorsForWorkItemType(processId, workitemtype.id).then(behaviors => {
                    const witBehaviorsInfo = { refName: workitemtype.id, workItemTypeClass: workitemtype.class };
                    const witBehaviors = {
                        workItemType: witBehaviorsInfo,
                        behaviors: behaviors
                    };
                    _behaviorsWITypeScope.push(witBehaviors);
                }));
                if (workitemtype.class !== WITProcessDefinitionsInterfaces.WorkItemTypeClass.System) {
                    _nonSystemWorkItemTypes.push(workitemtype);
                    currentWitPromises.push(this._witProcessDefinitionApi.getWorkItemTypeFields(processId, workitemtype.id).then(fields => {
                        const witFields = {
                            workItemTypeRefName: workitemtype.id,
                            fields: fields
                        };
                        _fieldsWorkitemtypeScope.push(witFields);
                        const picklistPromises = [];
                        for (const field of fields) {
                            if (field.pickList && !knownPicklists[field.referenceName]) {
                                knownPicklists[field.pickList.id] = true;
                                picklistPromises.push(this._witProcessDefinitionApi.getList(field.pickList.id).then(picklist => _picklists.push({
                                    workitemtypeRefName: workitemtype.id,
                                    fieldRefName: field.referenceName,
                                    picklist: picklist
                                })));
                            }
                        }
                        return Promise.all(picklistPromises);
                    }));
                    let layoutForm;
                    currentWitPromises.push(this._witProcessDefinitionApi.getFormLayout(processId, workitemtype.id).then(layout => {
                        const witLayout = {
                            workItemTypeRefName: workitemtype.id,
                            layout: layout
                        };
                        _layouts.push(witLayout);
                    }));
                    currentWitPromises.push(this._witProcessDefinitionApi.getStateDefinitions(processId, workitemtype.id).then(states => {
                        const witStates = {
                            workItemTypeRefName: workitemtype.id,
                            states: states
                        };
                        _states.push(witStates);
                    }));
                    currentWitPromises.push(this._witProcessApi.getProcessWorkItemTypeRules(processId, workitemtype.id).then(rules => {
                        const witRules = {
                            workItemTypeRefName: workitemtype.id,
                            rules: rules
                        };
                        _rules.push(witRules);
                    }));
                }
                perWitPromises.push(Promise.all(currentWitPromises));
            }
            return Promise.all(perWitPromises);
        }));
        await Promise.all(processPromises);
        const seenFieldIds = new Set();
        _fieldsCollectionScope = [];
        for (const witFields of _fieldsWorkitemtypeScope) {
            for (const f of witFields.fields) {
                const refName = f.referenceName;
                if (refName && !seenFieldIds.has(refName)) {
                    seenFieldIds.add(refName);
                    _fieldsCollectionScope.push({
                        id: refName,
                        name: f.name,
                        type: f.type,
                        isIdentity: f.type === WITProcessDefinitionsInterfaces.FieldType.Identity,
                        url: f.url,
                    });
                }
            }
        }
        const processPayload = {
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
    async exportProcess() {
        Logger_1.logger.logInfo("Export process started.");
        const processId = await Engine_1.Engine.Task(() => this._getSourceProcessId(), "Get source process Id from name");
        const payload = await Engine_1.Engine.Task(() => this._getComponents(processId), "Get artifacts from source process");
        Logger_1.logger.logInfo("Export process completed.");
        return payload;
    }
}
exports.ProcessExporter = ProcessExporter;
//# sourceMappingURL=ProcessExporter.js.map
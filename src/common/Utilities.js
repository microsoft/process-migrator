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
exports.Utility = void 0;
const WITInterfaces = __importStar(require("azure-devops-node-api/interfaces/WorkItemTrackingInterfaces"));
const WITProcessDefinitionsInterfaces = __importStar(require("azure-devops-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces"));
const WITProcessInterfaces = __importStar(require("azure-devops-node-api/interfaces/WorkItemTrackingProcessInterfaces"));
const Errors_1 = require("./Errors");
const Logger_1 = require("./Logger");
const Interfaces_1 = require("./Interfaces");
const url = __importStar(require("url"));
const guid_typescript_1 = require("guid-typescript");
const Constants_1 = require("./Constants");
class Utility {
    static WITProcessToWITProcessDefinitionsFieldModel(fieldModel) {
        let outField = {
            description: fieldModel.description,
            id: fieldModel.id,
            name: fieldModel.name,
            type: fieldModel.isIdentity ? WITProcessDefinitionsInterfaces.FieldType.Identity : fieldModel.type,
            url: fieldModel.url,
            pickList: null
        };
        return outField;
    }
    static WITProcessToWITFieldType(witProcessFieldType, fieldIsIdentity) {
        if (fieldIsIdentity) {
            return WITInterfaces.FieldType.Identity;
        }
        switch (witProcessFieldType) {
            case WITProcessInterfaces.FieldType.String: {
                return WITInterfaces.FieldType.String;
            }
            case WITProcessInterfaces.FieldType.Integer: {
                return WITInterfaces.FieldType.Integer;
            }
            case WITProcessInterfaces.FieldType.DateTime: {
                return WITInterfaces.FieldType.DateTime;
            }
            case WITProcessInterfaces.FieldType.PlainText: {
                return WITInterfaces.FieldType.PlainText;
            }
            case WITProcessInterfaces.FieldType.Html: {
                return WITInterfaces.FieldType.Html;
            }
            case WITProcessInterfaces.FieldType.TreePath: {
                return WITInterfaces.FieldType.TreePath;
            }
            case WITProcessInterfaces.FieldType.History: {
                return WITInterfaces.FieldType.History;
            }
            case WITProcessInterfaces.FieldType.Double: {
                return WITInterfaces.FieldType.Double;
            }
            case WITProcessInterfaces.FieldType.Guid: {
                return WITInterfaces.FieldType.Guid;
            }
            case WITProcessInterfaces.FieldType.Boolean: {
                return WITInterfaces.FieldType.Boolean;
            }
            case WITProcessInterfaces.FieldType.Identity: {
                return WITInterfaces.FieldType.Identity;
            }
            case WITProcessInterfaces.FieldType.PicklistInteger: {
                return WITInterfaces.FieldType.PicklistInteger;
            }
            case WITProcessInterfaces.FieldType.PicklistString: {
                return WITInterfaces.FieldType.PicklistString;
            }
            case WITProcessInterfaces.FieldType.PicklistDouble: {
                return WITInterfaces.FieldType.PicklistDouble;
            }
            default: {
                throw new Error(`Failed to convert from WorkItemTrackingProcess.FieldType to WorkItemTracking.FieldType, unrecognized enum value '${witProcessFieldType}'`);
            }
        }
    }
    static ProcessModelToCreateProcessModel(processInfo) {
        const createModel = {
            description: processInfo.description,
            name: processInfo.name,
            parentProcessTypeId: processInfo.parentProcessTypeId,
            referenceName: Utility.createGuidWithoutHyphen()
        };
        return createModel;
    }
    static toCreateGroup(group) {
        let createGroup = {
            id: group.id,
            inherited: group.inherited,
            label: group.label,
            isContribution: group.isContribution,
            visible: group.visible,
            controls: null,
            contribution: group.contribution,
            height: group.height,
            order: null,
            overridden: null
        };
        return createGroup;
    }
    static toCreateControl(control) {
        let createControl = {
            id: control.id,
            inherited: control.inherited,
            label: control.label,
            controlType: control.controlType,
            readOnly: control.readOnly,
            watermark: control.watermark,
            metadata: control.metadata,
            visible: control.visible,
            isContribution: control.isContribution,
            contribution: control.contribution,
            height: control.height,
            order: null,
            overridden: null
        };
        return createControl;
    }
    static toCreatePage(page) {
        let createPage = {
            id: page.id,
            inherited: page.inherited,
            label: page.label,
            pageType: page.pageType,
            locked: page.locked,
            visible: page.visible,
            isContribution: page.isContribution,
            sections: null,
            contribution: page.contribution,
            order: null,
            overridden: null
        };
        return createPage;
    }
    static toCreateOrUpdateStateDefinition(state) {
        const updateState = {
            color: state.color,
            name: state.name,
            stateCategory: state.stateCategory,
            order: null
        };
        return updateState;
    }
    static toCreateBehavior(behavior) {
        const createBehavior = {
            color: behavior.color,
            inherits: behavior.inherits ? behavior.inherits.behaviorRefName : undefined,
            name: behavior.name
        };
        createBehavior.id = behavior.referenceName;
        return createBehavior;
    }
    static toReplaceBehavior(behavior) {
        const replaceBehavior = {
            color: behavior.color,
            name: behavior.name
        };
        return replaceBehavior;
    }
    static handleKnownError(error) {
        if (error instanceof Errors_1.KnownError) {
            throw error;
        }
        Logger_1.logger.logException(error);
    }
    static async tryCatchWithKnownError(action, thrower) {
        try {
            return await action();
        }
        catch (error) {
            Utility.handleKnownError(error);
            throw thrower();
        }
    }
    static validateConfiguration(configuration, mode) {
        if (mode === Interfaces_1.Modes.export || mode === Interfaces_1.Modes.migrate) {
            if (!configuration.sourceAccountUrl || !url.parse(configuration.sourceAccountUrl).host) {
                Logger_1.logger.logError(`[Configuration validation] Missing or invalid source account url: '${configuration.sourceAccountUrl}'.`);
                return false;
            }
            if (!configuration.sourceAccountToken) {
                Logger_1.logger.logError(`[Configuration validation] Missing personal access token for source account.`);
                return false;
            }
            if (!configuration.sourceProcessName) {
                Logger_1.logger.logError(`[Configuration validation] Missing source process name.`);
                return false;
            }
        }
        if (mode === Interfaces_1.Modes.import || mode === Interfaces_1.Modes.migrate) {
            if (!configuration.targetAccountUrl || !url.parse(configuration.targetAccountUrl).host) {
                Logger_1.logger.logError(`[Configuration validation] Missing or invalid target account url: '${configuration.targetAccountUrl}'.`);
                return false;
            }
            if (!configuration.targetAccountToken) {
                Logger_1.logger.logError(`[Configuration validation] Missing personal access token for target account.`);
                return false;
            }
            if (configuration.options && configuration.options.overwritePicklist && (configuration.options.overwritePicklist !== true && configuration.options.overwritePicklist !== false)) {
                Logger_1.logger.logError(`[Configuration validation] Option 'overwritePicklist' is not a valid boolean.`);
                return false;
            }
            if (configuration.options && configuration.options.continueOnRuleImportFailure && (configuration.options.continueOnRuleImportFailure !== true && configuration.options.continueOnRuleImportFailure !== false)) {
                Logger_1.logger.logError(`[Configuration validation] Option 'continueOnRuleImportFailure' is not a valid boolean.`);
                return false;
            }
            if (configuration.options && configuration.options.continueOnIdentityDefaultValueFailure && (configuration.options.continueOnIdentityDefaultValueFailure !== true && configuration.options.continueOnIdentityDefaultValueFailure !== false)) {
                Logger_1.logger.logError(`[Configuration validation] Option 'continueOnFieldImportDefaultValueFailure' is not a valid boolean.`);
                return false;
            }
            if (configuration.options && configuration.options.skipImportFormContributions && (configuration.options.skipImportFormContributions !== true && configuration.options.skipImportFormContributions !== false)) {
                Logger_1.logger.logError(`[Configuration validation] Option 'skipImportFormContributions' is not a valid boolean.`);
                return false;
            }
        }
        if (configuration.options && configuration.options.logLevel && Interfaces_1.LogLevel[configuration.options.logLevel] === undefined) {
            Logger_1.logger.logError(`[Configuration validation] Option 'logLevel' is not a valid log level.`);
            return false;
        }
        return true;
    }
    static didUserCancel() {
        return Utility.isCancelled;
    }
    static createGuidWithoutHyphen() {
        return guid_typescript_1.Guid.create().toString().replace(Constants_1.regexRemoveHypen, "");
    }
}
exports.Utility = Utility;
Utility.isCancelled = false;
//# sourceMappingURL=Utilities.js.map
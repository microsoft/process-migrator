import * as WITInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import * as WITProcessDefinitionsInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import { KnownError } from "./Errors";
import { logger } from "./Logger";
import { Modes, IConfigurationFile, LogLevel, ICommandLineOptions } from "./Interfaces";
import * as url from "url";
import { Guid } from "guid-typescript";
import { regexRemoveHypen } from "./Constants";

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
            referenceName: Utility.createGuidWithoutHyphen() // Reference name does not really matter since we already have typeId
        };
        return createModel;
    }

    /**Convert group from getLayout group interface to WITProcessDefinitionsInterfaces.Group
     * @param group
    */
    public static toCreateGroup(group: WITProcessDefinitionsInterfaces.Group): WITProcessDefinitionsInterfaces.Group {
        let createGroup: WITProcessDefinitionsInterfaces.Group = {
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
        }
        return createGroup;
    }

    /**Convert control from getLayout control interface to WITProcessDefinitionsInterfaces.Control
     * @param control
    */
    public static toCreateControl(control: WITProcessDefinitionsInterfaces.Control): WITProcessDefinitionsInterfaces.Control {
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
            contribution: control.contribution,
            height: control.height,
            order: null,
            overridden: null
        }
        return createControl;
    }

    /**Convert page from getLayout page interface to WITProcessDefinitionsInterfaces.Page
      * @param control
     */
    public static toCreatePage(page: WITProcessDefinitionsInterfaces.Page): WITProcessDefinitionsInterfaces.Page {
        let createPage: WITProcessDefinitionsInterfaces.Page = {
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
        }
        return createPage;
    }

    /**Convert a state result to state input
    * @param group
    */
    public static toCreateOrUpdateStateDefinition(state: WITProcessInterfaces.WorkItemStateResultModel): WITProcessDefinitionsInterfaces.WorkItemStateInputModel {
        const updateState: WITProcessDefinitionsInterfaces.WorkItemStateInputModel = {
            color: state.color,
            name: state.name,
            stateCategory: state.stateCategory,
            order: null
        }
        return updateState;
    }

    public static toCreateBehavior(behavior: WITProcessInterfaces.WorkItemBehavior): WITProcessDefinitionsInterfaces.BehaviorCreateModel {
        const createBehavior: WITProcessDefinitionsInterfaces.BehaviorCreateModel = {
            color: behavior.color,
            inherits: behavior.inherits.id,
            name: behavior.name
        };
        // TODO: Move post S135 when generated model has id. 
        (<any>createBehavior).id = behavior.id;
        return createBehavior;
    }

    public static toReplaceBehavior(behavior: WITProcessInterfaces.WorkItemBehavior): WITProcessDefinitionsInterfaces.BehaviorReplaceModel {
        const replaceBehavior: WITProcessDefinitionsInterfaces.BehaviorReplaceModel = {
            color: behavior.color,
            name: behavior.name
        }
        return replaceBehavior;
    }

    public static handleKnownError(error: any) {
        if (error instanceof KnownError) { throw error; }
        logger.logException(error);
    }

    public static async tryCatchWithKnownError<T>(action: () => Promise<T> | T, thrower: () => Error): Promise<T> {
        try {
            return await action();
        }
        catch (error) {
            Utility.handleKnownError(error);
            throw thrower();
        }
    }

    public static validateConfiguration(configuration: IConfigurationFile, mode: Modes): boolean {
        if (mode === Modes.export || mode === Modes.migrate) {
            if (!configuration.sourceAccountUrl || !url.parse(configuration.sourceAccountUrl).host) {
                logger.logError(`[Configuration validation] Missing or invalid source account url: '${configuration.sourceAccountUrl}'.`);
                return false;
            }
            if (!configuration.sourceAccountToken) {
                logger.logError(`[Configuration validation] Missing personal access token for source account.`);
                return false;
            }
            if (!configuration.sourceProcessName) {
                logger.logError(`[Configuration validation] Missing source process name.`);
                return false;
            }
        }

        if (mode === Modes.import || mode === Modes.migrate) {
            if (!configuration.targetAccountUrl || !url.parse(configuration.targetAccountUrl).host) {
                logger.logError(`[Configuration validation] Missing or invalid target account url: '${configuration.targetAccountUrl}'.`);
                return false;
            }
            if (!configuration.targetAccountToken) {
                logger.logError(`[Configuration validation] Missing personal access token for target account.`);
                return false;
            }
            if (configuration.options && configuration.options.overwritePicklist && (configuration.options.overwritePicklist !== true && configuration.options.overwritePicklist !== false)) {
                logger.logError(`[Configuration validation] Option 'overwritePicklist' is not a valid boolean.`);
                return false;
            }
            if (configuration.options && configuration.options.continueOnRuleImportFailure && (configuration.options.continueOnRuleImportFailure !== true && configuration.options.continueOnRuleImportFailure !== false)) {
                logger.logError(`[Configuration validation] Option 'continueOnRuleImportFailure' is not a valid boolean.`);
                return false;
            }
            if (configuration.options && configuration.options.continueOnIdentityDefaultValueFailure && (configuration.options.continueOnIdentityDefaultValueFailure !== true && configuration.options.continueOnIdentityDefaultValueFailure !== false)) {
                logger.logError(`[Configuration validation] Option 'continueOnFieldImportDefaultValueFailure' is not a valid boolean.`);
                return false;
            }
            if (configuration.options && configuration.options.skipImportFormContributions && (configuration.options.skipImportFormContributions !== true && configuration.options.skipImportFormContributions !== false)) {
                logger.logError(`[Configuration validation] Option 'skipImportFormContributions' is not a valid boolean.`);
                return false;
            }
        }

        if (configuration.options && configuration.options.logLevel && LogLevel[configuration.options.logLevel] === undefined) {
            logger.logError(`[Configuration validation] Option 'logLevel' is not a valid log level.`);
            return false;
        }

        return true;
    }

    public static didUserCancel(): boolean {
        return Utility.isCancelled;
    }

    public static createGuidWithoutHyphen(): string {
        return Guid.create().toString().replace(regexRemoveHypen, "");
    }

    protected static isCancelled = false;
}

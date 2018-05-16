import { format } from "path";
import * as readline from "readline";
import { isFunction } from "util";
import * as vsts from "vso-node-api/WebApi";
import * as WITInterfaces from "vso-node-api/interfaces/WorkItemTrackingInterfaces";
import * as WITProcessDefinitionsInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import { defaultLogFileName } from "./Constants";
import { KnownError } from "./Errors";
import { IConfigurationOptions } from "./Interfaces";
import { logger } from "./Logger";

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

    /**Convert a state result to state input
    * @param state state result
    */
    public static toUdpateStateDefinition(state: WITProcessInterfaces.WorkItemStateResultModel): WITProcessDefinitionsInterfaces.WorkItemStateInputModel {
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
        return options.logFilename ? options.logFilename : defaultLogFileName;
    }

    public static getWebApi(accountUrl: string, PAT: string): vsts.WebApi {
        const authHandlerSRC = vsts.getPersonalAccessTokenHandler(PAT);
        return new vsts.WebApi(accountUrl, authHandlerSRC);
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

    private static _listener = (str: string, key: readline.Key) => {
        if (key.name.toLocaleLowerCase() === "q") {
            logger.logVerbose("Setting isCancelled to true.");
            Utility.isCancelled = true;
        }
    };

    private static isCancelled = false;
}

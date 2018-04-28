import * as WITProcessDefinitionsInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import * as WITInterfaces from "vso-node-api/interfaces/WorkItemTrackingInterfaces";

export enum LogLevel {
    Error,
    Warning,
    Information,
    Verbose
}

export interface IExportOptions {
    processID: string;
    writeToFile: boolean;
}

export interface IUserConfigurationOptions {
    sourceProcessName: string;
    targetProcessName?: string;
    outputPath?: string;
    logfileName?: string;
    writeToFile?: boolean;
    onlineReImport?: boolean;
    overwritePicklist?: boolean;
    logLevel?: LogLevel;
    __cleanupTargetAccount?: boolean; // TODO: For dev purpose 
    __cleanupTargetEverything?: boolean; // TODO: For dev purpose 
}

export interface IProcessPayload {
    process: WITProcessInterfaces.ProcessModel;
    workItemTypes: WITProcessDefinitionsInterfaces.WorkItemTypeModel[];
    fields: WITProcessInterfaces.FieldModel[];
    workItemTypeFields: IWITypeFields[];
    witFieldPicklists: IWITFieldPicklist[];
    layouts: IWITLayout[];
    behaviors: WITProcessDefinitionsInterfaces.BehaviorModel[];
    workItemTypeBehaviors: IWITBehaviors[];
    states: IWITStates[];
    rules: IWITRules[];

    // Only populated during import
    targetAccountInformation?: ITargetInformation
}

/**
 * For information populated from target account during import
 */
export interface ITargetInformation {
    collectionFields?: WITInterfaces.WorkItemField[];
    fieldRefNameToPicklistId?: IDictionaryStringTo<string>;
}

export interface IWITypeFields {
    workItemTypeRefName: string;
    fields: WITProcessDefinitionsInterfaces.WorkItemTypeFieldModel[];
}

export interface IWITLayout {
    workItemTypeRefName: string;
    layout: WITProcessDefinitionsInterfaces.FormLayout;
}

export interface IWITStates {
    workItemTypeRefName: string;
    states: WITProcessDefinitionsInterfaces.WorkItemStateResultModel[];
}

export interface IWITRules {
    workItemTypeRefName: string;
    rules: WITProcessInterfaces.FieldRuleModel[];
}

export interface IWITBehaviors {
    workItemType: IWITBehaviorsInfo;
    behaviors: WITProcessDefinitionsInterfaces.WorkItemTypeBehavior[];
}

export interface IWITBehaviorsInfo {
    refName: string;
    workItemTypeClass: WITProcessDefinitionsInterfaces.WorkItemTypeClass;
}

export interface IValidationStatus {
    status: boolean;
    message: string;
}

export interface IWITFieldPicklist {
    workitemtypeRefName: string;
    fieldRefName: string;
    picklist: WITProcessDefinitionsInterfaces.PickListModel;
}

export interface IDictionaryStringTo<T> {
    [key: string]: T;
}
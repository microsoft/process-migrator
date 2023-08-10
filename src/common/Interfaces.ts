import * as WITProcessDefinitionsInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import * as WITInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import { IWorkItemTrackingProcessDefinitionsApi as WITProcessDefinitionApi } from "azure-devops-node-api/WorkItemTrackingProcessDefinitionsApi";
import { IWorkItemTrackingProcessApi as WITProcessApi } from "azure-devops-node-api/WorkItemTrackingProcessApi";
import { IWorkItemTrackingApi as WITApi } from "azure-devops-node-api/WorkItemTrackingApi";

export enum LogLevel {
    error,
    warning,
    information,
    verbose
}

export enum Modes {
    import,
    export,
    migrate
}

export interface IExportOptions {
    processID: string;
}

export interface ICommandLineOptions {
    mode: Modes;
    overwriteProcessOnTarget: boolean;
    config: string;
    sourceToken?: string;
    targetToken?: string;
}

export interface IConfigurationFile {
    sourceProcessName?: string;
    targetProcessName?: string;
    sourceAccountUrl?: string;
    targetAccountUrl?: string;
    sourceAccountToken?: string;
    targetAccountToken?: string;
    options?: IConfigurationOptions;
}

export interface IConfigurationOptions {
    logLevel?: string;
    logFilename?: string;
    processFilename?: string;
    overwritePicklist?: boolean;
    continueOnRuleImportFailure?: boolean;
    continueOnIdentityDefaultValueFailure?: boolean;
    skipImportFormContributions?: boolean;
}

export interface IProcessPayload {
    process: WITProcessInterfaces.ProcessModel;
    workItemTypes: WITProcessDefinitionsInterfaces.WorkItemTypeModel[];
    fields: WITProcessInterfaces.FieldModel[];
    workItemTypeFields: IWITypeFields[];
    witFieldPicklists: IWITFieldPicklist[];
    layouts: IWITLayout[];
    behaviors: WITProcessInterfaces.WorkItemBehavior[];
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

export interface ILogger {
    logVerbose(message: string);
    logInfo(message: string);
    logWarning(message: string);
    logError(message: string);
    logException(error: Error);
}

export interface IRestClients {
    witApi: WITApi;
    witProcessApi: WITProcessApi;
    witProcessDefinitionApi: WITProcessDefinitionApi;
}
import * as assert from "assert";
import { format } from "path";
import { writeFileSync, readFileSync, appendFileSync, existsSync, unlinkSync } from "fs";
import { isFunction } from "util";
import * as vsts from "vso-node-api/WebApi";
import * as WITProcessDefinitionsInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import * as WITInterfaces from "vso-node-api/interfaces/WorkItemTrackingInterfaces";
import { IWorkItemTrackingProcessDefinitionsApi as WITProcessDefinitionApi } from "vso-node-api/WorkItemTrackingProcessDefinitionsApi";
import { IWorkItemTrackingProcessApi as WITProcessApi } from "vso-node-api/WorkItemTrackingProcessApi";
import { IWorkItemTrackingApi as WITApi } from "vso-node-api/WorkItemTrackingApi";
import { ImportError, ExportError, ValidationError, CancellationError } from "./Errors";
import { PICKLIST_NO_ACTION, defaultConfiguration, configurationFilename, defaultEncoding, defaultLogFileName } from "./Constants";
import { IExportOptions, IUserConfigurationOptions, IProcessPayload, IDictionaryStringTo, IWITLayout, IWITRules, IWITBehaviors, IWITFieldPicklist, IWITStates, IWITypeFields, IWITBehaviorsInfo, LogLevel } from "./Interfaces";
import * as url from "url";
import * as readline from "readline";

export class Logger {
    constructor(private _logFilename: string, private _logLevel: LogLevel) {
        if (existsSync(_logFilename)) {
            unlinkSync(_logFilename);
        }
    }

    public logVerbose(message: string) {
        this._log(message, LogLevel.Verbose);
    }

    public logInfo(message: string) {
        this._log(message, LogLevel.Information);
    }

    public logWarning(message: string) {
        this._log(message, LogLevel.Warning);
    }

    public logError(message: string) {
        //TODO: make stack trace more readable (map back to .ts functions?)
        const stack = new Error().stack;
        if (stack)
            message += stack;

        this._log(message, LogLevel.Error);
    }

    public logException(error: Error) {
        if (error instanceof Error) {
            this._log(`Exception message:${error.message}\r\nCall stack:${error.stack}`, LogLevel.Verbose);
        } 
        else {
            this._log(`Unknown exception: ${JSON.stringify(error)}`, LogLevel.Verbose);
        }
    }

    private _log(message: string, logLevel: LogLevel) {
        const outputMessage: string = `[${LogLevel[logLevel]}] [${(new Date(Date.now())).toISOString()}] ${message}`;
        if (logLevel <= this._logLevel) {
            console.log(outputMessage);
        }

        //TODO: revisit the perf here - this isn't very nice but should work at the size of the application
        appendFileSync(this._logFilename, outputMessage);
    }
}
let logger: Logger;

export class Engine {
    constructor(private options: IUserConfigurationOptions) {
    }

    private async writeToLog(message: string) {
        //TODO: This is super tricky - let's replace with a meaningful name from caller. 
        let logString: string = 'Executing ' + message.replace("function () { return _this.", "").replace("; }", "");
        logger.logInfo(logString);
    }

    public async Task<T>(step: () => Promise<T>): Promise<T> {
        if (Utility.didUserCancel()) {
            throw new CancellationError();
        }
        this.writeToLog(step.toString());
        return step();
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
            default: { throw new Error("Failed to convert from WorkItemTrackingProcess FieldType to WorkItemTracking FieldType. Input WorkItemTrackingProcess FieldType not declared as enum.") }
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

    public static getLogFilePath(options: IUserConfigurationOptions): string {
        const logFilename = format({
            root: options.outputPath ? options.outputPath : ".",
            base: options.logfileName ? options.logfileName : defaultLogFileName
        })
        return logFilename;
    }

    public static getWebApi(accountUrl: string, PAT: string): vsts.WebApi {
        const authHandlerSRC = vsts.getPersonalAccessTokenHandler(PAT);
        return new vsts.WebApi(accountUrl, authHandlerSRC);
    }

    public static validateConfiguration(configuration: any): boolean {
        if (!configuration.sourceAccountUrl || !url.parse(configuration.sourceAccountUrl).host) {
            console.log(`[Configuration validation] Missing or invalid source account url: '${configuration.sourceAccountUrl}'.`);
            return false;
        }
        if (!configuration.targetAccountUrl || !url.parse(configuration.targetAccountUrl).host) {
            console.log(`vMissing or invalid target account url: '${configuration.targetAccountUrl}'.`);
            return false;
        }
        if (!configuration.sourceAccountToken) {
            console.log(`[Configuration validation] Personal access token for source account is empty`);
            return false;
        }
        if (!configuration.targetAccountToken) {
            console.log(`[Configuration validation] Personal access token for target account is empty`);
            return false;
        }
        if (!configuration.options || !configuration.options.sourceProcessName) {
            console.log(`[Configuration validation] Missing source process name`);
            return false;
        }
        if (configuration.options && configuration.options.writeToFile && (configuration.options.writeToFile !== true && configuration.options.writeToFile !== false)) {
            console.log(`[Configuration validation] Option 'writeToFile' is not a valid boolean`);
            return false;
        }
        if (configuration.options && configuration.options.onlineReImport && (configuration.options.onlineReImport !== true && configuration.options.onlineReImport !== false)) {
            console.log(`[Configuration validation] Option 'onlineReImport' is not a valid boolean`);
            return false;
        }
        return true;
    }

    /**
    * Returns a GUID such as xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx.
    * @return New GUID.(UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
    * @notes Code is copied from VSTS guid generator
    * @notes Disclaimer: This implementation uses non-cryptographic random number generator so absolute uniqueness is not guarantee.
    */
   public static newGuid(): string {
       // c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
       // "Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively"
       var clockSequenceHi = (128 + Math.floor(Math.random() * 64)).toString(16);
       return this.oct(8) + "-" + this.oct(4) + "-4" + this.oct(3) + "-" + clockSequenceHi + this.oct(2) + "-" + this.oct(12);
   }

    /**
     * Generated non-zero octet sequences for use with GUID generation.
     *
     * @param length Length required.
     * @return Non-Zero hex sequences.
     */
    private static oct(length?: number): string {
        if (!length) {
            return (Math.floor(Math.random() * 0x10)).toString(16);
        }

        var result: string = "";
        for (var i: number = 0; i < length; i++) {
            result += Utility.oct();
        }

        return result;
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
    private engine: Engine;

    constructor(vstsWebApi: vsts.WebApi, private configurationOptions?: IUserConfigurationOptions) {
        this.vstsWebApi = vstsWebApi;
        this.engine = new Engine(configurationOptions);
    }

    public async getApis() {
        this.witApi = await this.vstsWebApi.getWorkItemTrackingApi();
        this.witProcessApi = await this.vstsWebApi.getWorkItemTrackingProcessApi();
        this.witProcessDefinitionApi = await this.vstsWebApi.getWorkItemTrackingProcessDefinitionApi();
    }

    /**Reads-in a previously stored JSON containing an IProcessPayload*/
    public async uploadProcessPayload(pathToFile: string): Promise<IProcessPayload> {
        const processPayload = JSON.parse(await readFileSync(pathToFile, defaultEncoding));
        return processPayload;
    }

    private async importWorkItemTypes(payload: IProcessPayload): Promise<void> {
        try {
            for (const wit of payload.workItemTypes) {
                if (wit.class === WITProcessInterfaces.WorkItemTypeClass.System) {
                    //The exported payload should not have exported System WITypes, so fail on import.
                    throw new ImportError(`Work Item Type '${wit.name}' is a System work item type with no modifications, cannot import.`);
                }
                else {
                    await this.witProcessDefinitionApi.createWorkItemType(wit, payload.process.typeId);
                }
            }
        }
        catch (error) {
            if (!(error instanceof ImportError)) {
                logger.logError(`Error creating the Work Item Type on target account. ${error}`);
            }
            throw error;
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
        }
        catch (error) {
            logger.logError("Error with getting fields from target. Possible auth. issue on target account.");
            throw error;
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
                    //createField.type = Utility.ConvertToPicklistType(createField.type);
                }
                outputFields.push(createField);
            }
        }
        return outputFields;
    }

    /**Create fields at a collection scope*/
    private async importFields(payload: IProcessPayload): Promise<void> {
        try {
            const fieldsToCreate: WITProcessDefinitionsInterfaces.FieldModel[] = await this.engine.Task(() => this.getFieldsToCreate(payload));
            if (fieldsToCreate.length > 0) {
                const createFieldPromises: Promise<any>[] = [];
                for (let field of fieldsToCreate) {
                    field && createFieldPromises.push(this.witProcessDefinitionApi.createField(field, payload.process.typeId).then(fieldCreated => {
                        if (!fieldCreated) {
                            throw new ImportError(`Create field '${field.name}' failed, server returned null object`);
                        }
                        if (fieldCreated.id !== field.id) {
                            throw new ImportError(`Create field '${field.name}' actually returned referenace name '${fieldCreated.id}' instead of anticipated '${field.id}', are you on latest VSTS?`);
                        }
                    }, (err) => {
                        throw new ImportError(`Create field '${field.name}' failed, server error message:'${err.message}'`);
                    }));
                }
                logger.logInfo(`Attempting creating fields: ${fieldsToCreate.map(f => f.name).join(",")}`);
                await Promise.all(createFieldPromises);
            }
        }
        catch (error) {
            throw new ImportError(`[Unexpected] Field import failure. ${error}`);
        }
    }

    /**Create fields at a Work Item Type scope*/
    private async addFieldsToWorkItemTypes(payload: IProcessPayload): Promise<void> {

        let addFieldPromises: Promise<WITProcessDefinitionsInterfaces.WorkItemTypeFieldModel>[] = [];
        for (let IWorkItemTypeFields of payload.workItemTypeFields) {
            for (let field of IWorkItemTypeFields.fields) {
                try {
                    await this.witProcessDefinitionApi.addFieldToWorkItemType(field, payload.process.typeId, IWorkItemTypeFields.workItemTypeRefName);
                }
                catch (error) {
                    console.log(`Unable to add ${field.name} field to ${IWorkItemTypeFields.workItemTypeRefName} WIT: ${error}`);
                    throw new ImportError(`Unable to add ${field.name} field to ${IWorkItemTypeFields.workItemTypeRefName} WIT: ${error}`);
                }
            }
        }
    }

    private async importLayouts(payload: IProcessPayload): Promise<void> {
        /** Notes:
         * HTML controls need to be created at the same tme as the group they are in.
         * Non HTML controls need to be added 1 by 1 after the group they are in has been created.
         */
        for (const witLayout of payload.layouts) {
            for (const page of witLayout.layout.pages) {
                let newPage: WITProcessDefinitionsInterfaces.Page;//The newly created page, contains the pageId required to create groups.
                const targetLayout: WITProcessDefinitionsInterfaces.FormLayout = await this.witProcessDefinitionApi.getFormLayout(payload.process.typeId, witLayout.workItemTypeRefName);
                const sourcePagesOnTarget: WITProcessDefinitionsInterfaces.Page[] = targetLayout.pages.filter(p => p.id === page.id);
                if (!page) {
                    throw new ImportError("NULL page.");
                }
                const createPage: WITProcessDefinitionsInterfaces.Page = Utility.toCreatePage(page);
                if (sourcePagesOnTarget.length === 0) {//Page is new
                    try {
                        newPage = await this.witProcessDefinitionApi.addPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName);
                        page.id = newPage.id;
                    }
                    catch (error) {
                        throw new ImportError(`Unable to add '${page}' page to ${witLayout.workItemTypeRefName}. ${error}`);
                    }
                }
                else {//Update page, it already exists on target
                    try {
                        newPage = await this.witProcessDefinitionApi.editPage(createPage, payload.process.typeId, witLayout.workItemTypeRefName);
                        page.id = newPage.id;
                    }
                    catch (error) {
                        throw new ImportError(`Unable to add '${page}' page to ${witLayout.workItemTypeRefName}. ${error}`);
                    }
                }
                for (const section of page.sections) {
                    for (const group of section.groups) {
                        let newGroup: WITProcessDefinitionsInterfaces.Group;

                        if (group.controls.length !== 0 && group.controls[0].controlType === "HtmlFieldControl") {
                            //Handle groups with HTML Controls
                            try {
                                let createGroup: WITProcessDefinitionsInterfaces.Group = Utility.toCreateGroup(group);

                                if (group.inherited) {
                                    if (group.overridden) {
                                        //edit
                                        newGroup = await this.witProcessDefinitionApi.editGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id, group.id);

                                        const htmlControl = group.controls[0];
                                        if (htmlControl.overridden) {
                                            // If the HTML control is overriden, we must update that as well 
                                            await this.witProcessDefinitionApi.editControl(htmlControl, payload.process.typeId, witLayout.workItemTypeRefName, newGroup.id, htmlControl.id);
                                        }
                                    }
                                    else {
                                        // no-op since the group is not overriden
                                    }
                                }
                                else {
                                    // special handling for HTML control - we must create a group containing the HTML control at same time.
                                    createGroup.controls = group.controls;
                                    newGroup = await this.witProcessDefinitionApi.addGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id);
                                }
                            }
                            catch (error) {
                                throw new ImportError(`Unable to add ${group} HTML group to ${witLayout.workItemTypeRefName}. ${error}`);
                            }
                        }
                        else {
                            //Groups with no HTML Controls
                            try {
                                let createGroup: WITProcessDefinitionsInterfaces.Group = Utility.toCreateGroup(group);

                                if (group.inherited) {
                                    if (group.overridden) {
                                        //edit
                                        newGroup = await this.witProcessDefinitionApi.editGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id, group.id);
                                        group.id = newGroup.id;
                                    }
                                }
                                else {
                                    //create
                                    newGroup = await this.witProcessDefinitionApi.addGroup(createGroup, payload.process.typeId, witLayout.workItemTypeRefName, page.id, section.id);
                                    group.id = newGroup.id;
                                }
                            }
                            catch (error) {
                                throw new ImportError(`Unable to add ${group} group to ${witLayout.workItemTypeRefName}. ${error}`);
                            }

                            for (let control of group.controls) {
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
                                        throw new ImportError(`Unable to add '${control}' control to page '${page}' in '${witLayout.workItemTypeRefName}'. ${error}`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private async importStates(payload: IProcessPayload): Promise<void> {
        for (let sourceWITState of payload.states) {
            let targetWITStates: WITProcessDefinitionsInterfaces.WorkItemStateResultModel[] = await this.witProcessApi.getStateDefinitions(payload.process.typeId, sourceWITState.workItemTypeRefName);
            for (let sourceState of sourceWITState.states) {
                try {
                    const existingStates: WITProcessDefinitionsInterfaces.WorkItemStateResultModel[] = targetWITStates.filter(targetState => sourceState.name === targetState.name);
                    if (existingStates.length === 0) {  //does not exist on target
                        await this.witProcessDefinitionApi.createStateDefinition(sourceState, payload.process.typeId, sourceWITState.workItemTypeRefName);
                    }
                    else {
                        if (sourceState.hidden) { // if state exists on target, only update if hidden 
                            await this.witProcessDefinitionApi.hideStateDefinition({ hidden: true }, payload.process.typeId, sourceWITState.workItemTypeRefName, existingStates[0].id);
                        }
                    }
                }
                catch (error) {
                    throw new ImportError(`Unable to create '${sourceState}' state in '${sourceWITState.workItemTypeRefName}' WIT: ${error}`);
                }
            }
        }
    }

    private async importRules(payload: IProcessPayload): Promise<void> {
        for (const WITRule of payload.rules) {
            for (const rule of WITRule.rules) {
                try {
                    if (!rule.isSystem) {
                        await this.witProcessApi.addWorkItemTypeRule(rule, payload.process.typeId, WITRule.workItemTypeRefName);
                    }
                }
                catch (error) {
                    throw new ImportError(`Unable to create '${rule}' rule in '${WITRule}' work item type: ${error}`);
                }
            }
        }
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
        const processedFieldRefNames:IDictionaryStringTo<boolean> = {};
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
                picklistEntry.picklist.name = `picklist_${Utility.newGuid()}`; // Avoid conflict on target
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
        await this.engine.Task(() => this.importPicklists(payload)); // This must be before field import
        await this.engine.Task(() => this.importFields(payload));
        await this.engine.Task(() => this.importWorkItemTypes(payload));
        await this.engine.Task(() => this.addFieldsToWorkItemTypes(payload));
        await this.engine.Task(() => this.importLayouts(payload));
        await this.engine.Task(() => this.importStates(payload));
        await this.engine.Task(() => this.importRules(payload));
        await this.engine.Task(() => this.importBehaviors(payload));
        await this.engine.Task(() => this.addBehaviorsToWorkItemTypes(payload));
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
            throw new ImportError("Failed to get fields on target account.")
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
                    if (!this.configurationOptions.overwritePicklist) {
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

    private async validateLayouts(payload: IProcessPayload): Promise<void> {
        //TODO: Add validation in future
    }

    private async validateBehaviors(payload: IProcessPayload): Promise<void> {
        // No validation for behaviors for now
    }

    private async preImportValidation(payload: IProcessPayload): Promise<void> {
        payload.targetAccountInformation = {
            fieldRefNameToPicklistId: {}
        }; // set initial value for target account information

        const promises: Promise<void>[] = [];
        try {
            await this.engine.Task(() => this.validateProcess(payload));
            await this.engine.Task(() => this.validateFields(payload));
            await this.engine.Task(() => this.validatePicklists(payload));
            // Validation above must execute sequentially before the others
            promises.push(this.engine.Task(() => this.validateLayouts(payload)));
            promises.push(this.engine.Task(() => this.validateBehaviors(payload)));
            await Promise.all(promises);
        }
        catch (error) {
            if (error instanceof ValidationError) throw error;
            throw (`Pre-import validation has failed: ${error}`);
        }
    }

    //MAIN IMPORT
    public async importProcess(processPayload: IProcessPayload): Promise<void> {
        /* NOTE: for offline re-import, must upload process payload:
            let processPayload: IProcessPayload = await importer.uploadProcessPayload("./process/processPayload.json");
            await importer.importProcess(processPayload);
        */
        await this.getApis();
        try {
            if (this.configurationOptions.targetProcessName) {
                //TODO: validate process name here right away
                processPayload.process.name = this.configurationOptions.targetProcessName;
            }
            await this.engine.Task(() => this.preImportValidation(processPayload));

            const createProcessModel: WITProcessInterfaces.CreateProcessModel = Utility.ProcessModelToCreateProcessModel(processPayload.process);
            const pm = await this.witProcessApi.createProcess(createProcessModel);
            processPayload.process.typeId = pm.typeId;
            await this.engine.Task(() => this.createComponents(processPayload));
        }
        catch (error) {
            if (error instanceof ValidationError) {
                logger.logError("Pre-Import validation failed. No artifacts were copied to the target account.")
            }
            throw error
        }
    }
}

export class ProcessExporter {
    private vstsWebApi: vsts.WebApi;
    private witProcessApi: WITProcessApi;
    private witProcessDefinitionApi: WITProcessDefinitionApi;
    private witApi: WITApi;
    private engine: Engine;

    constructor(vstsWebApi: vsts.WebApi, private configurationOptions: IUserConfigurationOptions) {
        this.vstsWebApi = vstsWebApi;
        this.engine = new Engine(configurationOptions);
    }

    public async getApis() {
        this.witApi = await this.vstsWebApi.getWorkItemTrackingApi();
        this.witProcessApi = await this.vstsWebApi.getWorkItemTrackingProcessApi();
        this.witProcessDefinitionApi = await this.vstsWebApi.getWorkItemTrackingProcessDefinitionApi();
    }

    private async getOptions(): Promise<IExportOptions> {
        let processes: WITProcessInterfaces.ProcessModel[];
        try {
            processes = await this.witProcessApi.getProcesses();
        }
        catch (error) {
            logger.logException(error);
            throw new ExportError("Error getting processes on source account - check account url, token and token permission"); //TODO: we need have scope for wit process/processdefinitinos API then
        }
        if (!processes) { // most likely 404
            throw new ExportError("Failed to get processes on source account, check account url");
        }

        const lowerCaseSourceProcessName = this.configurationOptions.sourceProcessName.toLocaleLowerCase();
        const matchProcesses = processes.filter(p => p.name.toLocaleLowerCase() === lowerCaseSourceProcessName);
        if (matchProcesses.length === 0) {
            throw new ExportError(`Process '${this.configurationOptions.sourceProcessName}' is not found on source account`);
        }
        const options: IExportOptions = { processID: matchProcesses[0].typeId, writeToFile: this.configurationOptions.writeToFile }
        return options;
    }

    private async getComponents(options: IExportOptions): Promise<IProcessPayload> {
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

        processPromises.push(this.witProcessApi.getProcessById(options.processID).then(process => _process = process));
        processPromises.push(this.witProcessApi.getFields(options.processID).then(fields => _fieldsCollectionScope = fields));
        processPromises.push(this.witProcessDefinitionApi.getBehaviors(options.processID).then(behaviors => _behaviorsCollectionScope = behaviors));
        processPromises.push(this.witProcessApi.getWorkItemTypes(options.processID).then(workitemtypes => {
            const perWitPromises: Promise<any>[] = [];

            for (const workitemtype of workitemtypes) {
                const currentWitPromises: Promise<any>[] = [];

                currentWitPromises.push(this.witProcessDefinitionApi.getBehaviorsForWorkItemType(options.processID, workitemtype.id).then(behaviors => {
                    const witBehaviorsInfo: IWITBehaviorsInfo = { refName: workitemtype.id, workItemTypeClass: workitemtype.class };
                    const witBehaviors: IWITBehaviors = {
                        workItemType: witBehaviorsInfo,
                        behaviors: behaviors
                    }
                    _behaviorsWITypeScope.push(witBehaviors);
                }));
                perWitPromises.push(Promise.all(currentWitPromises));

                if (workitemtype.class !== WITProcessInterfaces.WorkItemTypeClass.System) {
                    _nonSystemWorkItemTypes.push(workitemtype);

                    currentWitPromises.push(this.witProcessDefinitionApi.getWorkItemTypeFields(options.processID, workitemtype.id).then(fields => {
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
                    currentWitPromises.push(this.witProcessDefinitionApi.getFormLayout(options.processID, workitemtype.id).then(layout => {
                        const witLayout: IWITLayout = {
                            workItemTypeRefName: workitemtype.id,
                            layout: layout
                        }
                        _layouts.push(witLayout);
                    }));

                    currentWitPromises.push(this.witProcessDefinitionApi.getStateDefinitions(options.processID, workitemtype.id).then(states => {
                        const witStates: IWITStates = {
                            workItemTypeRefName: workitemtype.id,
                            states: states
                        }
                        _states.push(witStates);
                    }));

                    currentWitPromises.push(this.witProcessApi.getWorkItemTypeRules(options.processID, workitemtype.id).then(rules => {
                        const witRules: IWITRules = {
                            workItemTypeRefName: workitemtype.id,
                            rules: rules
                        }
                        _rules.push(witRules);
                    }));
                }
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
        logger.logInfo("Export process started");
        try {
            await this.getApis();
        }
        catch (error) {
            logger.logException(error);
            throw new ExportError("Failed to connect to source account - check url and token");
        }

        let processPayload: IProcessPayload;
        const options: IExportOptions = await this.engine.Task(() => this.getOptions());
        processPayload = await this.engine.Task(() => this.getComponents(options));

        if (options.writeToFile) {
            logger.logVerbose("Writing file: started");
            //TODO: flexible output file name
            await writeFileSync("./processPayload.json", JSON.stringify(processPayload, null, 2), { flag: "w" });
            logger.logVerbose("Writing file: finished");

        }
        logger.logInfo("Export Process done.");
        return processPayload;
    }
}

async function main() {

    //Load configuration file
    if (!existsSync(configurationFilename)) {
        console.log(`Cannot find configuration file '${configurationFilename}', we have generated the default configuration and please fill in required information before retry.`);
        writeFileSync(configurationFilename, JSON.stringify(defaultConfiguration, null, 2));
        process.exit(1);
    }

    //TODO: Native node.js does not support encoding auto detection, there is 3rd party library to do so, wait for feedback 
    const configuration = JSON.parse(await readFileSync(configurationFilename, defaultEncoding));
    if (!Utility.validateConfiguration(configuration)) {
        process.exit(1);
    }

    // Initialize logger
    logger = new Logger(Utility.getLogFilePath(configuration.options), configuration.options.logLevel ? configuration.options.logLevel : LogLevel.Information);

    // Read configuration and get webApis
    const sourceWebApi = Utility.getWebApi(configuration.sourceAccountUrl, configuration.sourceAccountToken);
    const targetWebApi = Utility.getWebApi(configuration.targetAccountUrl, configuration.targetAccountToken);
    const userOptions = configuration.options as IUserConfigurationOptions;
    try {
        //TODO: Remove or formalize this - dev only for now
        if (userOptions.__cleanupTargetAccount) {
            await deleteProcessOnTarget(targetWebApi.getWorkItemTrackingProcessApi(), configuration.options.sourceProcessName);
        }

        const exporter: ProcessExporter = new ProcessExporter(sourceWebApi, configuration.options);
        const processPayload: IProcessPayload = await exporter.exportProcess();

        if (userOptions.onlineReImport) {
            const importer: ProcessImporter = new ProcessImporter(targetWebApi, configuration.options);
            await importer.importProcess(processPayload);
            logger.logInfo("Import process has successfully completed.");
        }
    }
    catch (error) {
        logger.logException(error);
        if (error instanceof ExportError) {
            logger.logError(`Export process failed: ${error}`);
        } else if (error instanceof ImportError) {
            logger.logError(`Import process failed: ${error}`);
        } else if (error instanceof ValidationError) {
            logger.logError(`Pre-Import validation failed. ${error}`);
        } else if (error instanceof CancellationError) {
            logger.logError(`User cancelled the operation.`);
        } else {
            logger.logError(`Hit unknown error, check log for details`)
        }
        process.exit(1);
    }
    process.exit(0);
}

main();

//TODO: Clean up
async function deleteProcessOnTarget(wpTgtPromise: Promise<WITProcessApi>, processName: string) {
    const wpTgt = await wpTgtPromise;
    const processes = await wpTgt.getProcesses();
    processes
        .filter(p => p.name.toLocaleLowerCase() === processName.toLocaleLowerCase())
        .map(async p => {
            await wpTgt.deleteProcess(p.typeId);
            logger.logInfo(`${processName} has been deleted`);
        });
}
import * as WITInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import * as WITProcessDefinitionsInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import { KnownError } from "./Errors";
import { logger } from "./Logger";
import { Modes, IConfigurationFile, LogLevel, ICommandLineOptions } from "./Interfaces";
import { Guid } from "guid-typescript";
import { regexRemoveHypen } from "./Constants";

export class Utility {
    /**
     * Convert WITProcess FieldModel to WITProcessDefinitions FieldModel
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

    /**
     * Convert WIT WorkItemField to WITProcessDefinitions FieldModel
     */
    public static WITToWITProcessDefinitionsFieldModel(workItemField: WITInterfaces.WorkItemField): WITProcessDefinitionsInterfaces.FieldModel {

        let outField: WITProcessDefinitionsInterfaces.FieldModel = {
            description: workItemField.description,
            id: workItemField.referenceName,
            name: workItemField.name,
            type: Utility.WITToWITProcessDefinitionsFieldType(workItemField.type, workItemField.isIdentity),
            url: workItemField.url,
            pickList: null
        }
        return outField;
    }

    /**
     * Convert WorkItemTracking FieldType to WorkItemTrackingProcessDefinitions FieldType
     */
    public static WITToWITProcessDefinitionsFieldType(witFieldType: WITInterfaces.FieldType, fieldIsIdentity: boolean): WITProcessDefinitionsInterfaces.FieldType {
        if (fieldIsIdentity) { return WITProcessDefinitionsInterfaces.FieldType.Identity; }

        switch (witFieldType) {
            case WITInterfaces.FieldType.String: { return WITProcessDefinitionsInterfaces.FieldType.String; }
            case WITInterfaces.FieldType.Integer: { return WITProcessDefinitionsInterfaces.FieldType.Integer; }
            case WITInterfaces.FieldType.DateTime: { return WITProcessDefinitionsInterfaces.FieldType.DateTime; }
            case WITInterfaces.FieldType.PlainText: { return WITProcessDefinitionsInterfaces.FieldType.PlainText; }
            case WITInterfaces.FieldType.Html: { return WITProcessDefinitionsInterfaces.FieldType.Html; }
            case WITInterfaces.FieldType.TreePath: { return WITProcessDefinitionsInterfaces.FieldType.TreePath; }
            case WITInterfaces.FieldType.History: { return WITProcessDefinitionsInterfaces.FieldType.History; }
            case WITInterfaces.FieldType.Double: { return WITProcessDefinitionsInterfaces.FieldType.Double; }
            case WITInterfaces.FieldType.Guid: { return WITProcessDefinitionsInterfaces.FieldType.Guid; }
            case WITInterfaces.FieldType.Boolean: { return WITProcessDefinitionsInterfaces.FieldType.Boolean; }
            case WITInterfaces.FieldType.Identity: { return WITProcessDefinitionsInterfaces.FieldType.Identity; }
            case WITInterfaces.FieldType.PicklistInteger: { return WITProcessDefinitionsInterfaces.FieldType.PicklistInteger; }
            case WITInterfaces.FieldType.PicklistString: { return WITProcessDefinitionsInterfaces.FieldType.PicklistString; }
            case WITInterfaces.FieldType.PicklistDouble: { return WITProcessDefinitionsInterfaces.FieldType.PicklistDouble; }
            default: { throw new Error(`Failed to convert from WorkItemTracking.FieldType to WorkItemTrackingProcessDefinitions.FieldType, unrecognized enum value '${witFieldType}'`) }
        }
    }

    /**
     * Convert WorkItemTrackingProcess FieldType to WorkItemTracking FieldType
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

    /**
     * Convert ProcessModel to CreateProcessModel
     */
    public static ProcessModelToCreateProcessModel(processModel: WITProcessInterfaces.ProcessModel): WITProcessInterfaces.CreateProcessModel {
        // Try to get parentProcessTypeId from different possible locations due to API changes
        let parentProcessTypeId: string | undefined;
        
        if (processModel.properties && processModel.properties.parentProcessTypeId) {
            parentProcessTypeId = processModel.properties.parentProcessTypeId;
        } else if ((processModel as any).parentProcessTypeId) {
            parentProcessTypeId = (processModel as any).parentProcessTypeId;
        } else if ((processModel as any).parentTypeId) {
            parentProcessTypeId = (processModel as any).parentTypeId;
        }
        
        if (!parentProcessTypeId) {
            throw new Error(`Unable to determine parent process type ID for process '${processModel.name}'. This may be due to Azure DevOps API changes.`);
        }

        const createModel: WITProcessInterfaces.CreateProcessModel = {
            description: processModel.description,
            name: processModel.name,
            parentProcessTypeId: parentProcessTypeId,
            referenceName: Utility.createGuidWithoutHyphen() // Reference name does not really matter since we already have typeId
        };
        return createModel;
    }

    /**
     * Convert layout group to WITProcessDefinitions Group
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

    /**
     * Convert layout control to WITProcessDefinitions Control
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

    /**
     * Convert layout page to WITProcessDefinitions Page
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

    /**
     * Convert state result model to state input model
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

    /**
     * Convert WorkItemBehavior to BehaviorCreateModel with Azure DevOps API compatibility fixes
     */
    public static toCreateBehavior(behavior: WITProcessInterfaces.WorkItemBehavior): WITProcessDefinitionsInterfaces.BehaviorCreateModel {
        // Extract parent behavior ID from various API property structures
        let inheritsId: string | undefined;
        
        if (behavior.inherits && behavior.inherits.id) {
            inheritsId = behavior.inherits.id;
        } else if (behavior.inherits && (behavior.inherits as any).behaviorRefName) {
            // New API structure: inherits.behaviorRefName
            inheritsId = (behavior.inherits as any).behaviorRefName;
        } else if ((behavior as any).inheritsId) {
            inheritsId = (behavior as any).inheritsId;
        } else if ((behavior as any).parentId) {
            inheritsId = (behavior as any).parentId;
        }
        
        // Apply behavior-specific parent overrides for API validation
        const behaviorRefName = (behavior as any).referenceName || '';
        
        // Force correct parent for known problematic behaviors
        if (behaviorRefName === 'System.RequirementBacklogBehavior') {
            inheritsId = 'System.PortfolioBacklogBehavior';
        }
        
        // Determine parent behavior when not explicitly set
        if (!inheritsId) {
            const behaviorName = behavior.name ? behavior.name.toLowerCase() : '';
            const behaviorRefName = (behavior as any).referenceName || '';
            
            // Requirement behaviors must inherit from portfolio behaviors
            if (behaviorRefName === 'System.RequirementBacklogBehavior' || 
                (behaviorName === 'stories' && behaviorRefName.includes('Requirement'))) {
                inheritsId = 'System.PortfolioBacklogBehavior';
            }
            // Portfolio-level behaviors (Features, Epics)
            else if (behaviorName.includes('portfolio') || 
                     behaviorName.includes('epic') || 
                     behaviorName.includes('feature') ||
                     behaviorRefName.includes('Portfolio')) {
                inheritsId = 'System.PortfolioBacklogBehavior';
            }
            // Requirement-level behaviors (User Stories, Product Backlog Items)
            else if (behaviorName.includes('user story') || 
                     behaviorName.includes('product backlog') ||
                     behaviorName.includes('requirement') ||
                     behaviorRefName.includes('RequirementBacklog')) {
                inheritsId = 'System.RequirementBacklogBehavior';
            }
            // Task-level behaviors (Tasks, Bugs, Issues)
            else if (behaviorName.includes('task') || 
                     behaviorName.includes('bug') ||
                     behaviorName.includes('issue') ||
                     behaviorRefName.includes('Task')) {
                inheritsId = 'System.TaskBacklogBehavior';
            }
            // Default fallback for unknown behaviors
            else {
                inheritsId = 'System.BacklogBehavior';
            }
        }

        // Extract behavior ID from various API property structures
        let behaviorId = behavior.id;
        if (!behaviorId || behaviorId === 'undefined' || behaviorId.trim() === '') {
            // Try alternative property names for behavior ID
            behaviorId = (behavior as any).referenceName || 
                        (behavior as any).behaviorId || 
                        (behavior as any).refName ||
                        behavior.name; // Use name as fallback
        }
        
        // Final validation - ensure we have a valid behavior ID
        if (!behaviorId || behaviorId === 'undefined' || behaviorId.trim() === '') {
            throw new Error(`Cannot create behavior '${behavior.name}' - no valid ID found. API structure may have changed.`);
        }

        const createBehavior: WITProcessDefinitionsInterfaces.BehaviorCreateModel = {
            color: behavior.color,
            inherits: inheritsId,
            name: behavior.name
        };
        // TODO: Remove when generated model includes id property
        (<any>createBehavior).id = behaviorId;
        return createBehavior;
    }

    /**
     * Convert WorkItemBehavior to BehaviorReplaceModel
     */
    public static toReplaceBehavior(behavior: WITProcessInterfaces.WorkItemBehavior): WITProcessDefinitionsInterfaces.BehaviorReplaceModel {
        const replaceBehavior: WITProcessDefinitionsInterfaces.BehaviorReplaceModel = {
            color: behavior.color,
            name: behavior.name
        }
        return replaceBehavior;
    }

    /**
     * Validates if a string is a valid URL with a host
     * @param urlString The URL string to validate
     * @returns true if the URL is valid and has a host, false otherwise
     */
    public static isValidUrl(urlString: string): boolean {
        try {
            const url = new URL(urlString);
            return !!url.host;
        } catch {
            return false;
        }
    }

    /**
     * Handle known errors by re-throwing, otherwise log exception
     */
    public static handleKnownError(error: any) {
        if (error instanceof KnownError) { throw error; }
        logger.logException(error);
    }

    /**
     * Execute action with known error handling
     */
    public static async tryCatchWithKnownError<T>(action: () => Promise<T> | T, thrower: () => Error): Promise<T> {
        try {
            return await action();
        }
        catch (error) {
            Utility.handleKnownError(error);
            throw thrower();
        }
    }

    /**
     * Validate configuration file settings for the specified mode
     */
    public static validateConfiguration(configuration: IConfigurationFile, mode: Modes): boolean {
        if (mode === Modes.export || mode === Modes.migrate) {
            if (!configuration.sourceAccountUrl || !Utility.isValidUrl(configuration.sourceAccountUrl)) {
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
            if (!configuration.targetAccountUrl || !Utility.isValidUrl(configuration.targetAccountUrl)) {
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

        // Validate retry configuration
        if (configuration.options && configuration.options.enableRetries !== undefined && (configuration.options.enableRetries !== true && configuration.options.enableRetries !== false)) {
            logger.logError(`[Configuration validation] Option 'enableRetries' is not a valid boolean.`);
            return false;
        }
        if (configuration.options && configuration.options.maxRetries !== undefined && (typeof configuration.options.maxRetries !== 'number' || configuration.options.maxRetries < 0 || configuration.options.maxRetries > 10)) {
            logger.logError(`[Configuration validation] Option 'maxRetries' must be a number between 0 and 10.`);
            return false;
        }
        if (configuration.options && configuration.options.retryBaseDelayMs !== undefined && (typeof configuration.options.retryBaseDelayMs !== 'number' || configuration.options.retryBaseDelayMs < 100 || configuration.options.retryBaseDelayMs > 30000)) {
            logger.logError(`[Configuration validation] Option 'retryBaseDelayMs' must be a number between 100 and 30000 milliseconds.`);
            return false;
        }

        return true;
    }

    /**
     * Check if user has cancelled the operation
     */
    public static didUserCancel(): boolean {
        return Utility.isCancelled;
    }

    /**
     * Generate GUID string without hyphens
     */
    public static createGuidWithoutHyphen(): string {
        return Guid.create().toString().replace(regexRemoveHypen, "");
    }

    /**
     * Executes a function with retry logic for network timeout errors
     * @param fn The function to execute
     * @param maxRetries Maximum number of retries (default: 3)
     * @param baseDelayMs Base delay in milliseconds between retries (default: 1000)
     * @param operation Description of the operation for logging
     * @returns Promise resolving to the function result
     */
    public static async executeWithRetry<T>(
        fn: () => Promise<T>, 
        maxRetries: number = 3, 
        baseDelayMs: number = 1000,
        operation: string = "operation"
    ): Promise<T> {
        let lastError: any;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;
                
                // Check if this is a network timeout error that we should retry
                const isTimeoutError = error && (
                    error.code === 'ETIMEDOUT' ||
                    error.code === 'ECONNRESET' ||
                    error.code === 'ECONNREFUSED' ||
                    (error.message && error.message.includes('ETIMEDOUT')) ||
                    (error.name === 'AggregateError' && error.message && error.message.includes('ETIMEDOUT'))
                );
                
                // If not a timeout error or we've exhausted retries, throw the error
                if (!isTimeoutError || attempt === maxRetries) {
                    throw error;
                }
                
                // Calculate delay with exponential backoff and jitter
                const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
                
                logger.logWarning(`${operation} failed with timeout error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${Math.round(delay)}ms...`);
                logger.logVerbose(`Timeout error details: ${error.message || error}`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    protected static isCancelled = false;
}

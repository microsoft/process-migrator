import { CancellationError } from "./Errors";
import { logger } from "./Logger";
import { Utility } from "./Utilities";

/**
 * Task execution engine with logging and retry capabilities
 */
export class Engine {
    private static _config: any = null;
    
    /**
     * Set configuration for retry behavior
     */
    public static setConfiguration(config: any) {
        Engine._config = config;
    }
    
    /**
     * Execute task with optional retry logic and logging
     */
    public static async Task<T>(step: () => Promise<T>, stepName?: string): Promise<T> {
        if (Utility.didUserCancel()) {
            throw new CancellationError();
        }
        logger.logVerbose(`Begin step '${stepName}'.`);
        
        // Configure retry behavior from options
        const options = Engine._config?.options;
        const enableRetries = options?.enableRetries !== false; // default: true
        const maxRetries = options?.maxRetries || 3;
        const retryBaseDelayMs = options?.retryBaseDelayMs || 1000;
        
        let ret: T;
        if (enableRetries) {
            // Execute with retry logic for network resilience
            ret = await Utility.executeWithRetry(
                step, 
                maxRetries,
                retryBaseDelayMs,
                stepName || "unknown operation"
            );
        } else {
            // Execute without retry
            ret = await step();
        }
        
        logger.logVerbose(`Finished step '${stepName}'.`);
        return ret;
    }

    /**
     * Task method without retry logic for operations that should not be retried
     */
    public static async TaskNoRetry<T>(step: () => Promise<T>, stepName?: string): Promise<T> {
        if (Utility.didUserCancel()) {
            throw new CancellationError();
        }
        logger.logVerbose(`Begin step '${stepName}'.`);
        const ret: T = await step();
        logger.logVerbose(`Finished step '${stepName}'.`);
        return ret;
    }
}

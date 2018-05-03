import { Utility } from "./Utilities";
import { logger } from "./Logger";
import { CancellationError } from "./Errors";

export class Engine {
    public static async Task<T>(step: () => Promise<T>, stepName?: string): Promise<T> {
        if (Utility.didUserCancel()) {
            throw new CancellationError();
        }
        logger.logVerbose(`Begin step '${stepName}'.`);
        const ret: T = await step();
        logger.logVerbose(`Finished step '${stepName}'.`);
        return ret;
    }
}

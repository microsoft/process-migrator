import * as vsts from "azure-devops-node-api/WebApi";
import { existsSync, writeFileSync } from "fs";
import { dirname, normalize } from "path";
import { sync as mkdirpSync } from "mkdirp";
import * as readline from "readline";
import { defaultLogFileName } from "../common/Constants";
import { IConfigurationOptions, IRestClients } from "../common/Interfaces";
import { logger } from "../common/Logger";
import { Utility } from "../common/Utilities";
import { KnownError } from "../common/Errors";

/**
 * Node.js-specific utility functions extending base Utility class
 */
export class NodeJsUtility extends Utility {

    /**
     * Write JSON object to file with directory creation
     */
    public static async writeJsonToFile(exportFilename: string, payload: Object) {
        const folder = dirname(exportFilename);
        if (!existsSync(folder)) {
            mkdirpSync(folder);
        }
        await writeFileSync(exportFilename, JSON.stringify(payload, null, 2), { flag: "w" });
    }

    /**
     * Start keyboard listener for user cancellation (press 'q' to quit)
     */
    public static startCancellationListener() {
        const stdin = process.stdin;
        if (typeof stdin.setRawMode !== "function") {
            logger.logInfo(`We are running inside a TTY does not support RAW mode, you must cancel operation with CTRL+C`);
            return;
        }
        stdin.setRawMode(true);
        readline.emitKeypressEvents(stdin);
        stdin.addListener("keypress", this._listener);
        logger.logVerbose("Keyboard listener added");
    }

    /**
     * Get log file path from configuration options
     */
    public static getLogFilePath(options: IConfigurationOptions): string {
        return options.logFilename ? options.logFilename : normalize(defaultLogFileName);
    }

    /**
     * Create Azure DevOps REST API clients with authentication
     */
    public static async getRestClients(accountUrl: string, PAT: string): Promise<IRestClients> {
        const authHandler = vsts.getPersonalAccessTokenHandler(PAT);
        const vstsWebApi = new vsts.WebApi(accountUrl, authHandler);
        try {
            return {
                "witApi": await vstsWebApi.getWorkItemTrackingApi(),
                "witProcessApi": await vstsWebApi.getWorkItemTrackingProcessApi(),
                "witProcessDefinitionApi": await vstsWebApi.getWorkItemTrackingProcessDefinitionApi(),
            }
        }
        catch (error) {
            throw new KnownError(`Failed to connect to account '${accountUrl}' using personal access token '<omitted>' provided, check url and token.`);
        }
    }

    private static _listener = (str: string, key: readline.Key) => {
        if (key.name.toLocaleLowerCase() === "q") {
            logger.logVerbose("Setting isCancelled to true.");
            Utility.isCancelled = true;
        }
    };
}
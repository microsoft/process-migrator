#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";
import { resolve, normalize } from "path";
import { ProcesCommandLine, ProcessConfigurationFile } from "./ConfigurationProcessor";
import { defaultEncoding, defaultProcessFilename } from "../common/Constants";
import { ImportError, KnownError } from "../common/Errors";
import { IConfigurationOptions, IProcessPayload, LogLevel, Modes } from "../common/Interfaces";
import { logger } from "../common/Logger";
import { InitializeFileLogger } from "./FileLogger";
import { ProcessExporter } from "../common/ProcessExporter";
import { ProcessImporter } from "../common/ProcessImporter";
import { Engine } from "../common/Engine";
import { NodeJsUtility } from "./NodeJsUtilities";

async function main() {
    const startTime = Date.now();

    // Parse command line
    const commandLineOptions = ProcesCommandLine();

    // Read configuration file 
    const configuration = await ProcessConfigurationFile(commandLineOptions)

    // Overwrite token if specified on command line 
    if (commandLineOptions.sourceToken) {
        configuration.sourceAccountToken = commandLineOptions.sourceToken;
    }

    if (commandLineOptions.targetToken) {
        configuration.targetAccountToken = commandLineOptions.targetToken;
    }

    // Initialize logger
    const maxLogLevel = configuration.options.logLevel ? LogLevel[configuration.options.logLevel] : LogLevel.information;
    const logFile = NodeJsUtility.getLogFilePath(configuration.options);
    InitializeFileLogger(logFile, maxLogLevel);
    logger.logInfo(`Full log is sent to '${resolve(logFile)}' `)

    // Enable user cancellation
    NodeJsUtility.startCancellationListener();

    const mode = commandLineOptions.mode;
    const userOptions = configuration.options as IConfigurationOptions;
    try {
        // Export
        let processPayload: IProcessPayload;
        if (mode === Modes.export || mode === Modes.migrate) {
            const sourceRestClients = await Engine.Task(() => NodeJsUtility.getRestClients(configuration.sourceAccountUrl, configuration.sourceAccountToken), `Get rest client on source account '${configuration.sourceAccountUrl}'`);
            const exporter: ProcessExporter = new ProcessExporter(sourceRestClients, configuration);
            processPayload = await exporter.exportProcess();

            const exportFilename = (configuration.options && configuration.options.processFilename) || normalize(defaultProcessFilename);
            await Engine.Task(() => NodeJsUtility.writeJsonToFile(exportFilename, processPayload), "Write process payload to file")
            logger.logInfo(`Export process completed successfully to '${resolve(exportFilename)}'.`);
        }

        // Import 
        if (mode === Modes.import || mode == Modes.migrate) {
            if (mode === Modes.import) { // Read payload from file instead
                const processFileName = (configuration.options && configuration.options.processFilename) || normalize(defaultProcessFilename);
                if (!existsSync(processFileName)) {
                    throw new ImportError(`Process payload file '${processFileName}' does not exist.`)
                }
                logger.logVerbose(`Start read process payload from '${processFileName}'.`);
                processPayload = JSON.parse(readFileSync(processFileName, defaultEncoding));
                logger.logVerbose(`Complete read process payload.`);
            }

            const targetRestClients = await Engine.Task(() => NodeJsUtility.getRestClients(configuration.targetAccountUrl, configuration.targetAccountToken), `Get rest client on target account '${configuration.targetAccountUrl}'`);
            const importer: ProcessImporter = new ProcessImporter(targetRestClients, configuration, commandLineOptions);
            await importer.importProcess(processPayload);
        }
    }
    catch (error) {
        if (error instanceof KnownError) {
            // Known errors, just log error message
            logger.logError(error.message);
        }
        else {
            logger.logException(error);
            logger.logError(`Encountered unkonwn error, check log file for details.`)
        }
        process.exit(1);
    }

    const endTime = Date.now();
    logger.logInfo(`Total elapsed time: '${(endTime - startTime) / 1000}' seconds.`);
    process.exit(0);
}

main();
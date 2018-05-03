import { readFileSync } from "fs";
import { defaultEncoding, defaultProcessFilename, paramOverwriteProcessOnTarget } from "./Constants";
import { CancellationError, KnownError } from "./Errors";
import { IConfigurationOptions, IImportConfiguration, IProcessPayload, LogLevel, Modes } from "./Interfaces";
import { logger, InitializeFileLogger } from "./Logger";
import { ProcesCommandLine, ProcessConfigurationFile } from "./ConfigurationProcessor";
import { Utility } from "./Utilities";
import { ProcessExporter } from "./ProcessExporter";
import { ProcessImporter } from "./ProcessImporter";

async function main() {
    // Parse command line
    const commandLineOptions = ProcesCommandLine();

    // Read configuration file 
    const configuration = await ProcessConfigurationFile(commandLineOptions.config, commandLineOptions.mode)

    // Initialize logger
    const maxLogLevel = configuration.options.logLevel ? configuration.options.logLevel : LogLevel.Information;
    InitializeFileLogger(Utility.getLogFilePath(configuration.options), maxLogLevel);

    const mode = commandLineOptions.mode;
    const userOptions = configuration.options as IConfigurationOptions;
    try {
        
        let processPayload: IProcessPayload;
        if (mode === Modes.export || mode === Modes.both) {
            const sourceWebApi = Utility.getWebApi(configuration.sourceAccountUrl, configuration.sourceAccountToken);
            const exporter: ProcessExporter = new ProcessExporter(sourceWebApi, configuration);
            processPayload = await exporter.exportProcess();
        }

        //TODO: Remove or formalize this - dev only for now
        if (mode === Modes.both || mode === Modes.import) {
            if (mode === Modes.import) { // Read payload from file;
                const processFileName = (configuration.options && configuration.options.processFilename) || defaultProcessFilename;
                logger.logVerbose(`Start read process payload from '${processFileName}'.`);
                processPayload = JSON.parse(await readFileSync(processFileName, defaultEncoding));
                logger.logVerbose(`Complete read process payload.`);
            }

            const targetWebApi = Utility.getWebApi(configuration.targetAccountUrl, configuration.targetAccountToken);

            const importer: ProcessImporter = new ProcessImporter(targetWebApi, configuration, commandLineOptions);
            logger.logInfo("Process import started.");
            await importer.importProcess(processPayload);
            logger.logInfo("Process import completed successfully.");
        }
    }
    catch (error) {
        logger.logException(error);
        if (error instanceof KnownError) {
            // Known errors, just log error message
            logger.logError(error.message);
        }
        else {
            logger.logError(`Hit unknown error, check log file for details.`)
        }
        process.exit(1);
    }
    process.exit(0);
}

main();
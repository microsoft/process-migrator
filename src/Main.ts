import { existsSync, readFileSync } from "fs";
import { ProcesCommandLine, ProcessConfigurationFile } from "./ConfigurationProcessor";
import { defaultEncoding, defaultProcessFilename } from "./Constants";
import { ImportError, KnownError } from "./Errors";
import { IConfigurationOptions, IProcessPayload, LogLevel, Modes } from "./Interfaces";
import { InitializeFileLogger, logger } from "./Logger";
import { ProcessExporter } from "./ProcessExporter";
import { ProcessImporter } from "./ProcessImporter";
import { Utility } from "./Utilities";

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
        // Export
        let processPayload: IProcessPayload;
        if (mode === Modes.export || mode === Modes.both) {
            const sourceWebApi = Utility.getWebApi(configuration.sourceAccountUrl, configuration.sourceAccountToken);
            const exporter: ProcessExporter = new ProcessExporter(sourceWebApi, configuration);
            processPayload = await exporter.exportProcess();
        }

        // IMport 
        if (mode === Modes.both || mode === Modes.import) {
            if (mode === Modes.import) { // Read payload from file instead
                const processFileName = (configuration.options && configuration.options.processFilename) || defaultProcessFilename;
                if (!existsSync(processFileName)) {
                    throw new ImportError(`Process payload file '${processFileName}' does not exist.`)
                }
                logger.logVerbose(`Start read process payload from '${processFileName}'.`);
                processPayload = JSON.parse(await readFileSync(processFileName, defaultEncoding));
                logger.logVerbose(`Complete read process payload.`);
            }

            const targetWebApi = Utility.getWebApi(configuration.targetAccountUrl, configuration.targetAccountToken);
            const importer: ProcessImporter = new ProcessImporter(targetWebApi, configuration, commandLineOptions);
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
            logger.logError(`Encourntered unkonwn error, check log file for details.`)
        }
        process.exit(1);
    }
    process.exit(0);
}

main();
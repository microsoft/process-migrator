import { existsSync, readFileSync, writeFileSync } from "fs";
import * as minimist from "minimist";
import * as url from "url";
import { defaultConfiguration, defaultConfigurationFilename, defaultEncoding, paramConfig, paramMode, paramOverwriteProcessOnTarget } from "../common/Constants";
import { IConfigurationFile, LogLevel, Modes, ICommandLineOptions } from "../common/Interfaces";
import { logger } from "../common/Logger";
import { Utility } from "../common/Utilities";

export function ProcesCommandLine(): ICommandLineOptions {
    const parseOptions: minimist.Opts = {
        boolean: true,
        alias: {
            "help": "h",
            "mode": "m",
            "config": "c"
        }
    }
    const parsedArgs = minimist(process.argv, parseOptions);

    if (parsedArgs["h"]) {
        logger.logInfo(`Usage: node ImportExportProcess.js --mode=<import/export/both> [--config=<configuration file path>] [--overwriteProcessOnTarget]`);
        process.exit(0);
    }

    const configFileName = parsedArgs[paramConfig] || defaultConfigurationFilename;

    const userSpecifiedMode = parsedArgs[paramMode] as string;
    let mode;
    if (userSpecifiedMode) {
        switch (userSpecifiedMode.toLocaleLowerCase()) {
            case Modes[Modes.export]: mode = Modes.export; break;
            case Modes[Modes.import]: mode = Modes.import; break;
            case Modes[Modes.both]: mode = Modes.both; break;
            default: logger.logError(`Invalid mode argument, allowed values are 'import','export' and 'both'.`); process.exit(1);
        }
    } else {
        // Default to both import/export
        mode = Modes.both;
    }

    const ret = {}; 
    ret[paramMode] = mode;
    ret[paramConfig] = configFileName;
    ret[paramOverwriteProcessOnTarget] = !!parsedArgs[paramOverwriteProcessOnTarget];

    return <ICommandLineOptions> ret;
}

export async function ProcessConfigurationFile(configFilename: string, mode: Modes): Promise<IConfigurationFile> {
    // Load configuration file
    if (!existsSync(configFilename)) {
        logger.logError(`Cannot find configuration file '${configFilename}'`);
        if (!existsSync(defaultConfigurationFilename)) {
            writeFileSync(defaultConfigurationFilename, JSON.stringify(defaultConfiguration, null, 2));
            logger.logInfo(`Generated default configuration file as '${defaultConfigurationFilename}'.`);
        }
        process.exit(1);
    }
   
    const configuration = JSON.parse(await readFileSync(configFilename, defaultEncoding)) as IConfigurationFile;
    if (!Utility.validateConfiguration(configuration, mode)) {
        process.exit(1);
    }

    return configuration;
}


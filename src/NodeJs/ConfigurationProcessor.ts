import { existsSync, readFileSync, writeFileSync } from "fs";
import { normalize } from "path";
import * as minimist from "minimist";
import * as url from "url";
import { defaultConfiguration, defaultConfigurationFilename, defaultEncoding, paramConfig, paramMode, paramOverwriteProcessOnTarget } from "../common/Constants";
import { IConfigurationFile, LogLevel, Modes, ICommandLineOptions } from "../common/Interfaces";
import { logger } from "../common/Logger";
import { Utility } from "../common/Utilities";
import { parse as jsoncParse } from "jsonc-parser";

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
        logger.logInfo(`Usage: processMigrator [--mode=<migrate(default)import/export> [--config=<your-configuration-file-path>]`);
        process.exit(0);
    }

    const configFileName = parsedArgs[paramConfig] || normalize(defaultConfigurationFilename);

    const userSpecifiedMode = parsedArgs[paramMode] as string;
    let mode;
    if (userSpecifiedMode) {
        switch (userSpecifiedMode.toLocaleLowerCase()) {
            case Modes[Modes.export]: mode = Modes.export; break;
            case Modes[Modes.import]: mode = Modes.import; break;
            case Modes[Modes.migrate]: mode = Modes.migrate; break;
            default: logger.logError(`Invalid mode argument, allowed values are 'import','export' and 'migrate'.`); process.exit(1);
        }
    } else {
        mode = Modes.migrate;
    }

    const ret = {};
    ret[paramMode] = mode;
    ret[paramConfig] = configFileName;
    ret[paramOverwriteProcessOnTarget] = !!parsedArgs[paramOverwriteProcessOnTarget];

    return <ICommandLineOptions>ret;
}

export async function ProcessConfigurationFile(configFilename: string, mode: Modes): Promise<IConfigurationFile> {
    // Load configuration file
    if (!existsSync(configFilename)) {
        logger.logError(`Cannot find configuration file '${configFilename}'`);
        const normalizedConfiguraitonFilename = normalize(defaultConfigurationFilename);
        if (!existsSync(normalizedConfiguraitonFilename)) {
            writeFileSync(normalizedConfiguraitonFilename, defaultConfiguration);
            logger.logInfo(`Generated configuration file as '${defaultConfigurationFilename}', please fill in required information and retry.`);
        }
        process.exit(1);
    }

    const configuration = jsoncParse(readFileSync(configFilename, defaultEncoding)) as IConfigurationFile;
    if (!Utility.validateConfiguration(configuration, mode)) {
        process.exit(1);
    }

    return configuration;
}


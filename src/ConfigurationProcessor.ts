import { existsSync, readFileSync, writeFileSync } from "fs";
import * as minimist from "minimist";
import * as url from "url";
import { defaultConfiguration, defaultConfigurationFilename, defaultEncoding, paramConfig, paramMode, paramOverwriteProcessOnTarget } from "./Constants";
import { IConfigurationFile, LogLevel, Modes, ICommandLineOptions } from "./Interfaces";
import { logger } from "./Logger";

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
    if (!validateConfiguration(configuration, mode)) {
        process.exit(1);
    }

    return configuration;
}

function validateConfiguration(configuration: IConfigurationFile, mode: Modes): boolean {
    if (mode === Modes.export || mode === Modes.both) {
        if (!configuration.sourceAccountUrl || !url.parse(configuration.sourceAccountUrl).host) {
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

    if (mode === Modes.import || mode === Modes.both) {
        if (!configuration.targetAccountUrl || !url.parse(configuration.targetAccountUrl).host) {
            logger.logError(`[Configuration validation] Missing or invalid target account url: '${configuration.targetAccountUrl}'.`);
            return false;
        }
        if (!configuration.targetAccountToken) {
            logger.logError(`[Configuration validation] Personal access token for target account is empty.`);
            return false;
        }
        if (configuration.options && configuration.options.overwritePicklist && (configuration.options.overwritePicklist !== true && configuration.options.overwritePicklist !== false)) {
            logger.logError(`[Configuration validation] Option 'overwritePicklist' is not a valid boolean.`);
            return false;
        }
    }

    if (configuration.options && configuration.options.logLevel && LogLevel[configuration.options.logLevel] === undefined) {
        logger.logError(`[Configuration validation] Option 'logLevel' is not a valid log level.`);
        return false;
    }

    return true;
}

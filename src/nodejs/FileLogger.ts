import { LogLevel, ILogger } from "../common/Interfaces";
import { SetLogger } from "../common/Logger";
import { appendFileSync, existsSync, unlinkSync, mkdirSync } from "fs";
import { dirname } from "path";
import { sync as mkdirpSync } from "mkdirp";

export class FileLogger implements ILogger {
    constructor(private _logFilename: string, private _maxLogLevel: LogLevel) {
        if (existsSync(_logFilename)) {
            unlinkSync(_logFilename);
        }
    }

    public logVerbose(message: string) {
        this._log(message, LogLevel.verbose);
    }

    public logInfo(message: string) {
        this._log(message, LogLevel.information);
    }

    public logWarning(message: string) {
        this._log(message, LogLevel.warning);
    }

    public logError(message: string) {
        this._log(message, LogLevel.error);
    }

    public logException(error: Error) {
        if (error instanceof Error) {
            this._log(`Exception message:${error.message}\r\nCall stack:${error.stack}`, LogLevel.verbose);
        }
        else {
            this._log(`Unknown exception: ${JSON.stringify(error)}`, LogLevel.verbose);
        }
    }

    private _log(message: string, logLevel: LogLevel) {
        const outputMessage: string = `[${LogLevel[logLevel].toUpperCase()}] [${(new Date(Date.now())).toISOString()}] ${message}`;
        if (logLevel <= this._maxLogLevel) {
            console.log(outputMessage);
        }

        appendFileSync(this._logFilename, `${outputMessage}\r\n`);
    }
}

export function InitializeFileLogger(logFilename: string, maxLogLevel: LogLevel) {
    const folder = dirname(logFilename);
    if (!existsSync(folder)) {
        mkdirpSync(folder);
    }
    SetLogger(new FileLogger(logFilename, maxLogLevel));
}
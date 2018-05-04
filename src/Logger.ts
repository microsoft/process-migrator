import { appendFileSync, existsSync, unlinkSync, mkdirSync } from "fs";
import { LogLevel, ILogger } from "./Interfaces";
import { dirname } from "path";
import { sync as mkdirpSync } from "mkdirp";

class ConsoleLogger implements ILogger {
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
        const outputMessage: string = `[${LogLevel[logLevel]}] [${(new Date(Date.now())).toISOString()}] ${message}`;
        console.log(outputMessage);
    }
}

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

        //TODO: revisit the perf here - this isn't very nice but should work at the size of the application
        appendFileSync(this._logFilename, `${outputMessage}\r\n`);
    }
}

export var logger: ILogger = new ConsoleLogger();

export function InitializeFileLogger(logFilename: string, maxLogLevel: LogLevel) {
    const folder = dirname(logFilename);
    if (!existsSync(folder)) {
        mkdirpSync(folder);
    }
    this.logger = new FileLogger(logFilename, maxLogLevel);
}
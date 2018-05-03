import { appendFileSync, existsSync, unlinkSync } from "fs";
import { LogLevel } from "./Interfaces";

export class Logger {
    constructor(private _logFilename: string, private _logLevel: LogLevel) {
        if (existsSync(_logFilename)) {
            unlinkSync(_logFilename);
        }
    }

    public logVerbose(message: string) {
        this._log(message, LogLevel.Verbose);
    }

    public logInfo(message: string) {
        this._log(message, LogLevel.Information);
    }

    public logWarning(message: string) {
        this._log(message, LogLevel.Warning);
    }

    public logError(message: string) {
        this._log(message, LogLevel.Error);
    }

    public logException(error: Error) {
        if (error instanceof Error) {
            this._log(`Exception message:${error.message}\r\nCall stack:${error.stack}`, LogLevel.Verbose);
        }
        else {
            this._log(`Unknown exception: ${JSON.stringify(error)}`, LogLevel.Verbose);
        }
    }

    private _log(message: string, logLevel: LogLevel) {
        const outputMessage: string = `[${LogLevel[logLevel]}] [${(new Date(Date.now())).toISOString()}] ${message}`;
        if (logLevel <= this._logLevel) {
            console.log(outputMessage);
        }

        //TODO: revisit the perf here - this isn't very nice but should work at the size of the application
        appendFileSync(this._logFilename, `${outputMessage}\r\n`);
    }
}
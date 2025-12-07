import { LogLevel, ILogger } from "./Interfaces";

/**
 * Console-based logger implementation
 */
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
        const outputMessage: string = `[${LogLevel[logLevel].toUpperCase()}] [${(new Date(Date.now())).toISOString()}] ${message}`;
        console.log(outputMessage);
    }
}

export var logger: ILogger = new ConsoleLogger();

/**
 * Replace the default logger implementation (internal use only)
 */
export function SetLogger(newLogger: ILogger) {
    logger = newLogger;
}
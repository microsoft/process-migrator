"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.SetLogger = SetLogger;
const Interfaces_1 = require("./Interfaces");
class ConsoleLogger {
    logVerbose(message) {
        this._log(message, Interfaces_1.LogLevel.verbose);
    }
    logInfo(message) {
        this._log(message, Interfaces_1.LogLevel.information);
    }
    logWarning(message) {
        this._log(message, Interfaces_1.LogLevel.warning);
    }
    logError(message) {
        this._log(message, Interfaces_1.LogLevel.error);
    }
    logException(error) {
        if (error instanceof Error) {
            this._log(`Exception message:${error.message}\r\nCall stack:${error.stack}`, Interfaces_1.LogLevel.verbose);
        }
        else {
            this._log(`Unknown exception: ${JSON.stringify(error)}`, Interfaces_1.LogLevel.verbose);
        }
    }
    _log(message, logLevel) {
        const outputMessage = `[${Interfaces_1.LogLevel[logLevel].toUpperCase()}] [${(new Date(Date.now())).toISOString()}] ${message}`;
        console.log(outputMessage);
    }
}
exports.logger = new ConsoleLogger();
function SetLogger(newLogger) {
    exports.logger = newLogger;
}
//# sourceMappingURL=Logger.js.map
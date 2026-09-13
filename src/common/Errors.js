"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportError = exports.ImportError = exports.AggregateValidationError = exports.ValidationError = exports.CancellationError = exports.KnownError = void 0;
class KnownError extends Error {
    constructor(message) {
        const trueProto = new.target.prototype;
        super(message);
        this.__proto__ = trueProto;
    }
}
exports.KnownError = KnownError;
class CancellationError extends KnownError {
    constructor() {
        super("Process import/export cancelled by user input.");
    }
}
exports.CancellationError = CancellationError;
class ValidationError extends KnownError {
    constructor(message) {
        super(`Process import validation failed. ${message}`);
    }
}
exports.ValidationError = ValidationError;
class AggregateValidationError extends KnownError {
    constructor(errors) {
        const formatted = errors.map((e, i) => `  ${i + 1}) ${e}`).join("\n");
        super(`Process import validation failed with ${errors.length} error(s):\n${formatted}`);
        this.errors = errors;
    }
}
exports.AggregateValidationError = AggregateValidationError;
class ImportError extends KnownError {
    constructor(message) {
        super(`Import failed, see log file for details. ${message}`);
    }
}
exports.ImportError = ImportError;
class ExportError extends KnownError {
    constructor(message) {
        super(`Export failed, see log file for details. ${message}`);
    }
}
exports.ExportError = ExportError;
//# sourceMappingURL=Errors.js.map
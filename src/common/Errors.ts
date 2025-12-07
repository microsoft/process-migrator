/**
 * Base class for known/expected errors (required for instanceof checks)
 */
export class KnownError extends Error {
    __proto__: Error;
    constructor(message?: string) {
        const trueProto = new.target.prototype;
        super(message);

        // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
        this.__proto__ = trueProto;
    }
}

/**
 * Error thrown when user cancels the operation
 */
export class CancellationError extends KnownError {
    constructor() {
        super("Process import/export cancelled by user input.");
    }
}

/**
 * Error thrown during pre-import validation
 */
export class ValidationError extends KnownError {
    constructor(message: string) {
        super(`Process import validation failed. ${message}`);
    }
}

/**
 * Error thrown during import operations
 */
export class ImportError extends KnownError {
    constructor(message: string) {
        super(`Import failed, see log file for details. ${message}`);
    }
}

/**
 * Error thrown during export operations
 */
export class ExportError extends KnownError {
    constructor(message: string) {
        super(`Export failed, see log file for details. ${message}`);
    }
}
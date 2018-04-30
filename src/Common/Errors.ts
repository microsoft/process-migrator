// NOTE: We need this intermediate class to use 'instanceof'
export class KnownError extends Error {
    __proto__: Error;
    constructor(message?: string) {
        const trueProto = new.target.prototype;
        super(message);

        // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
        this.__proto__ = trueProto;
    }
}

export class CancellationError extends KnownError {
    constructor() {
        super("Process import/export cancelled by user input.");
    }
}

export class ValidationError extends KnownError {
    constructor(message: string) {
        super(`Process import validation failed. ${message}`);
    }
}

export class ImportError extends KnownError {
    constructor(message: string) {
        super(`Import failed, see log file for details. ${message}`);
    }
}

export class ExportError extends KnownError {
    constructor(message: string) {
        super(`Export failed, see log file for details. ${message}`);
    }
}
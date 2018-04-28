export class CancellationError extends Error {
    constructor() {
        super("Process Import/Export cancelled. See log file for details");
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(`Process Import/Export does not meet the requiements for import. ${message}`);
    }
}

export class ImportError extends Error {
    constructor(message: string) {
        super(`Import failed. See log file for details. ${message}`);
        //TODO implement log file of all the artifacts that have been created in the target acccount.
    }
}

export class ExportError extends Error {
    constructor(message: string) {
        super(`Export failed. ${message}`);
    }
}
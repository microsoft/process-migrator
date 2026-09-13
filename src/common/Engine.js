"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Engine = void 0;
const Errors_1 = require("./Errors");
const Logger_1 = require("./Logger");
const Utilities_1 = require("./Utilities");
class Engine {
    static async Task(step, stepName) {
        if (Utilities_1.Utility.didUserCancel()) {
            throw new Errors_1.CancellationError();
        }
        Logger_1.logger.logVerbose(`Begin step '${stepName}'.`);
        const ret = await step();
        Logger_1.logger.logVerbose(`Finished step '${stepName}'.`);
        return ret;
    }
}
exports.Engine = Engine;
//# sourceMappingURL=Engine.js.map
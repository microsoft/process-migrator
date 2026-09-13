"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Modes = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["error"] = 0] = "error";
    LogLevel[LogLevel["warning"] = 1] = "warning";
    LogLevel[LogLevel["information"] = 2] = "information";
    LogLevel[LogLevel["verbose"] = 3] = "verbose";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var Modes;
(function (Modes) {
    Modes[Modes["import"] = 0] = "import";
    Modes[Modes["export"] = 1] = "export";
    Modes[Modes["migrate"] = 2] = "migrate";
})(Modes || (exports.Modes = Modes = {}));
//# sourceMappingURL=Interfaces.js.map
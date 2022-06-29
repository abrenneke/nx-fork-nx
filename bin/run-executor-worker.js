"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeTask = void 0;
const tslib_1 = require("tslib");
const run_1 = require("../src/command-line/run");
const fs_1 = require("fs");
const add_command_prefix_1 = require("../src/utils/add-command-prefix");
setUpOutputWatching();
process.env.NX_CLI_SET = 'true';
let state;
function executeTask(task, options) {
    var _a, _b;
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        state = {
            currentTask: task,
            onlyStdout: [],
            currentOptions: options,
            outputPath: options.outputPath,
            streamOutput: (_a = options.streamOutput) !== null && _a !== void 0 ? _a : false,
            captureStderr: (_b = options.captureStderr) !== null && _b !== void 0 ? _b : false,
            logFileHandle: (0, fs_1.openSync)(options.outputPath, 'w'),
        };
        try {
            const statusCode = yield (0, run_1.run)(process.cwd(), options.workspaceRoot, task.target, task.overrides, task.overrides['verbose'] === true, false, options.projectGraph);
            // when the process exits successfully, and we are not asked to capture stderr
            // override the file with only stdout
            if (statusCode === 0 && !state.captureStderr && state.outputPath) {
                (0, fs_1.writeFileSync)(state.outputPath, state.onlyStdout.join(''));
            }
            return { statusCode };
        }
        catch (e) {
            console.error(e.toString());
            return { statusCode: 1, error: e.toString() };
        }
        finally {
            if (state.logFileHandle) {
                (0, fs_1.closeSync)(state.logFileHandle);
            }
            state = undefined;
        }
    });
}
exports.executeTask = executeTask;
/**
 * We need to collect all stdout and stderr and store it, so the caching mechanism
 * could store it.
 *
 * Writing stdout and stderr into different streams is too risky when using TTY.
 *
 * So we are simply monkey-patching the Javascript object. In this case the actual output will always be correct.
 * And the cached output should be correct unless the CLI bypasses process.stdout or console.log and uses some
 * C-binary to write to stdout.
 */
function setUpOutputWatching() {
    const stdoutWrite = process.stdout._write;
    const stderrWrite = process.stderr._write;
    process.stdout._write = (chunk, encoding, callback) => {
        var _a, _b;
        state === null || state === void 0 ? void 0 : state.onlyStdout.push(chunk);
        if (state === null || state === void 0 ? void 0 : state.outputPath) {
            if (!state.logFileHandle) {
                state.logFileHandle = (0, fs_1.openSync)(state.outputPath, 'w');
            }
            (0, fs_1.appendFileSync)(state.logFileHandle, chunk);
        }
        if (state === null || state === void 0 ? void 0 : state.streamOutput) {
            const updatedChunk = (0, add_command_prefix_1.addCommandPrefixIfNeeded)(state.currentTask.target.project, chunk, encoding);
            (_b = (_a = state.currentOptions) === null || _a === void 0 ? void 0 : _a.onStdout) === null || _b === void 0 ? void 0 : _b.call(_a, chunk);
            stdoutWrite.apply(process.stdout, [
                updatedChunk.content,
                updatedChunk.encoding,
                callback,
            ]);
        }
        else {
            callback();
        }
    };
    process.stderr._write = (chunk, encoding, callback) => {
        var _a, _b;
        if (state === null || state === void 0 ? void 0 : state.outputPath) {
            if (!state.logFileHandle) {
                state.logFileHandle = (0, fs_1.openSync)(state.outputPath, 'w');
            }
            (0, fs_1.appendFileSync)(state.logFileHandle, chunk);
        }
        if (state === null || state === void 0 ? void 0 : state.streamOutput) {
            const updatedChunk = (0, add_command_prefix_1.addCommandPrefixIfNeeded)(state.currentTask.target.project, chunk, encoding);
            (_b = (_a = state.currentOptions) === null || _a === void 0 ? void 0 : _a.onStderr) === null || _b === void 0 ? void 0 : _b.call(_a, chunk);
            stderrWrite.apply(process.stderr, [
                updatedChunk.content,
                updatedChunk.encoding,
                callback,
            ]);
        }
        else {
            callback();
        }
    };
}
//# sourceMappingURL=run-executor-worker.js.map
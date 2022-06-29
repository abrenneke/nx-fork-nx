"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JestWorkerTaskRunner = void 0;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const workspace_root_1 = require("../utils/workspace-root");
const output_1 = require("../utils/output");
const utils_1 = require("./utils");
const strip_indents_1 = require("../utils/strip-indents");
const jest_worker_1 = require("jest-worker");
const add_command_prefix_1 = require("../utils/add-command-prefix");
const useWorkerThreads = process.env.NX_JEST_WORKER_TASK_RUNNER_USE_THREADS === 'true';
class JestWorkerTaskRunner {
    constructor(options, projectGraph) {
        this.options = options;
        this.projectGraph = projectGraph;
        this.workspaceRoot = workspace_root_1.workspaceRoot;
        this.cliPath = require.resolve(`../../bin/run-executor-worker.js`);
        this.processes = new Set();
        this.worker = (useWorkerThreads
            ? new jest_worker_1.Worker(this.cliPath, {
                numWorkers: this.options.parallel,
                enableWorkerThreads: true,
                exposedMethods: ['executeTask'],
            })
            : new jest_worker_1.Worker(this.cliPath, {
                numWorkers: this.options.parallel,
                exposedMethods: ['executeTask'],
                forkOptions: {
                    env: Object.assign(Object.assign({}, process.env), this.getNxEnvVariablesForForkedProcess()),
                },
            }));
        this.setupOnProcessExitListener();
    }
    // TODO: vsavkin delegate terminal output printing
    forkProcessForBatch({ executorName, taskGraph, }) {
        throw new Error('Not implemented');
    }
    executeTask(task, { streamOutput, temporaryOutputPath, }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let code;
            let error;
            try {
                if (streamOutput) {
                    output_1.output.logCommand((0, utils_1.getPrintableCommandArgsForTask)(task).join(' '));
                    output_1.output.addNewline();
                }
                const promise = this.worker.executeTask(task, {
                    workspaceRoot: this.workspaceRoot,
                    outputPath: temporaryOutputPath,
                    streamOutput,
                    captureStderr: this.options.captureStderr,
                    projectGraph: this.projectGraph,
                });
                promise.UNSTABLE_onCustomMessage(([msg, data]) => {
                    if (msg === 'stdout') {
                        if (streamOutput) {
                            process.stdout.write((0, add_command_prefix_1.addCommandPrefixIfNeeded)(task.target.project, data, 'utf-8')
                                .content);
                        }
                    }
                    else if (msg === 'stderr') {
                        if (streamOutput) {
                            process.stderr.write((0, add_command_prefix_1.addCommandPrefixIfNeeded)(task.target.project, data, 'utf-8')
                                .content);
                        }
                    }
                });
                const result = yield promise;
                code = result.statusCode;
                error = result.error;
            }
            catch (err) {
                console.dir({ err });
                code = 1;
                error = err.toString();
            }
            // TODO if (code === null) code = this.signalToCode(signal);
            // we didn't print any output as we were running the command
            // print all the collected output
            let terminalOutput = '';
            try {
                terminalOutput = this.readTerminalOutput(temporaryOutputPath);
                if (!streamOutput) {
                    this.options.lifeCycle.printTaskTerminalOutput(task, code === 0 ? 'success' : 'failure', terminalOutput);
                }
            }
            catch (e) {
                console.log((0, strip_indents_1.stripIndents) `
              Unable to print terminal output for Task "${task.id}".
              Task failed with Exit Code ${code}.

              Received error message:
              ${e.message}
            `);
            }
            return { code, terminalOutput: terminalOutput || error || '' };
        });
    }
    readTerminalOutput(outputPath) {
        return (0, fs_1.readFileSync)(outputPath).toString();
    }
    getNxEnvVariablesForForkedProcess() {
        const env = {
            FORCE_COLOR: 'true',
            NX_SKIP_NX_CACHE: this.options.skipNxCache ? 'true' : undefined,
        };
        return env;
    }
    // endregion Environment Variables
    setupOnProcessExitListener() {
        process.on('SIGINT', () => {
            this.processes.forEach((p) => {
                p.kill('SIGTERM');
            });
            // we exit here because we don't need to write anything to cache.
            process.exit();
        });
        process.on('SIGTERM', () => {
            this.processes.forEach((p) => {
                p.kill('SIGTERM');
            });
            // no exit here because we expect child processes to terminate which
            // will store results to the cache and will terminate this process
        });
        process.on('SIGHUP', () => {
            this.processes.forEach((p) => {
                p.kill('SIGTERM');
            });
            // no exit here because we expect child processes to terminate which
            // will store results to the cache and will terminate this process
        });
    }
}
exports.JestWorkerTaskRunner = JestWorkerTaskRunner;
//# sourceMappingURL=jest-worker-task-runner.js.map
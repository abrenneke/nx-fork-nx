"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPackageJson = exports.defaultFileRead = exports.workspaceFileName = exports.readWorkspaceConfig = exports.TEN_MEGABYTES = exports.calculateFileChanges = exports.readFileIfExisting = exports.isWholeFileChange = exports.WholeFileChange = void 0;
const workspaces_1 = require("../config/workspaces");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const configuration_1 = require("../config/configuration");
const workspace_root_1 = require("../utils/workspace-root");
const fileutils_1 = require("../utils/fileutils");
const json_diff_1 = require("../utils/json-diff");
const ignore_1 = require("ignore");
const fileutils_2 = require("../utils/fileutils");
const project_graph_1 = require("./project-graph");
class WholeFileChange {
    constructor() {
        this.type = 'WholeFileChange';
    }
}
exports.WholeFileChange = WholeFileChange;
function isWholeFileChange(change) {
    return change.type === 'WholeFileChange';
}
exports.isWholeFileChange = isWholeFileChange;
function readFileIfExisting(path) {
    return (0, fs_1.existsSync)(path) ? (0, fs_1.readFileSync)(path, 'utf-8') : '';
}
exports.readFileIfExisting = readFileIfExisting;
function getIgnoredGlobs() {
    const ig = (0, ignore_1.default)();
    ig.add(readFileIfExisting(`${workspace_root_1.workspaceRoot}/.gitignore`));
    ig.add(readFileIfExisting(`${workspace_root_1.workspaceRoot}/.nxignore`));
    return ig;
}
function calculateFileChanges(files, allWorkspaceFiles, nxArgs, readFileAtRevision = defaultReadFileAtRevision, ignore = getIgnoredGlobs()) {
    files = files.filter((f) => !ignore.ignores(f));
    return files.map((f) => {
        const ext = (0, path_1.extname)(f);
        const file = allWorkspaceFiles.find((fileData) => fileData.file == f);
        const hash = file === null || file === void 0 ? void 0 : file.hash;
        return {
            file: f,
            ext,
            hash,
            getChanges: () => {
                if (!nxArgs) {
                    return [new WholeFileChange()];
                }
                if (nxArgs.files && nxArgs.files.includes(f)) {
                    return [new WholeFileChange()];
                }
                switch (ext) {
                    case '.json':
                        const atBase = readFileAtRevision(f, nxArgs.base);
                        const atHead = readFileAtRevision(f, nxArgs.head);
                        try {
                            return (0, json_diff_1.jsonDiff)(JSON.parse(atBase), JSON.parse(atHead));
                        }
                        catch (e) {
                            return [new WholeFileChange()];
                        }
                    default:
                        return [new WholeFileChange()];
                }
            },
        };
    });
}
exports.calculateFileChanges = calculateFileChanges;
exports.TEN_MEGABYTES = 1024 * 10000;
function defaultReadFileAtRevision(file, revision) {
    try {
        const fileFullPath = `${workspace_root_1.workspaceRoot}${path_1.sep}${file}`;
        const gitRepositoryPath = (0, child_process_1.execSync)('git rev-parse --show-toplevel')
            .toString()
            .trim();
        const filePathInGitRepository = (0, path_1.relative)(gitRepositoryPath, fileFullPath)
            .split(path_1.sep)
            .join('/');
        return !revision
            ? (0, fs_1.readFileSync)(file, 'utf-8')
            : (0, child_process_1.execSync)(`git show ${revision}:${filePathInGitRepository}`, {
                maxBuffer: exports.TEN_MEGABYTES,
            })
                .toString()
                .trim();
    }
    catch (_a) {
        return '';
    }
}
function readWorkspaceConfig(opts) {
    let configuration;
    try {
        const projectGraph = (0, project_graph_1.readCachedProjectGraph)();
        configuration = Object.assign(Object.assign({}, (0, configuration_1.readNxJson)()), (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph));
    }
    catch (_a) {
        const ws = new workspaces_1.Workspaces(opts.path || process.cwd());
        configuration = ws.readWorkspaceConfiguration();
    }
    if (opts.format === 'angularCli') {
        const formatted = (0, workspaces_1.toOldFormatOrNull)(configuration);
        return formatted !== null && formatted !== void 0 ? formatted : configuration;
    }
    else {
        return configuration;
    }
}
exports.readWorkspaceConfig = readWorkspaceConfig;
function workspaceFileName() {
    if ((0, fileutils_1.fileExists)(`${workspace_root_1.workspaceRoot}/angular.json`)) {
        return 'angular.json';
    }
    else {
        return 'workspace.json';
    }
}
exports.workspaceFileName = workspaceFileName;
function defaultFileRead(filePath) {
    return (0, fs_1.readFileSync)((0, path_1.join)(workspace_root_1.workspaceRoot, filePath), 'utf-8');
}
exports.defaultFileRead = defaultFileRead;
function readPackageJson() {
    return (0, fileutils_2.readJsonFile)(`${workspace_root_1.workspaceRoot}/package.json`);
}
exports.readPackageJson = readPackageJson;
//# sourceMappingURL=file-utils.js.map
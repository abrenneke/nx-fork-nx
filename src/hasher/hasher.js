"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandNamedInput = exports.splitInputsIntoSelfAndDependencies = exports.Hasher = void 0;
const tslib_1 = require("tslib");
const child_process_1 = require("child_process");
const minimatch = require("minimatch");
const fs_1 = require("fs");
const typescript_1 = require("../utils/typescript");
const hashing_impl_1 = require("./hashing-impl");
const fileutils_1 = require("../utils/fileutils");
const path_1 = require("../utils/path");
const workspace_root_1 = require("../utils/workspace-root");
const path_2 = require("path");
/**
 * The default hasher used by executors.
 */
class Hasher {
    constructor(projectGraph, nxJson, options, hashing = undefined) {
        var _a, _b;
        this.projectGraph = projectGraph;
        this.nxJson = nxJson;
        this.options = options;
        if (!hashing) {
            this.hashing = hashing_impl_1.defaultHashing;
        }
        else {
            // this is only used for testing
            this.hashing = hashing;
        }
        const legacyRuntimeInputs = (this.options && this.options.runtimeCacheInputs
            ? this.options.runtimeCacheInputs
            : []).map((r) => ({ runtime: r }));
        const legacyFilesetInputs = [
            ...Object.keys((_a = this.nxJson.implicitDependencies) !== null && _a !== void 0 ? _a : {}),
            'nx.json',
            //TODO: vsavkin move the special cases into explicit ts support
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml',
            // ignore files will change the set of inputs to the hasher
            '.gitignore',
            '.nxignore',
        ].map((d) => ({ fileset: `{workspaceRoot}/${d}` }));
        this.taskHasher = new TaskHasher(nxJson, legacyRuntimeInputs, legacyFilesetInputs, this.projectGraph, this.readTsConfig(), this.hashing, { selectivelyHashTsConfig: (_b = this.options.selectivelyHashTsConfig) !== null && _b !== void 0 ? _b : false });
    }
    hashTask(task) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const res = yield this.taskHasher.hashTask(task, [task.target.project]);
            const command = this.hashCommand(task);
            return {
                value: this.hashArray([res.value, command]),
                details: {
                    command,
                    nodes: res.details,
                    implicitDeps: {},
                    runtime: {},
                },
            };
        });
    }
    /**
     * @deprecated use hashTask instead
     */
    hashTaskWithDepsAndContext(task) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.hashTask(task);
        });
    }
    /**
     * @deprecated hashTask will hash runtime inputs and global files
     */
    hashContext() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return {
                implicitDeps: '',
                runtime: '',
            };
        });
    }
    hashCommand(task) {
        var _a, _b, _c;
        const overrides = Object.assign({}, task.overrides);
        delete overrides['__overrides_unparsed__'];
        const sortedOverrides = {};
        for (let k of Object.keys(overrides).sort()) {
            sortedOverrides[k] = overrides[k];
        }
        return this.hashing.hashArray([
            (_a = task.target.project) !== null && _a !== void 0 ? _a : '',
            (_b = task.target.target) !== null && _b !== void 0 ? _b : '',
            (_c = task.target.configuration) !== null && _c !== void 0 ? _c : '',
            JSON.stringify(sortedOverrides),
        ]);
    }
    /**
     * @deprecated use hashTask
     */
    hashSource(task) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const hash = yield this.taskHasher.hashTask(task, [task.target.project]);
            return hash.details[`${task.target.project}:$filesets`];
        });
    }
    hashArray(values) {
        return this.hashing.hashArray(values);
    }
    hashFile(path) {
        return this.hashing.hashFile(path);
    }
    readTsConfig() {
        var _a;
        var _b;
        try {
            const res = (0, fileutils_1.readJsonFile)((0, typescript_1.getRootTsConfigFileName)());
            (_a = (_b = res.compilerOptions).paths) !== null && _a !== void 0 ? _a : (_b.paths = {});
            return res;
        }
        catch (_c) {
            return {
                compilerOptions: { paths: {} },
            };
        }
    }
}
exports.Hasher = Hasher;
Hasher.version = '3.0';
const DEFAULT_INPUTS = [
    {
        projects: 'self',
        fileset: 'default',
    },
    {
        projects: 'dependencies',
        input: 'default',
    },
];
class TaskHasher {
    constructor(nxJson, legacyRuntimeInputs, legacyFilesetInputs, projectGraph, tsConfigJson, hashing, options) {
        this.nxJson = nxJson;
        this.legacyRuntimeInputs = legacyRuntimeInputs;
        this.legacyFilesetInputs = legacyFilesetInputs;
        this.projectGraph = projectGraph;
        this.tsConfigJson = tsConfigJson;
        this.hashing = hashing;
        this.options = options;
        this.filesetHashes = {};
        this.runtimeHashes = {};
    }
    hashTask(task, visited) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return Promise.resolve().then(() => tslib_1.__awaiter(this, void 0, void 0, function* () {
                var _a;
                const projectNode = this.projectGraph.nodes[task.target.project];
                if (!projectNode) {
                    return this.hashExternalDependency(task);
                }
                const projectGraphDeps = (_a = this.projectGraph.dependencies[task.target.project]) !== null && _a !== void 0 ? _a : [];
                const { selfInputs, depsInputs } = this.inputs(task, projectNode);
                const self = yield this.hashSelfInputs(task, selfInputs);
                const deps = yield this.hashDepsTasks(depsInputs, projectGraphDeps, visited);
                let details = {};
                for (const s of self) {
                    details = Object.assign(Object.assign({}, details), s.details);
                }
                for (const s of deps) {
                    details = Object.assign(Object.assign({}, details), s.details);
                }
                const value = this.hashing.hashArray([
                    ...self.map((d) => d.value),
                    ...deps.map((d) => d.value),
                ]);
                return { value, details };
            }));
        });
    }
    hashDepsTasks(inputs, projectGraphDeps, visited) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return (yield Promise.all(inputs.map((input) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                return yield Promise.all(projectGraphDeps.map((d) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    if (visited.indexOf(d.target) > -1) {
                        return null;
                    }
                    else {
                        visited.push(d.target);
                        return yield this.hashTask({
                            id: `${d.target}:$input:${input.input}`,
                            target: {
                                project: d.target,
                                target: '$input',
                                configuration: input.input,
                            },
                            overrides: {},
                        }, visited);
                    }
                })));
            }))))
                .flat()
                .filter((r) => !!r);
        });
    }
    inputs(task, projectNode) {
        if (task.target.target === '$input') {
            return {
                depsInputs: [{ input: task.target.configuration }],
                selfInputs: expandNamedInput(task.target.configuration, Object.assign(Object.assign({}, this.nxJson.namedInputs), projectNode.data.namedInputs)),
            };
        }
        else {
            const targetData = projectNode.data.targets[task.target.target];
            const targetDefaults = (this.nxJson.targetDefaults || {})[task.target.target];
            // task from TaskGraph can be added here
            return splitInputsIntoSelfAndDependencies(targetData.inputs || (targetDefaults === null || targetDefaults === void 0 ? void 0 : targetDefaults.inputs) || DEFAULT_INPUTS, Object.assign(Object.assign({}, this.nxJson.namedInputs), projectNode.data.namedInputs));
        }
    }
    hashExternalDependency(task) {
        var _a;
        const n = this.projectGraph.externalNodes[task.target.project];
        const version = (_a = n === null || n === void 0 ? void 0 : n.data) === null || _a === void 0 ? void 0 : _a.version;
        let hash;
        if (version) {
            hash = this.hashing.hashArray([version]);
        }
        else {
            // unknown dependency
            // this may occur if a file has a dependency to a npm package
            // which is not directly registestered in package.json
            // but only indirectly through dependencies of registered
            // npm packages
            // when it is at a later stage registered in package.json
            // the cache project graph will not know this module but
            // the new project graph will know it
            // The actual checksum added here is of no importance as
            // the version is unknown and may only change when some
            // other change occurs in package.json and/or package-lock.json
            hash = `__${task.target.project}__`;
        }
        return {
            value: hash,
            details: {
                [task.target.project]: version || hash,
            },
        };
    }
    hashSelfInputs(task, inputs) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const filesets = inputs
                .filter((r) => !!r['fileset'])
                .map((r) => r['fileset']);
            const projectFilesets = filesets.filter((r) => !r.startsWith('{workspaceRoot}'));
            const rootFilesets = filesets.filter((r) => r.startsWith('{workspaceRoot}/'));
            return Promise.all([
                this.hashTaskFileset(task, projectFilesets),
                ...[
                    ...rootFilesets,
                    ...this.legacyFilesetInputs.map((r) => r.fileset),
                ].map((fileset) => this.hashRootFileset(fileset)),
                ...[...inputs, ...this.legacyRuntimeInputs]
                    .filter((r) => !r['fileset'])
                    .map((r) => r['runtime'] ? this.hashRuntime(r['runtime']) : this.hashEnv(r['env'])),
            ]);
        });
    }
    hashRootFileset(fileset) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const mapKey = fileset;
            const withoutWorkspaceRoot = fileset.substring(16);
            if (!this.filesetHashes[mapKey]) {
                this.filesetHashes[mapKey] = new Promise((res) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    const parts = [];
                    if (fileset.indexOf('*') > -1) {
                        this.projectGraph.allWorkspaceFiles
                            .filter((f) => minimatch(f.file, withoutWorkspaceRoot))
                            .forEach((f) => {
                            parts.push(this.hashing.hashFile((0, path_2.join)(workspace_root_1.workspaceRoot, f.file)));
                        });
                    }
                    else {
                        if ((0, fs_1.existsSync)((0, path_2.join)(workspace_root_1.workspaceRoot, withoutWorkspaceRoot))) {
                            parts.push(this.hashing.hashFile((0, path_2.join)(workspace_root_1.workspaceRoot, withoutWorkspaceRoot)));
                        }
                    }
                    const value = this.hashing.hashArray(parts);
                    res({
                        value,
                        details: { [mapKey]: value },
                    });
                }));
            }
            return this.filesetHashes[mapKey];
        });
    }
    hashTaskFileset(task, filesetPatterns) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const mapKey = `${task.target.project}:$filesets`;
            if (!this.filesetHashes[mapKey]) {
                this.filesetHashes[mapKey] = new Promise((res) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    const p = this.projectGraph.nodes[task.target.project];
                    const filteredFiles = this.filterFiles(p.data.files, filesetPatterns);
                    const fileNames = filteredFiles.map((f) => f.file);
                    const values = filteredFiles.map((f) => f.hash);
                    let tsConfig;
                    tsConfig = this.hashTsConfig(p);
                    const value = this.hashing.hashArray([
                        ...fileNames,
                        ...values,
                        JSON.stringify(Object.assign(Object.assign({}, p.data), { files: undefined })),
                        tsConfig,
                    ]);
                    res({
                        value,
                        details: { [mapKey]: value },
                    });
                }));
            }
            return this.filesetHashes[mapKey];
        });
    }
    hashRuntime(runtime) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const mapKey = `runtime:${runtime}`;
            if (!this.runtimeHashes[mapKey]) {
                this.runtimeHashes[mapKey] = new Promise((res, rej) => {
                    (0, child_process_1.exec)(runtime, (err, stdout, stderr) => {
                        if (err) {
                            rej(new Error(`Nx failed to execute {runtime: '${runtime}'}. ${err}.`));
                        }
                        else {
                            const value = `${stdout}${stderr}`.trim();
                            res({
                                details: { [`runtime:${runtime}`]: value },
                                value,
                            });
                        }
                    });
                });
            }
            return this.runtimeHashes[mapKey];
        });
    }
    hashEnv(envVarName) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const value = this.hashing.hashArray([process.env[envVarName]]);
            return {
                details: { [`runtime:${envVarName}`]: value },
                value,
            };
        });
    }
    filterFiles(files, patterns) {
        patterns = patterns.filter((p) => p !== 'default');
        if (patterns.length === 0)
            return files;
        return files.filter((f) => !!patterns.find((pattern) => minimatch(f.file, pattern)));
    }
    hashTsConfig(p) {
        if (this.options.selectivelyHashTsConfig) {
            return this.removeOtherProjectsPathRecords(p);
        }
        else {
            return JSON.stringify(this.tsConfigJson);
        }
    }
    removeOtherProjectsPathRecords(p) {
        var _a, _b;
        const _c = this.tsConfigJson.compilerOptions, { paths } = _c, compilerOptions = tslib_1.__rest(_c, ["paths"]);
        const rootPath = p.data.root.split('/');
        rootPath.shift();
        const pathAlias = (0, path_1.getImportPath)((_a = this.nxJson) === null || _a === void 0 ? void 0 : _a.npmScope, rootPath.join('/'));
        return JSON.stringify({
            compilerOptions: Object.assign(Object.assign({}, compilerOptions), { paths: {
                    [pathAlias]: (_b = paths[pathAlias]) !== null && _b !== void 0 ? _b : [],
                } }),
        });
    }
}
function splitInputsIntoSelfAndDependencies(inputs, namedInputs) {
    const depsInputs = [];
    const selfInputs = [];
    for (const d of inputs) {
        if (typeof d === 'string') {
            if (d.startsWith('^')) {
                depsInputs.push({ input: d.substring(1) });
            }
            else {
                selfInputs.push(d);
            }
        }
        else {
            if (d.projects === 'dependencies') {
                depsInputs.push(d);
            }
            else {
                selfInputs.push(d);
            }
        }
    }
    return { depsInputs, selfInputs: expandSelfInputs(selfInputs, namedInputs) };
}
exports.splitInputsIntoSelfAndDependencies = splitInputsIntoSelfAndDependencies;
function expandSelfInputs(inputs, namedInputs) {
    const expanded = [];
    for (const d of inputs) {
        if (typeof d === 'string') {
            if (d.startsWith('^'))
                throw new Error(`namedInputs definitions cannot start with ^`);
            if (namedInputs[d]) {
                expanded.push(...expandNamedInput(d, namedInputs));
            }
            else {
                expanded.push({ fileset: d });
            }
        }
        else {
            if (d.projects === 'dependencies') {
                throw new Error(`namedInputs definitions cannot contain any inputs with projects == 'dependencies'`);
            }
            if (d.fileset || d.env || d.runtime) {
                expanded.push(d);
            }
            else {
                expanded.push(...expandNamedInput(d.input, namedInputs));
            }
        }
    }
    return expanded;
}
function expandNamedInput(input, namedInputs) {
    if (input === 'default')
        return [{ fileset: 'default' }];
    namedInputs || (namedInputs = {});
    if (!namedInputs[input])
        throw new Error(`Input '${input}' is not defined`);
    return expandSelfInputs(namedInputs[input], namedInputs);
}
exports.expandNamedInput = expandNamedInput;
//# sourceMappingURL=hasher.js.map
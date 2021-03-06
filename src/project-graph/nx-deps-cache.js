"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCachedFileData = exports.shouldRecomputeWholeGraph = exports.writeCacheIfNecessary = exports.createCache = exports.readCache = exports.ensureCacheDirectory = exports.nxDepsPath = void 0;
const fs_1 = require("fs");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const perf_hooks_1 = require("perf_hooks");
const cache_directory_1 = require("../utils/cache-directory");
const fileutils_1 = require("../utils/fileutils");
const fileutils_2 = require("../utils/fileutils");
const json_diff_1 = require("../utils/json-diff");
exports.nxDepsPath = (0, path_1.join)(cache_directory_1.projectGraphCacheDirectory, 'nxdeps.json');
function ensureCacheDirectory() {
    try {
        if (!(0, fs_1.existsSync)(cache_directory_1.projectGraphCacheDirectory)) {
            (0, fs_extra_1.ensureDirSync)(cache_directory_1.projectGraphCacheDirectory);
        }
    }
    catch (e) {
        /*
         * @jeffbcross: Node JS docs recommend against checking for existence of directory immediately before creating it.
         * Instead, just try to create the directory and handle the error.
         *
         * We ran into race conditions when running scripts concurrently, where multiple scripts were
         * arriving here simultaneously, checking for directory existence, then trying to create the directory simultaneously.
         *
         * In this case, we're creating the directory. If the operation failed, we ensure that the directory
         * exists before continuing (or raise an exception).
         */
        if (!(0, fileutils_1.directoryExists)(cache_directory_1.projectGraphCacheDirectory)) {
            throw new Error(`Failed to create directory: ${cache_directory_1.projectGraphCacheDirectory}`);
        }
    }
}
exports.ensureCacheDirectory = ensureCacheDirectory;
function readCache() {
    perf_hooks_1.performance.mark('read cache:start');
    ensureCacheDirectory();
    let data = null;
    try {
        if ((0, fileutils_1.fileExists)(exports.nxDepsPath)) {
            data = (0, fileutils_2.readJsonFile)(exports.nxDepsPath);
        }
    }
    catch (error) {
        console.log(`Error reading '${exports.nxDepsPath}'. Continue the process without the cache.`);
        console.log(error);
    }
    perf_hooks_1.performance.mark('read cache:end');
    perf_hooks_1.performance.measure('read cache', 'read cache:start', 'read cache:end');
    return data !== null && data !== void 0 ? data : null;
}
exports.readCache = readCache;
function createCache(nxJson, packageJsonDeps, projectGraph, tsConfig) {
    var _a;
    const nxJsonPlugins = (nxJson.plugins || []).map((p) => ({
        name: p,
        version: packageJsonDeps[p],
    }));
    const newValue = {
        version: projectGraph.version || '5.0',
        deps: packageJsonDeps,
        // compilerOptions may not exist, especially for repos converted through add-nx-to-monorepo
        pathMappings: ((_a = tsConfig === null || tsConfig === void 0 ? void 0 : tsConfig.compilerOptions) === null || _a === void 0 ? void 0 : _a.paths) || {},
        nxJsonPlugins,
        nodes: projectGraph.nodes,
        externalNodes: projectGraph.externalNodes,
        dependencies: projectGraph.dependencies,
    };
    return newValue;
}
exports.createCache = createCache;
function writeCacheIfNecessary(cache, existingCache) {
    if (existingCache && (0, json_diff_1.deepEquals)(cache, existingCache)) {
        return;
    }
    perf_hooks_1.performance.mark('write cache:start');
    (0, fileutils_2.writeJsonFile)(exports.nxDepsPath, cache);
    perf_hooks_1.performance.mark('write cache:end');
    perf_hooks_1.performance.measure('write cache', 'write cache:start', 'write cache:end');
}
exports.writeCacheIfNecessary = writeCacheIfNecessary;
function shouldRecomputeWholeGraph(cache, packageJsonDeps, workspaceJson, nxJson, tsConfig) {
    if (cache.version !== '5.0') {
        return true;
    }
    if (cache.deps['@nrwl/workspace'] !== packageJsonDeps['@nrwl/workspace']) {
        return true;
    }
    // we have a cached project that is no longer present
    if (Object.keys(cache.nodes).some((p) => (cache.nodes[p].type === 'app' ||
        cache.nodes[p].type === 'lib' ||
        cache.nodes[p].type === 'e2e') &&
        !workspaceJson.projects[p])) {
        return true;
    }
    // a path mapping for an existing project has changed
    if (Object.keys(cache.pathMappings).some((t) => {
        var _a, _b;
        const cached = cache.pathMappings && cache.pathMappings[t]
            ? JSON.stringify(cache.pathMappings[t])
            : undefined;
        const notCached = ((_a = tsConfig === null || tsConfig === void 0 ? void 0 : tsConfig.compilerOptions) === null || _a === void 0 ? void 0 : _a.paths) && ((_b = tsConfig === null || tsConfig === void 0 ? void 0 : tsConfig.compilerOptions) === null || _b === void 0 ? void 0 : _b.paths[t])
            ? JSON.stringify(tsConfig.compilerOptions.paths[t])
            : undefined;
        return cached !== notCached;
    })) {
        return true;
    }
    // a new plugin has been added
    if ((nxJson.plugins || []).length !== cache.nxJsonPlugins.length)
        return true;
    // a plugin has changed
    if ((nxJson.plugins || []).some((t) => {
        const matchingPlugin = cache.nxJsonPlugins.find((p) => p.name === t);
        if (!matchingPlugin)
            return true;
        return matchingPlugin.version !== packageJsonDeps[t];
    })) {
        return true;
    }
    return false;
}
exports.shouldRecomputeWholeGraph = shouldRecomputeWholeGraph;
/*
This can only be invoked when the list of projects is either the same
or new projects have been added, so every project in the cache has a corresponding
project in fileMap
*/
function extractCachedFileData(fileMap, c) {
    const filesToProcess = {};
    const cachedFileData = {};
    const currentProjects = Object.keys(fileMap).filter((name) => fileMap[name].length > 0);
    currentProjects.forEach((p) => {
        processProjectNode(p, c.nodes[p], cachedFileData, filesToProcess, fileMap);
    });
    return {
        filesToProcess,
        cachedFileData,
    };
}
exports.extractCachedFileData = extractCachedFileData;
function processProjectNode(name, cachedNode, cachedFileData, filesToProcess, fileMap) {
    if (!cachedNode) {
        filesToProcess[name] = fileMap[name];
        return;
    }
    const fileDataFromCache = {};
    for (let f of cachedNode.data.files) {
        fileDataFromCache[f.file] = f;
    }
    if (!cachedFileData[name]) {
        cachedFileData[name] = {};
    }
    for (let f of fileMap[name]) {
        const fromCache = fileDataFromCache[f.file];
        if (fromCache && fromCache.hash == f.hash) {
            cachedFileData[name][f.file] = fromCache;
        }
        else {
            if (!filesToProcess[cachedNode.name]) {
                filesToProcess[cachedNode.name] = [];
            }
            filesToProcess[cachedNode.name].push(f);
        }
    }
}
//# sourceMappingURL=nx-deps-cache.js.map
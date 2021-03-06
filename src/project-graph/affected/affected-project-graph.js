"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterAffected = void 0;
const file_utils_1 = require("../file-utils");
const workspace_projects_1 = require("./locators/workspace-projects");
const npm_packages_1 = require("./locators/npm-packages");
const implicit_json_changes_1 = require("./locators/implicit-json-changes");
const normalize_nx_json_1 = require("../normalize-nx-json");
const workspace_json_changes_1 = require("./locators/workspace-json-changes");
const tsconfig_json_changes_1 = require("./locators/tsconfig-json-changes");
const operators_1 = require("../operators");
const configuration_1 = require("../../config/configuration");
function filterAffected(graph, touchedFiles, nxJson = (0, configuration_1.readNxJson)(), packageJson = (0, file_utils_1.readPackageJson)()) {
    const normalizedNxJson = (0, normalize_nx_json_1.normalizeNxJson)(nxJson, Object.keys(graph.nodes));
    // Additional affected logic should be in this array.
    const touchedProjectLocators = [
        workspace_projects_1.getTouchedProjects,
        workspace_projects_1.getImplicitlyTouchedProjects,
        npm_packages_1.getTouchedNpmPackages,
        implicit_json_changes_1.getImplicitlyTouchedProjectsByJsonChanges,
        workspace_json_changes_1.getTouchedProjectsInWorkspaceJson,
        tsconfig_json_changes_1.getTouchedProjectsFromTsConfig,
    ];
    const touchedProjects = touchedProjectLocators.reduce((acc, f) => {
        return acc.concat(f(touchedFiles, graph.nodes, normalizedNxJson, packageJson, graph));
    }, []);
    return filterAffectedProjects(graph, {
        projectGraphNodes: graph.nodes,
        nxJson: normalizedNxJson,
        touchedProjects,
    });
}
exports.filterAffected = filterAffected;
// -----------------------------------------------------------------------------
function filterAffectedProjects(graph, ctx) {
    const result = {
        nodes: {},
        externalNodes: {},
        dependencies: {},
    };
    const reversed = (0, operators_1.reverse)(graph);
    ctx.touchedProjects.forEach((p) => {
        addAffectedNodes(p, reversed, result, []);
    });
    ctx.touchedProjects.forEach((p) => {
        addAffectedDependencies(p, reversed, result, []);
    });
    return result;
}
function addAffectedNodes(startingProject, reversed, result, visited) {
    var _a;
    if (visited.indexOf(startingProject) > -1)
        return;
    const reversedNode = reversed.nodes[startingProject];
    const reversedExternalNode = reversed.externalNodes[startingProject];
    if (!reversedNode && !reversedExternalNode) {
        throw new Error(`Invalid project name is detected: "${startingProject}"`);
    }
    visited.push(startingProject);
    if (reversedNode) {
        result.nodes[startingProject] = reversedNode;
        result.dependencies[startingProject] = [];
    }
    else {
        result.externalNodes[startingProject] = reversedExternalNode;
    }
    (_a = reversed.dependencies[startingProject]) === null || _a === void 0 ? void 0 : _a.forEach(({ target }) => addAffectedNodes(target, reversed, result, visited));
}
function addAffectedDependencies(startingProject, reversed, result, visited) {
    if (visited.indexOf(startingProject) > -1)
        return;
    visited.push(startingProject);
    if (reversed.dependencies[startingProject]) {
        reversed.dependencies[startingProject].forEach(({ target }) => addAffectedDependencies(target, reversed, result, visited));
        reversed.dependencies[startingProject].forEach(({ type, source, target }) => {
            // Since source and target was reversed,
            // we need to reverse it back to original direction.
            if (!result.dependencies[target]) {
                result.dependencies[target] = [];
            }
            result.dependencies[target].push({
                type,
                source: target,
                target: source,
            });
        });
    }
}
//# sourceMappingURL=affected-project-graph.js.map
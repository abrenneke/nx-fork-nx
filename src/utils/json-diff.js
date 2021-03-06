"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepEquals = exports.walkJsonTree = exports.jsonDiff = exports.isJsonChange = exports.DiffType = void 0;
var DiffType;
(function (DiffType) {
    DiffType["Deleted"] = "JsonPropertyDeleted";
    DiffType["Added"] = "JsonPropertyAdded";
    DiffType["Modified"] = "JsonPropertyModified";
})(DiffType = exports.DiffType || (exports.DiffType = {}));
function isJsonChange(change) {
    return (change.type === DiffType.Added ||
        change.type === DiffType.Deleted ||
        change.type === DiffType.Modified);
}
exports.isJsonChange = isJsonChange;
function jsonDiff(lhs, rhs) {
    const result = [];
    const seenInLhs = new Set();
    walkJsonTree(lhs, [], (path, lhsValue) => {
        seenInLhs.add(hashArray(path));
        const rhsValue = getJsonValue(path, rhs);
        if (rhsValue === undefined) {
            result.push({
                type: DiffType.Deleted,
                path,
                value: {
                    lhs: lhsValue,
                    rhs: undefined,
                },
            });
        }
        else if (!deepEquals(lhsValue, rhsValue)) {
            result.push({
                type: DiffType.Modified,
                path,
                value: {
                    lhs: lhsValue,
                    rhs: rhsValue,
                },
            });
        }
        return typeof lhsValue === 'object' || Array.isArray(lhsValue);
    });
    walkJsonTree(rhs, [], (path, rhsValue) => {
        const addedInRhs = !seenInLhs.has(hashArray(path));
        if (addedInRhs) {
            result.push({
                type: DiffType.Added,
                path,
                value: {
                    lhs: undefined,
                    rhs: rhsValue,
                },
            });
        }
        return typeof rhsValue === 'object' || Array.isArray(rhsValue);
    });
    return result;
}
exports.jsonDiff = jsonDiff;
// Depth-first walk down JSON tree.
function walkJsonTree(json, currPath, visitor) {
    if (!json || typeof json !== 'object') {
        return;
    }
    Object.keys(json).forEach((key) => {
        const path = currPath.concat([key]);
        const shouldContinue = visitor(path, json[key]);
        if (shouldContinue) {
            walkJsonTree(json[key], path, visitor);
        }
    });
}
exports.walkJsonTree = walkJsonTree;
function hashArray(ary) {
    return JSON.stringify(ary);
}
function getJsonValue(path, json) {
    let curr = json;
    for (const k of path) {
        curr = curr[k];
        if (curr === undefined) {
            break;
        }
    }
    return curr;
}
function deepEquals(a, b) {
    if (a === b) {
        return true;
    }
    // Values do not need to be checked for deep equality and the above is false
    if (
    // Values are different types
    typeof a !== typeof b ||
        // Values are the same type but not an object or array
        (typeof a !== 'object' && !Array.isArray(a)) ||
        // Objects are the same type, objects or arrays, but do not have the same number of keys
        Object.keys(a).length !== Object.keys(b).length) {
        return false;
    }
    // Values need to be checked for deep equality
    return Object.entries(a).reduce((equal, [key, aValue]) => {
        // Skip other keys if it is already not equal.
        if (!equal) {
            return equal;
        }
        // Traverse the object
        return deepEquals(aValue, b[key]);
    }, true);
}
exports.deepEquals = deepEquals;
//# sourceMappingURL=json-diff.js.map
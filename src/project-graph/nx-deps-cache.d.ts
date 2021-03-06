import { FileData, ProjectFileMap, ProjectGraph, ProjectGraphDependency, ProjectGraphExternalNode, ProjectGraphNode } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectsConfigurations } from '../config/workspace-json-project-json';
export interface ProjectGraphCache {
    version: string;
    deps: Record<string, string>;
    pathMappings: Record<string, any>;
    nxJsonPlugins: {
        name: string;
        version: string;
    }[];
    nodes: Record<string, ProjectGraphNode>;
    externalNodes?: Record<string, ProjectGraphExternalNode>;
    dependencies: Record<string, ProjectGraphDependency[]>;
}
export declare const nxDepsPath: string;
export declare function ensureCacheDirectory(): void;
export declare function readCache(): null | ProjectGraphCache;
export declare function createCache(nxJson: NxJsonConfiguration<'*' | string[]>, packageJsonDeps: Record<string, string>, projectGraph: ProjectGraph, tsConfig: {
    compilerOptions?: {
        paths?: {
            [p: string]: any;
        };
    };
}): ProjectGraphCache;
export declare function writeCacheIfNecessary(cache: ProjectGraphCache, existingCache: ProjectGraphCache | null): void;
export declare function shouldRecomputeWholeGraph(cache: ProjectGraphCache, packageJsonDeps: Record<string, string>, workspaceJson: ProjectsConfigurations, nxJson: NxJsonConfiguration, tsConfig: {
    compilerOptions: {
        paths: {
            [k: string]: any;
        };
    };
}): boolean;
export declare function extractCachedFileData(fileMap: ProjectFileMap, c: ProjectGraphCache): {
    filesToProcess: ProjectFileMap;
    cachedFileData: {
        [project: string]: {
            [file: string]: FileData;
        };
    };
};

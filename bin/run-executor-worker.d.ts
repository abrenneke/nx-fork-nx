import { Task } from '../src/config/task-graph';
import { ProjectGraph } from '../src/config/project-graph';
interface ExecuteTaskOptions {
    workspaceRoot: string;
    outputPath?: string;
    streamOutput?: boolean;
    captureStderr?: boolean;
    projectGraph?: ProjectGraph;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
}
export declare function executeTask(task: Task, options: ExecuteTaskOptions): Promise<{
    statusCode: number;
    error?: string;
}>;
export {};

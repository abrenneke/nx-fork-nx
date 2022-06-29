import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { Batch } from './tasks-schedule';
import { Task } from '../config/task-graph';
import { BatchResults } from './batch/batch-messages';
import { ProjectGraph } from '../config/project-graph';
export declare class JestWorkerTaskRunner {
    private readonly options;
    private readonly projectGraph;
    workspaceRoot: string;
    cliPath: string;
    private processes;
    private worker;
    constructor(options: DefaultTasksRunnerOptions, projectGraph: ProjectGraph);
    forkProcessForBatch({ executorName, taskGraph, }: Batch): Promise<BatchResults>;
    executeTask(task: Task, { streamOutput, temporaryOutputPath, }: {
        streamOutput: boolean;
        temporaryOutputPath: string;
    }): Promise<{
        code: number;
        terminalOutput: string;
    }>;
    private readTerminalOutput;
    private getNxEnvVariablesForForkedProcess;
    private setupOnProcessExitListener;
}

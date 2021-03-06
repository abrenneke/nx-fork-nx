/// <reference types="node" />
import type { AsyncSubscription, Event } from '@parcel/watcher';
import { Server } from 'net';
export declare type WatcherSubscription = AsyncSubscription;
export declare type SubscribeToWorkspaceChangesCallback = (err: Error | null, changeEvents: Event[] | null) => Promise<void>;
export declare function subscribeToWorkspaceChanges(server: Server, cb: SubscribeToWorkspaceChangesCallback): Promise<AsyncSubscription>;
/**
 * NOTE: An event type of "create" will also apply to the case where the user has restored
 * an original version of a file after modifying/deleting it by using git, so we adjust
 * our log language accordingly.
 */
export declare function convertChangeEventsToLogMessage(changeEvents: Event[]): string;

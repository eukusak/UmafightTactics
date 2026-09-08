import type { OnlineCommand } from './protocol';
/** Installed by the websocket client. Prevents store commands from mutating network snapshots. */
export const onlineBridge: { send: ((command: OnlineCommand) => void) | null; leave: (() => void) | null } = { send: null, leave: null };

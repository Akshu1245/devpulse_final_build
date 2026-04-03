/**
 * Graceful Shutdown Service Stub
 * Re-exports from _core/gracefulShutdown
 */

import { Server } from 'http';

export function gracefulShutdown(server: Server): void {
	server.close(() => {
		process.exit(0);
	});

	// Hard-exit fallback to avoid hanging forever.
	setTimeout(() => process.exit(1), 10000);
}

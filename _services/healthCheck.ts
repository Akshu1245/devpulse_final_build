/**
 * Health Check Service Stub
 * Re-exports from _core/healthCheck
 */

export function healthCheckRoute(_req: any, res: any) {
	res.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
	});
}

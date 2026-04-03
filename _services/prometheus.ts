/**
 * Prometheus Metrics Service Stub
 * Re-exports from _core/prometheus
 */

import { register, metricsMiddleware } from '../_core/prometheus';

export { metricsMiddleware };

export async function metricsRoute(_req: any, res: any) {
	res.set('Content-Type', register.contentType);
	res.end(await register.metrics());
}

/**
 * HTTP Access Log Middleware
 * ==========================
 * Logs all HTTP requests to the database for shadow API detection
 * Uses fire-and-forget pattern to avoid blocking requests
 */

import { Request, Response, NextFunction } from 'express';
import { logHttpAccessEvent, type InsertHttpAccessLog } from '../db';

interface DevPulseRequest extends Request {
  requestId?: string;
  user?: { id: number; workspaceId?: number };
  startTime?: number;
}

/**
 * Middleware to log HTTP access events
 * Captures method, path, status, response time, user agent, IP
 */
export function httpAccessLogMiddleware(
  req: DevPulseRequest,
  res: Response,
  next: NextFunction
) {
  // Record start time
  req.startTime = Date.now();

  // Hook into response finish to capture status and timing
  res.on('finish', () => {
    const responseTimeMs = Date.now() - (req.startTime || Date.now());
    
    // Extract workspace ID from authenticated user or from query/body
    const workspaceId = 
      req.user?.workspaceId || 
      (req.query?.workspaceId ? parseInt(req.query.workspaceId as string) : null) ||
      (req.body?.workspaceId ? parseInt(req.body.workspaceId as string) : null) ||
      null;

    // Prepare log event
    const logEvent: InsertHttpAccessLog = {
      workspaceId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      latencyMs: responseTimeMs,
      userAgent: req.get('user-agent') || null,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      userId: req.user?.id || null,
      requestTimestamp: req.startTime || Date.now(),
    };

    // Fire-and-forget: log asynchronously without blocking
    logHttpAccessEvent(logEvent).catch(err => {
      console.error('[HTTP Access Log] Failed to log request:', err);
    });
  });

  next();
}

// Admin API for alert management
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createMiddleware } from '@/lib/middleware';
import {
  evaluateAllAlerts,
  getAlertConditions,
  getRecentAlerts,
  incrementCounter,
  logger,
  triggerAlert,
  updateAlertCondition,
} from '@/lib/monitoring';

/**
 * GET /api/admin/alerts - Get alert conditions and recent alerts
 * Query params:
 *   - events: true | false - include recent alert events
 *   - limit: number of events to return (default: 20)
 */
export const GET = createMiddleware(
  { requireSecret: { key: 'INGEST_SECRET' }, rateLimit: 'ADMIN', securityHeaders: true },
  async (request: NextRequest) => {
    void incrementCounter('admin_metrics_requests_total', 1, { endpoint: 'alerts' }).catch(() => {});

    const { searchParams } = new URL(request.url);
    const includeEvents = searchParams.get('events') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    try {
      const [conditions, events] = await Promise.all([
        getAlertConditions(),
        includeEvents ? getRecentAlerts(limit) : [],
      ]);

      return NextResponse.json({
        timestamp: Date.now(),
        conditions,
        events,
        eventCount: events.length,
      });
    } catch (error) {
      await logger.error('Failed to fetch alerts', { error });
      return NextResponse.json(
        { error: 'failed_to_fetch_alerts', message: String(error) },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/admin/alerts - Create, update, or evaluate alerts
 */
export const POST = createMiddleware(
  { requireSecret: { key: 'INGEST_SECRET' }, rateLimit: 'ADMIN', securityHeaders: true },
  async (request: NextRequest) => {
    void incrementCounter('admin_metrics_requests_total', 1, {
      endpoint: 'alerts',
      method: 'POST',
    }).catch(() => {});

    const schema = z.object({
      action: z.enum(['trigger', 'evaluate', 'update']),
      conditionId: z.string().optional(),
      alert: z
        .object({
          conditionId: z.string(),
          severity: z.enum(['info', 'warning', 'critical']),
          message: z.string(),
          data: z.record(z.unknown()).optional(),
        })
        .optional(),
      condition: z.any().optional(),
    });

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, alert, condition } = parsed.data;

    try {
      switch (action) {
        case 'trigger': {
          if (!alert) {
            return NextResponse.json(
              {
                error: 'alert_required',
                message: 'Alert details are required for trigger action',
              },
              { status: 400 }
            );
          }

          const conditions = await getAlertConditions();
          const alertCondition = conditions.find((c) => c.id === alert.conditionId);

          if (!alertCondition) {
            return NextResponse.json(
              {
                error: 'condition_not_found',
                message: 'Alert condition not found',
              },
              { status: 404 }
            );
          }

          const event = await triggerAlert(
            alertCondition,
            alert.severity,
            alert.message,
            alert.data || {}
          );

          return NextResponse.json({
            ok: true,
            event,
            message: 'Alert triggered successfully',
          });
        }

        case 'evaluate': {
          await evaluateAllAlerts();
          return NextResponse.json({
            ok: true,
            message: 'All alert conditions evaluated',
          });
        }

        case 'update': {
          if (!condition) {
            return NextResponse.json(
              {
                error: 'condition_required',
                message: 'Condition is required for update action',
              },
              { status: 400 }
            );
          }

          const updated = await updateAlertCondition(condition);

          return NextResponse.json({
            ok: updated,
            message: updated ? 'Condition updated' : 'Failed to update condition',
          });
        }

        default:
          return NextResponse.json(
            { error: 'invalid_action', message: 'Unknown action' },
            { status: 400 }
          );
      }
    } catch (err) {
      await logger.error('Failed to process alert action', { error: err });
      return NextResponse.json({ error: 'action_failed', message: String(err) }, { status: 500 });
    }
  }
);

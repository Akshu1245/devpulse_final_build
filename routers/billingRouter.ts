// @ts-nocheck
import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import * as schema from '../schema';
import { eq, and } from 'drizzle-orm';
import StripeBillingService from '../_core/stripeBillingService';
import MeteringService from '../_core/meteringService';

/**
 * PHASE 11: Billing tRPC Router
 * Handles subscription management, invoicing, usage metering, and quota enforcement
 */

declare global {
  var stripeBillingService: StripeBillingService;
  var meteringService: MeteringService;
}

const CreateCustomerSchema = z.object({
  email: z.string().email(),
  companyName: z.string().optional(),
  paymentMethodId: z.string().optional(),
});

const CreateSubscriptionSchema = z.object({
  planId: z.string(),
  priceId: z.string(),
  paymentMethodId: z.string().optional(),
});

const RecordUsageSchema = z.object({
  metric: z.string(),
  value: z.number().positive(),
  metadata: z.record(z.any()).optional(),
});

const GetUsageReportSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
});

export const billingRouter = router({
  /**
   * Initialize billing for customer
   */
  initializeBilling: protectedProcedure
    .input(CreateCustomerSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }
      
      try {
        // Check if already initialized
        const existing = await db
          .select()
          .from(schema.billingCustomers)
          .where(eq(schema.billingCustomers.customerId, ctx.user.id))
          .limit(1);

        if (existing.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Billing already initialized for this customer',
          });
        }

        // Create Stripe customer
        const stripeCustomerId = await global.stripeBillingService.createCustomer({
          customerId: ctx.user.id,
          organizationId: ctx.user.organizationId || '',
          email: input.email,
          name: input.companyName || ctx.user.name,
        });

        // Save billing customer
        const billingCustomerId = crypto.randomUUID();
        await db.insert(schema.billingCustomers).values({
          id: billingCustomerId,
          customerId: ctx.user.id,
          stripeCustomerId,
          email: input.email,
          companyName: input.companyName,
          paymentMethodId: input.paymentMethodId,
          createdAt: new Date(),
        });

        return {
          success: true,
          customerId: ctx.user.id,
          stripeCustomerId,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to initialize billing',
          cause: error,
        });
      }
    }),

  /**
   * Get or create subscription
   */
  subscribe: protectedProcedure
    .input(CreateSubscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const billingCustomer = await db.query.billingCustomers.findFirst({
          where: eq(schema.billingCustomers.customerId, ctx.user.id),
        });

        if (!billingCustomer?.stripeCustomerId) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Billing not initialized. Call initializeBilling first.',
          });
        }

        // Create subscription
        const subscriptionId = await global.stripeBillingService.createSubscription({
          customerId: ctx.user.id,
          stripeCustomerId: billingCustomer.stripeCustomerId,
          planId: input.planId,
          priceId: input.priceId,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });

        return {
          success: true,
          subscriptionId,
          customerId: ctx.user.id,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create subscription',
          cause: error,
        });
      }
    }),

  /**
   * Get current subscription
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(schema.subscriptions.customerId, ctx.user.id),
          eq(schema.subscriptions.status, 'active' as const)
        ),
      });

      if (!subscription) {
        return null;
      }

      const plan = await db.query.billingPlans.findFirst({
        where: eq(schema.billingPlans.id, subscription.planId),
      });

      return {
        id: subscription.id,
        planId: subscription.planId,
        plan: plan ? {
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          tier: plan.tier,
        } : null,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get subscription',
        cause: error,
      });
    }
  }),

  /**
   * Cancel subscription
   */
  cancelSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const subscription = await db.query.subscriptions.findFirst({
          where: and(
            eq(schema.subscriptions.id, input.subscriptionId),
            eq(schema.subscriptions.customerId, ctx.user.id)
          ),
        });

        if (!subscription) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subscription not found',
          });
        }

        await global.stripeBillingService.cancelSubscription(subscription.stripeSubscriptionId || '');

        return { success: true, subscriptionId: input.subscriptionId };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel subscription',
          cause: error,
        });
      }
    }),

  /**
   * Record usage metric
   */
  recordUsage: protectedProcedure
    .input(RecordUsageSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        await global.meteringService.recordUsage({
          customerId: ctx.user.id,
          metric: input.metric,
          value: input.value,
          timestamp: new Date(),
          metadata: input.metadata,
        });

        // Check quota
        const exceeded = await global.meteringService.checkQuota(ctx.user.id, input.metric);

        return {
          success: true,
          metric: input.metric,
          value: input.value,
          quotaExceeded: exceeded,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to record usage',
          cause: error,
        });
      }
    }),

  /**
   * Get current usage
   */
  getCurrentUsage: protectedProcedure
    .input(z.object({
      metric: z.string(),
      period: z.enum(['day', 'month', 'year']),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const usage = await global.meteringService.getCurrentUsage(
          ctx.user.id,
          input.metric,
          input.period
        );

        // Get quota
        const subscription = await db.query.subscriptions.findFirst({
          where: and(
            eq(schema.subscriptions.customerId, ctx.user.id),
            eq(schema.subscriptions.status, 'active' as const)
          ),
        });

        let quota = null;
        if (subscription) {
          const plan = await db.query.billingPlans.findFirst({
            where: eq(schema.billingPlans.id, subscription.planId),
          });

          if (plan) {
            const quotas = JSON.parse(plan.quotas || '{}');
            quota = quotas[input.metric];
          }
        }

        return {
          metric: input.metric,
          period: input.period,
          value: usage,
          quota,
          percentageUsed: quota ? (usage / quota.limit) * 100 : 0,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get usage',
          cause: error,
        });
      }
    }),

  /**
   * Get usage report
   */
  getUsageReport: protectedProcedure
    .input(GetUsageReportSchema)
    .query(async ({ input, ctx }) => {
      try {
        const report = await global.meteringService.getUsageReport(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        if (!report) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No subscription found',
          });
        }

        return report;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get usage report',
          cause: error,
        });
      }
    }),

  /**
   * Get invoices
   */
  getInvoices: protectedProcedure
    .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      try {
        const limit = input.limit || 10;
        const offset = input.offset || 0;

        const invoices = await db.query.invoices.findMany({
          where: eq(schema.invoices.customerId, ctx.user.id),
          limit,
          offset,
          orderBy: (t) => t.createdAt,
        });

        const total = await db
          .select({ count: 1 })
          .from(schema.invoices)
          .where(eq(schema.invoices.customerId, ctx.user.id));

        return {
          invoices: invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            amount: inv.amount,
            status: inv.status,
            dueDate: inv.dueDate,
            issuedDate: inv.issuedDate,
            paidDate: inv.paidDate,
          })),
          total: total.length,
          limit,
          offset,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get invoices',
          cause: error,
        });
      }
    }),

  /**
   * Get billing portal session
   */
  getBillingPortal: protectedProcedure
    .input(z.object({ returnUrl: z.string().url() }))
    .query(async ({ input, ctx }) => {
      try {
        const billingCustomer = await db.query.billingCustomers.findFirst({
          where: eq(schema.billingCustomers.customerId, ctx.user.id),
        });

        if (!billingCustomer?.stripeCustomerId) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Billing not initialized',
          });
        }

        const portalUrl = await global.stripeBillingService.getBillingPortalSession(
          billingCustomer.stripeCustomerId,
          input.returnUrl
        );

        return { portalUrl };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get billing portal',
          cause: error,
        });
      }
    }),

  /**
   * List available plans
   */
  listPlans: publicProcedure.query(async () => {
    try {
      const plans = await db.query.billingPlans.findMany({
        where: eq(schema.billingPlans.isActive, true),
        orderBy: (t) => t.monthlyPrice,
      });

      return plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        monthlyPrice: p.monthlyPrice,
        annualPrice: p.annualPrice,
        tier: p.tier,
        features: JSON.parse(p.features || '{}'),
        quotas: JSON.parse(p.quotas || '{}'),
      }));
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to list plans',
        cause: error,
      });
    }
  }),

  /**
   * Handle webhook from Stripe
   */
  webhookEvent: publicProcedure
    .input(z.object({
      signature: z.string(),
      body: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const event = global.stripeBillingService.verifyWebhookSignature(
          input.body,
          input.signature
        );

        await global.stripeBillingService.handleWebhook(event);

        return { success: true, eventId: event.id };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process webhook',
          cause: error,
        });
      }
    }),
});

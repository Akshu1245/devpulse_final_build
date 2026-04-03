// @ts-nocheck
import Stripe from 'stripe';
import { db } from '../db';
import { schema } from '../schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from 'pino';
import { EventEmitter } from 'events';

/**
 * Stripe Billing Service
 * Handles all Stripe payment processing, subscription management, and webhook handling
 * Integrates with DevPulse metering for usage-based billing
 */

export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  apiVersion?: string;
}

export interface CustomerMetadata {
  customerId: string;
  organizationId: string;
  email: string;
  name: string;
}

export interface SubscriptionData {
  customerId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt?: Date;
  metadata?: Record<string, string>;
}

export interface InvoiceData {
  customerId: string;
  subscriptionId: string;
  amount: number;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  dueDate: Date;
  paidDate?: Date;
  invoiceNumber: string;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
  metadata?: Record<string, string>;
}

export interface UsageRecord {
  customerId: string;
  metric: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, string>;
}

export class StripeBillingService extends EventEmitter {
  private stripe: Stripe;
  private logger: Logger;
  private config: StripeConfig;

  constructor(config: StripeConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: (config.apiVersion as any) || '2023-10-16',
    });

    this.logger.info('StripeBillingService initialized');
  }

  /**
   * Create a customer in Stripe
   */
  async createCustomer(data: CustomerMetadata): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        metadata: {
          customerId: data.customerId,
          organizationId: data.organizationId,
        },
      });

      this.logger.info(
        { stripeCustomerId: customer.id, customerId: data.customerId },
        'Created Stripe customer'
      );

      this.emit('customer_created', { customerId: data.customerId, stripeCustomerId: customer.id });

      return customer.id;
    } catch (error) {
      this.logger.error(
        { error, customerId: data.customerId },
        'Failed to create Stripe customer'
      );
      throw error;
    }
  }

  /**
   * Create or update a subscription
   */
  async createSubscription(data: SubscriptionData & { stripeCustomerId: string; priceId: string }): Promise<string> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: data.stripeCustomerId,
        items: [{ price: data.priceId }],
        metadata: {
          customerId: data.customerId,
          planId: data.planId,
          ...data.metadata,
        },
        payment_behavior: 'error_if_incomplete',
      });

      // Save to database
      await db.insert(schema.subscriptions).values({
        customerId: data.customerId,
        stripeSubscriptionId: subscription.id,
        planId: data.planId,
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        createdAt: new Date(),
      });

      this.logger.info(
        { stripeSubscriptionId: subscription.id, customerId: data.customerId },
        'Created subscription'
      );

      this.emit('subscription_created', {
        customerId: data.customerId,
        subscriptionId: subscription.id,
        planId: data.planId,
      });

      return subscription.id;
    } catch (error) {
      this.logger.error(
        { error, customerId: data.customerId },
        'Failed to create subscription'
      );
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      this.logger.error(
        { error, subscriptionId },
        'Failed to retrieve subscription'
      );
      return null;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediately = false): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: !immediately,
      });

      // Update database
      await db
        .update(schema.subscriptions)
        .set({
          status: subscription.status as any,
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        })
        .where(eq(schema.subscriptions.stripeSubscriptionId, subscriptionId));

      this.logger.info(
        { subscriptionId, immediately },
        'Canceled subscription'
      );

      this.emit('subscription_canceled', { subscriptionId });

      return subscription;
    } catch (error) {
      this.logger.error(
        { error, subscriptionId },
        'Failed to cancel subscription'
      );
      throw error;
    }
  }

  /**
   * Record usage for metered billing
   */
  async recordUsage(data: UsageRecord): Promise<void> {
    try {
      // Get customer's subscription
      const subscription = await db.query.subscriptions
        .findFirst({
          where: eq(schema.subscriptions.customerId, data.customerId),
        });

      if (!subscription) {
        this.logger.warn(
          { customerId: data.customerId },
          'No active subscription found for usage record'
        );
        return;
      }

      // Record in database
      await db.insert(schema.usageRecords).values({
        customerId: data.customerId,
        subscriptionId: subscription.id,
        metric: data.metric,
        value: data.value,
        timestamp: data.timestamp,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      });

      this.emit('usage_recorded', {
        customerId: data.customerId,
        metric: data.metric,
        value: data.value,
      });
    } catch (error) {
      this.logger.error(
        { error, customerId: data.customerId },
        'Failed to record usage'
      );
      throw error;
    }
  }

  /**
   * Report usage metrics to Stripe for metered billing
   * Syncs usage data to Stripe's subscription usage records
   */
  async reportUsageToStripe(
    customerId: string,
    subscriptionId: string,
    metrics: Array<{
      metric: string;
      quantity: number;
      timestamp: Date;
    }>
  ): Promise<void> {
    try {
      // Get subscription to find usage-based items
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      
      for (const metric of metrics) {
        // Find matching subscription item for this metric
        const usageItem = subscription.items.data.find(
          (item: any) => item.price?.metadata?.metric === metric.metric
        );

        if (usageItem) {
          // Report usage to Stripe
          await this.stripe.subscriptionItems.createUsageRecord(
            usageItem.id,
            {
              quantity: metric.quantity,
              timestamp: Math.floor(metric.timestamp.getTime() / 1000),
              action: 'increment',
            }
          );

          this.logger.info({
            customerId,
            metric: metric.metric,
            quantity: metric.quantity,
          }, 'Reported usage to Stripe');
        }
      }
    } catch (error) {
      this.logger.error({ error, customerId, metrics }, 'Failed to report usage to Stripe');
      throw error;
    }
  }

  /**
   * Generate invoice for usage
   */
  async createInvoice(data: InvoiceData & { stripeCustomerId: string }): Promise<Stripe.Invoice> {
    try {
      // Create line items
      const lineItems = data.lineItems.map((item) => ({
        description: item.description,
        amount: item.amount,
        quantity: item.quantity,
      }));

      // Create invoice in Stripe
      const invoice = await this.stripe.invoices.create({
        customer: data.stripeCustomerId,
        subscription: data.subscriptionId,
        metadata: {
          customerId: data.customerId,
          ...data.metadata,
        },
        auto_advance: true,
      });

      // Add line items
      for (const item of lineItems) {
        await this.stripe.invoiceItems.create({
          invoice: invoice.id,
          customer: data.stripeCustomerId,
          description: item.description,
          amount: item.amount,
          quantity: item.quantity,
        });
      }

      // Finalize invoice
      await this.stripe.invoices.finalizeInvoice(invoice.id);

      // Save to database
      await db.insert(schema.invoices).values({
        customerId: data.customerId,
        stripeInvoiceId: invoice.id,
        amount: data.amount,
        status: invoice.status as any,
        dueDate: data.dueDate,
        invoiceNumber: invoice.number || '',
        createdAt: new Date(),
      });

      this.logger.info(
        { invoiceId: invoice.id, customerId: data.customerId, amount: data.amount },
        'Created invoice'
      );

      this.emit('invoice_created', {
        customerId: data.customerId,
        invoiceId: invoice.id,
        amount: data.amount,
      });

      return invoice;
    } catch (error) {
      this.logger.error(
        { error, customerId: data.customerId },
        'Failed to create invoice'
      );
      throw error;
    }
  }

  /**
   * Get customer invoices
   */
  async getInvoices(customerId: string, stripeCustomerId: string): Promise<Stripe.Invoice[]> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 100,
      });

      return invoices.data || [];
    } catch (error) {
      this.logger.error(
        { error, customerId },
        'Failed to retrieve invoices'
      );
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoiceFailed(event.data.object as Stripe.Invoice);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          this.logger.debug({ eventType: event.type }, 'Unhandled webhook event');
      }

      this.emit('webhook_processed', { eventId: event.id, type: event.type });
    } catch (error) {
      this.logger.error({ error, eventId: event.id }, 'Failed to handle webhook');
      throw error;
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.metadata?.customerId;
    if (!customerId) return;

    await db
      .update(schema.subscriptions)
      .set({
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      })
      .where(eq(schema.subscriptions.stripeSubscriptionId, subscription.id));

    this.emit('subscription_updated', { customerId, subscriptionId: subscription.id });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.metadata?.customerId;
    if (!customerId) return;

    await db
      .update(schema.subscriptions)
      .set({ status: 'canceled' as const, canceledAt: new Date() })
      .where(eq(schema.subscriptions.stripeSubscriptionId, subscription.id));

    this.emit('subscription_deleted', { customerId });
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.metadata?.customerId;
    if (!customerId) return;

    await db
      .update(schema.invoices)
      .set({ status: 'paid' as const, paidDate: new Date() })
      .where(eq(schema.invoices.stripeInvoiceId, invoice.id));

    this.emit('invoice_paid', { customerId, invoiceId: invoice.id, amount: invoice.amount_paid });
  }

  private async handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.metadata?.customerId;
    if (!customerId) return;

    await db
      .update(schema.invoices)
      .set({ status: 'uncollectible' as const })
      .where(eq(schema.invoices.stripeInvoiceId, invoice.id));

    this.emit('invoice_failed', { customerId, invoiceId: invoice.id });
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    this.logger.info(
      { chargeId: charge.id, amount: charge.amount_refunded },
      'Charge refunded'
    );

    this.emit('charge_refunded', { chargeId: charge.id, amountRefunded: charge.amount_refunded });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(body, signature, this.config.webhookSecret);
    } catch (error) {
      this.logger.error({ error }, 'Failed to verify webhook signature');
      throw error;
    }
  }

  /**
   * Get billing portal session
   */
  async getBillingPortalSession(stripeCustomerId: string, returnUrl: string): Promise<string> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      this.logger.error({ error, stripeCustomerId }, 'Failed to create billing portal session');
      throw error;
    }
  }
}

export default StripeBillingService;

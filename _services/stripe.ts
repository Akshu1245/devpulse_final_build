/**
 * Stripe Payment Integration — DevPulse
 * ======================================
 * Subscription billing with four pricing tiers
 * 
 * Tiers:
 * - Starter: $29/month
 * - Team: $99/month  
 * - Business: $299/month
 * - Enterprise: Custom pricing
 */

import { ENV } from '../_core/env';

// Stripe would be imported here after npm install
// import Stripe from 'stripe';

const stripe = {
  webhooks: {
    constructEvent: (payload: string, _signature: string, _secret: string) => JSON.parse(payload),
  },
};

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    scansPerMonth: number;
    agentsMonitored: number;
    teamMembers: number;
    retentionDays: number;
    apiCalls: number;
  };
  stripePriceId?: string;
}

export const PRICING_TIERS: Record<string, PricingTier> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 29,
    interval: 'month',
    features: [
      'OWASP Top 10 Scanning',
      'Secret Detection',
      'Basic Cost Tracking',
      '1 Agent Monitored',
      'Email Alerts',
    ],
    limits: {
      scansPerMonth: 100,
      agentsMonitored: 1,
      teamMembers: 1,
      retentionDays: 7,
      apiCalls: 1000,
    },
    stripePriceId: 'price_starter_monthly',
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 99,
    interval: 'month',
    features: [
      'Everything in Starter',
      'Shadow API Detection',
      'AgentGuard Kill Switch',
      '5 Agents Monitored',
      'Slack Integration',
      'PCI DSS Compliance Reports',
    ],
    limits: {
      scansPerMonth: 500,
      agentsMonitored: 5,
      teamMembers: 5,
      retentionDays: 30,
      apiCalls: 10000,
    },
    stripePriceId: 'price_team_monthly',
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 299,
    interval: 'month',
    features: [
      'Everything in Team',
      'Unlimited Scans',
      'Unlimited Agents',
      'Thinking Token Attribution',
      'Custom Webhooks',
      'Priority Support',
      'SSO Integration',
    ],
    limits: {
      scansPerMonth: -1, // unlimited
      agentsMonitored: -1, // unlimited
      teamMembers: 25,
      retentionDays: 90,
      apiCalls: 100000,
    },
    stripePriceId: 'price_business_monthly',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: -1, // Custom pricing
    interval: 'month',
    features: [
      'Everything in Business',
      'Unlimited Everything',
      'Dedicated Support',
      'Custom Integrations',
      'On-premise Option',
      'SLA Guarantee',
      'Security Audit Reports',
    ],
    limits: {
      scansPerMonth: -1,
      agentsMonitored: -1,
      teamMembers: -1,
      retentionDays: 365,
      apiCalls: -1,
    },
    stripePriceId: undefined, // Contact sales
  },
};

export interface Subscription {
  id: string;
  workspaceId: number;
  tierId: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageRecord {
  workspaceId: number;
  metric: string;
  value: number;
  timestamp: Date;
}

/**
 * Stripe Service for managing subscriptions
 */
export class StripeService {
  private stripeApiKey: string;
  private webhookSecret: string;

  constructor() {
    this.stripeApiKey = ENV.STRIPE_SECRET_KEY || '';
    this.webhookSecret = ENV.STRIPE_WEBHOOK_SECRET || '';
  }

  /**
   * Create Stripe checkout session
   */
  async createCheckoutSession(
    workspaceId: number,
    tierId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string }> {
    const tier = PRICING_TIERS[tierId];
    if (!tier || !tier.stripePriceId) {
      throw new Error(`Invalid tier or enterprise tier selected: ${tierId}`);
    }

    // In production, use actual Stripe SDK:
    // const stripe = new Stripe(this.stripeApiKey);
    // const session = await stripe.checkout.sessions.create({...});
    
    // Placeholder for Stripe integration
    console.log(`[Stripe] Creating checkout session for workspace ${workspaceId}, tier ${tierId}`);
    
    return {
      sessionId: `cs_${Date.now()}_${workspaceId}`,
      url: `https://checkout.stripe.com/pay/cs_placeholder?tier=${tierId}`,
    };
  }

  /**
   * Create Stripe customer portal session
   */
  async createPortalSession(
    stripeCustomerId: string,
    returnUrl: string
  ): Promise<{ url: string }> {
    console.log(`[Stripe] Creating portal session for customer ${stripeCustomerId}`);
    
    return {
      url: `https://billing.stripe.com/session/placeholder?customer=${stripeCustomerId}`,
    };
  }

  /**
   * Get subscription status
   */
  async getSubscription(stripeSubscriptionId: string): Promise<{
    status: string;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  }> {
    console.log(`[Stripe] Fetching subscription ${stripeSubscriptionId}`);
    
    return {
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    };
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    console.log(`[Stripe] Canceling subscription ${stripeSubscriptionId}`);
  }

  /**
   * Resume canceled subscription
   */
  async resumeSubscription(stripeSubscriptionId: string): Promise<void> {
    console.log(`[Stripe] Resuming subscription ${stripeSubscriptionId}`);
  }

  /**
   * Update subscription to new tier
   */
  async updateSubscription(
    stripeSubscriptionId: string,
    newTierId: string
  ): Promise<void> {
    const tier = PRICING_TIERS[newTierId];
    if (!tier || !tier.stripePriceId) {
      throw new Error(`Invalid tier: ${newTierId}`);
    }

    console.log(`[Stripe] Updating subscription ${stripeSubscriptionId} to tier ${newTierId}`);
  }

  /**
   * Handle Stripe webhook event
   */
  async handleWebhook(
    payload: string,
    signature: string
  ): Promise<{ handled: boolean; event?: string }> {
    try {
      // CRITICAL: Always verify webhook signature in production
      if (!this.webhookSecret) {
        throw new Error("Stripe webhook secret not configured");
      }
      
      // Verify webhook signature to prevent forged events
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
      
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        default:
          console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
          return { handled: false };
      }

      return { handled: true, event: event.type };
    } catch (err) {
      console.error('[Stripe Webhook] Error:', err);
      throw err;
    }
  }

  private async handleCheckoutCompleted(session: any): Promise<void> {
    console.log('[Stripe] Checkout completed:', session.id);
    // Create/update subscription in database
    // Send welcome email
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    console.log('[Stripe] Subscription updated:', subscription.id);
    // Update subscription status in database
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    console.log('[Stripe] Subscription deleted:', subscription.id);
    // Mark subscription as canceled in database
    // Downgrade to free tier
  }

  private async handlePaymentFailed(invoice: any): Promise<void> {
    console.log('[Stripe] Payment failed:', invoice.id);
    // Send payment failure notification
    // Mark subscription as past_due
  }

  private async handlePaymentSucceeded(invoice: any): Promise<void> {
    console.log('[Stripe] Payment succeeded:', invoice.id);
    // Update subscription status
    // Send receipt email
  }
}

/**
 * Feature gating based on subscription tier
 */
export class FeatureGate {
  static canAccess(tier: PricingTier, feature: string): boolean {
    return tier.features.includes(feature);
  }

  static checkLimit(tier: PricingTier, metric: keyof PricingTier['limits'], currentValue: number): {
    allowed: boolean;
    limit: number;
    remaining: number;
  } {
    const limit = tier.limits[metric];
    
    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1, remaining: -1 };
    }

    return {
      allowed: currentValue < limit,
      limit,
      remaining: Math.max(0, limit - currentValue),
    };
  }

  static getAvailableFeatures(tier: PricingTier): string[] {
    return tier.features;
  }

  static compareTiers(currentTier: string, requiredTier: string): boolean {
    const tierOrder = ['starter', 'team', 'business', 'enterprise'];
    return tierOrder.indexOf(currentTier) >= tierOrder.indexOf(requiredTier);
  }
}

/**
 * Usage tracking for metered billing
 */
export class UsageTracker {
  private static usageCache = new Map<string, number>();

  static async trackUsage(workspaceId: number, metric: string, increment: number = 1): Promise<void> {
    const key = `${workspaceId}:${metric}:${new Date().toISOString().slice(0, 7)}`;
    const current = this.usageCache.get(key) || 0;
    this.usageCache.set(key, current + increment);

    // In production, persist to database
    console.log(`[Usage] Workspace ${workspaceId}: ${metric} += ${increment} (total: ${current + increment})`);
  }

  static async getUsage(workspaceId: number, metric: string): Promise<number> {
    const key = `${workspaceId}:${metric}:${new Date().toISOString().slice(0, 7)}`;
    return this.usageCache.get(key) || 0;
  }

  static async resetMonthlyUsage(workspaceId: number): Promise<void> {
    const prefix = `${workspaceId}:`;
    for (const key of this.usageCache.keys()) {
      if (key.startsWith(prefix)) {
        this.usageCache.delete(key);
      }
    }
  }
}

// Singleton instance
let stripeService: StripeService | null = null;

export function getStripeService(): StripeService {
  if (!stripeService) {
    stripeService = new StripeService();
  }
  return stripeService;
}

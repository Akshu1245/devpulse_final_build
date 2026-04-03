import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../utils/trpc';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AlertCircle, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatting';

/**
 * PHASE 11: Billing Dashboard
 * Displays subscription status, usage metrics, invoices, and cost breakdown
 */

interface UsageMetric {
  metric: string;
  value: number;
  quota?: number;
  percentageUsed: number;
}

export const BillingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('all');

  // Get current subscription
  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const result = await trpc.billing.getSubscription.query();
      return result;
    },
  });

  // Get usage report
  const { data: usageReport, isLoading: reportLoading } = useQuery({
    queryKey: ['usageReport', selectedPeriod],
    queryFn: async () => {
      const now = new Date();
      let startDate = new Date();

      if (selectedPeriod === 'day') {
        startDate.setDate(now.getDate() - 1);
      } else if (selectedPeriod === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      return await trpc.billing.getUsageReport.query({ startDate, endDate: now });
    },
  });

  // Get invoices
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      return await trpc.billing.getInvoices.query({ limit: 10 });
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      return await trpc.billing.cancelSubscription.mutate({ subscriptionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });

  // Get billing portal mutation
  const portalMutation = useMutation({
    mutationFn: async () => {
      return await trpc.billing.getBillingPortal.mutate({
        returnUrl: window.location.href,
      });
    },
    onSuccess: (data) => {
      window.location.href = data.portalUrl;
    },
  });

  if (subscriptionLoading) {
    return <div className="p-6">Loading billing information...</div>;
  }

  // Subscription Status Section
  const SubscriptionStatus: React.FC = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Subscription Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {subscription ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Current Plan</p>
              <p className="text-2xl font-bold capitalize">{subscription.plan?.name}</p>
              <p className="text-sm text-gray-500">Tier: {subscription.plan?.tier}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Monthly Cost</p>
              <p className="text-2xl font-bold">
                {formatCurrency(subscription.plan?.monthlyPrice || 0)}
              </p>
              <p className="text-sm text-gray-500">Billed monthly</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Period End</p>
              <p className="text-lg font-semi bold">
                {formatDate(subscription.currentPeriodEnd)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => portalMutation.mutate()}
                className="mt-2"
              >
                Manage Subscription
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">No active subscription</p>
            <Button className="mt-4">Upgrade Plan</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Usage Metrics Section
  const UsageMetrics: React.FC = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Usage Metrics
        </CardTitle>
        <div className="flex gap-2 mt-4">
          {(['day', 'month', 'year'] as const).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {usageReport && (
          <div className="space-y-4">
            {usageReport.metrics.map((metric) => (
              <div key={metric.metric} className="border-b pb-4 last:border-b-0">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-semibold">{metric.metric}</p>
                  <p className="text-lg font-bold">{metric.value.toLocaleString()}</p>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min((metric.value / (metric.value || 1)) * 100, 100)}%`,
                    }}
                  />
                </div>

                {metric.overageCharge && (
                  <p className="text-sm text-gray-600 mt-1">
                    Overage charge: {formatCurrency(metric.overageCharge)}
                  </p>
                )}
              </div>
            ))}

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Estimated Monthly Cost</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(usageReport.totalCost)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Usage Chart
  const UsageChart: React.FC = () => {
    if (!usageReport) return null;

    const chartData = usageReport.metrics.map((m) => ({
      name: m.metric,
      value: m.value,
      cost: m.overageCharge || 0,
    }));

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="value" fill="#3b82f6" name="Usage" />
              <Bar yAxisId="right" dataKey="cost" fill="#ef4444" name="Cost ($)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  // Invoices Section
  const InvoicesSection: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
        <div className="flex gap-2 mt-4">
          {['all', 'paid', 'unpaid'].map((filter) => (
            <Button
              key={filter}
              variant={invoiceFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInvoiceFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {invoicesData ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Invoice</th>
                  <th className="text-left py-3 px-4 font-semibold">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoicesData.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">{invoice.invoiceNumber}</td>
                    <td className="py-3 px-4">{formatCurrency(invoice.amount)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4">{formatDate(invoice.issuedDate)}</td>
                    <td className="py-3 px-4">
                      <Button size="sm" variant="outline">
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 text-center py-8">No invoices found</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Billing & Usage</h1>
        <p className="text-gray-600 mb-8">Manage your subscription, track usage, and view invoices</p>

        <SubscriptionStatus />
        <UsageMetrics />
        <UsageChart />
        <InvoicesSection />
      </div>
    </div>
  );
};

export default BillingPage;

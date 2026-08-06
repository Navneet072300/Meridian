import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useProfileStore } from '../store/profileStore';
import {
  PageContainer,
  GlassCard,
  PremiumButton,
  PremiumBadge,
} from '../components/shared/UIPrimitives';

type BillingCycle = 'monthly' | 'annual';

export interface Plan {
  id: 'free' | 'pro' | 'team' | 'enterprise';
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  badge?: string;
  highlighted: boolean;
  features: string[];
  cta: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free', name: 'Free',
    monthlyPrice: 0, annualPrice: 0,
    highlighted: false,
    features: [
      '1 cluster connection',
      '50 AI requests / day',
      '3 pipeline runs / day',
      'Deploy, Generate & Diagnose modes',
      'Community support',
      '7-day history',
    ],
    cta: 'Current Plan',
  },
  {
    id: 'pro', name: 'Pro',
    monthlyPrice: 49, annualPrice: 39,
    badge: 'Most Popular', highlighted: true,
    features: [
      '5 cluster connections',
      'Unlimited AI requests',
      'Unlimited pipeline runs',
      'Design & Monitor modes',
      'Custom model endpoints (Ollama)',
      'API key access',
      '90-day history',
      'Priority email support',
    ],
    cta: 'Upgrade to Pro',
  },
  {
    id: 'team', name: 'Team',
    monthlyPrice: 199, annualPrice: 169,
    badge: 'New', highlighted: false,
    features: [
      '15 cluster connections',
      'Up to 10 team seats (RBAC)',
      'Unlimited everything',
      'Vault & ArgoCD integrations',
      'Slack notifications',
      'Audit log (1-year retention)',
      'SSO / Google / GitHub IdP',
      '365-day history',
    ],
    cta: 'Upgrade to Team',
  },
  {
    id: 'enterprise', name: 'Enterprise',
    monthlyPrice: 0, annualPrice: 0,
    highlighted: false,
    features: [
      'Unlimited clusters',
      'Unlimited team seats',
      'SAML / OIDC SSO',
      'On-premise deployment',
      'Dedicated Slack support',
      'SLA 99.9% uptime',
      'Custom AI fine-tuning',
      'Compliance & SOC2 exports',
    ],
    cta: 'Contact Sales',
  },
];

export default function SubscriptionPage() {
  const { plan: currentPlan, setProfile } = useProfileStore();
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  const handleUpgrade = (planId: string) => {
    if (planId === 'enterprise') return;
    setProfile({ plan: planId as any });
  };

  return (
    <PageContainer>
      <div className="space-y-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <PremiumBadge variant="purple" pulse>
            ✦ Simple & Transparent Billing
          </PremiumBadge>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Scale your AI Infrastructure
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Choose the plan that fits your engineering team's deployment velocity.
          </p>

          <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mt-2">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                billing === 'monthly'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                billing === 'annual'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((p) => {
            const isCurrent = currentPlan === p.id;
            const price = billing === 'annual' ? p.annualPrice : p.monthlyPrice;

            return (
              <GlassCard
                key={p.id}
                glow={p.highlighted}
                className={`p-6 flex flex-col justify-between ${
                  p.highlighted ? 'border-purple-500/50 bg-purple-500/5 dark:bg-purple-950/20' : ''
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{p.name}</h3>
                    {p.badge && <PremiumBadge variant="purple">{p.badge}</PremiumBadge>}
                  </div>

                  <div>
                    {p.id === 'enterprise' ? (
                      <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">Custom</span>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">${price}</span>
                        <span className="text-xs text-zinc-400">/month</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                        <Check size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <PremiumButton
                    disabled={isCurrent}
                    onClick={() => handleUpgrade(p.id)}
                    variant={p.highlighted ? 'primary' : 'secondary'}
                    className="w-full"
                  >
                    {isCurrent ? 'Current Plan' : p.cta}
                  </PremiumButton>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}

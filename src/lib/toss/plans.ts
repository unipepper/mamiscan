export const PLANS = {
  scan5: {
    orderNamePrefix: 'scan5',
    orderName: '마미스캔 5회 추가권',
    amount: 1800,
    grant: { type: 'scan', count: 5, validDays: 14 } as const,
  },
  monthly: {
    orderNamePrefix: 'monthly',
    orderName: '마미스캔 1개월 무제한 이용권',
    amount: 5800,
    grant: { type: 'subscription', days: 30 } as const,
  },
} as const;

export type PlanType = keyof typeof PLANS;

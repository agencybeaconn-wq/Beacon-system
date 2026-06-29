import { useState } from 'react';

export type OnboardingStep =
    | 'welcome'
    | 'connect-meta'
    | 'select-accounts'
    | 'configure-account'
    | 'pixel'
    | 'pages'
    | 'goals'
    | 'complete';

export interface OnboardingData {
    businessName: string;
    segment: string;
    selectedAccounts: string[];
    currentAccountIndex: number;
    accountConfigs: Record<string, {
        pixelId?: string;
        pageId?: string;
        instagramId?: string;
        primaryKpi?: 'ROAS' | 'CPA' | 'CPL';
        targetValue?: number;
        riskThreshold?: number;
    }>;
}

const INITIAL_DATA: OnboardingData = {
    businessName: '',
    segment: '',
    selectedAccounts: [],
    currentAccountIndex: 0,
    accountConfigs: {},
};

export const useOnboardingState = () => {
    const [step, setStep] = useState<OnboardingStep>('welcome');
    const [data, setData] = useState<OnboardingData>(() => {
        const saved = localStorage.getItem('lads_onboarding_progress');
        return saved ? JSON.parse(saved) : INITIAL_DATA;
    });

    const updateData = (updates: Partial<OnboardingData>) => {
        setData(prev => {
            const newData = { ...prev, ...updates };
            localStorage.setItem('lads_onboarding_progress', JSON.stringify(newData));
            return newData;
        });
    };

    const updateAccountConfig = (accountId: string, config: OnboardingData['accountConfigs'][string]) => {
        setData(prev => {
            const newData = {
                ...prev,
                accountConfigs: {
                    ...prev.accountConfigs,
                    [accountId]: { ...prev.accountConfigs[accountId], ...config }
                }
            };
            localStorage.setItem('lads_onboarding_progress', JSON.stringify(newData));
            return newData;
        });
    };

    const getCurrentAccountId = () => {
        return data.selectedAccounts[data.currentAccountIndex];
    };

    const nextAccount = () => {
        if (data.currentAccountIndex < data.selectedAccounts.length - 1) {
            updateData({ currentAccountIndex: data.currentAccountIndex + 1 });
            setStep('pixel');
            return true;
        }
        return false;
    };

    const clearProgress = () => {
        localStorage.removeItem('lads_onboarding_progress');
        setData(INITIAL_DATA);
        setStep('welcome');
    };

    const completeOnboarding = () => {
        localStorage.setItem('lads_onboarding_complete', 'true');
        localStorage.removeItem('lads_onboarding_progress');
    };

    const isOnboardingComplete = () => {
        return localStorage.getItem('lads_onboarding_complete') === 'true';
    };

    return {
        step,
        setStep,
        data,
        updateData,
        updateAccountConfig,
        getCurrentAccountId,
        nextAccount,
        clearProgress,
        completeOnboarding,
        isOnboardingComplete,
    };
};

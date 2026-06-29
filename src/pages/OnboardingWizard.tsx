import React from 'react';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { WizardLayout, FIRST_ACCESS_STEPS, ACCOUNT_CONFIG_STEPS } from '@/components/onboarding/WizardLayout';
import { WelcomeStep } from '@/components/onboarding/steps/WelcomeStep';
import { ConnectMetaStep } from '@/components/onboarding/steps/ConnectMetaStep';
import { SelectAccountsStep } from '@/components/onboarding/steps/SelectAccountsStep';
import { PixelStep } from '@/components/onboarding/steps/PixelStep';
import { PagesStep } from '@/components/onboarding/steps/PagesStep';
import { GoalsStep } from '@/components/onboarding/steps/GoalsStep';
import { CompletionStep } from '@/components/onboarding/steps/CompletionStep';
import { supabase } from '@/integrations/supabase/client';

const OnboardingWizard = () => {
    const {
        step,
        setStep,
        data,
        updateData,
        updateAccountConfig,
        getCurrentAccountId,
        nextAccount,
        completeOnboarding,
    } = useOnboardingState();

    // Bypass onboarding for Meta Reviewer
    React.useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.email === 'meta-reviewer@leverads.io') {
                console.log('🛡️ [BYPASS] Reviewer detected, skipping onboarding...');
                completeOnboarding();
                window.location.href = '/';
            }
        });
    }, [completeOnboarding]);

    const currentAccountId = getCurrentAccountId();
    const currentConfig = currentAccountId ? data.accountConfigs[currentAccountId] || {} : {};
    const hasMoreAccounts = data.currentAccountIndex < data.selectedAccounts.length - 1;

    // Determine which step list to show
    const isFirstAccessPhase = ['welcome', 'connect-meta', 'select-accounts'].includes(step);
    const steps = isFirstAccessPhase ? FIRST_ACCESS_STEPS : ACCOUNT_CONFIG_STEPS;

    // Save account settings to Supabase
    const saveAccountConfig = async (accountId: string) => {
        const config = data.accountConfigs[accountId];
        if (!config) return;

        try {
            await (supabase as any)
                .from('account_settings')
                .upsert({
                    ad_account_id: accountId,
                    primary_kpi: config.primaryKpi || 'ROAS',
                    target_value: config.targetValue || 6.0,
                    risk_threshold: config.riskThreshold || 3.0,
                    max_frequency: 3.0,
                    default_pixel_id: config.pixelId,
                    default_page_id: config.pageId,
                    default_instagram_id: config.instagramId,
                });
        } catch (err) {
            console.error('Error saving account config:', err);
        }
    };

    const handleNextAccount = async () => {
        if (currentAccountId) {
            await saveAccountConfig(currentAccountId);
        }

        if (nextAccount()) {
            // More accounts to configure
        } else {
            completeOnboarding();
        }
    };

    const handleFinish = async () => {
        if (currentAccountId) {
            await saveAccountConfig(currentAccountId);
        }
        completeOnboarding();
    };

    const renderStep = () => {
        switch (step) {
            case 'welcome':
                return (
                    <WelcomeStep
                        businessName={data.businessName}
                        segment={data.segment}
                        onUpdate={updateData}
                        onNext={() => setStep('connect-meta')}
                    />
                );

            case 'connect-meta':
                return (
                    <ConnectMetaStep
                        onNext={() => setStep('select-accounts')}
                        onBack={() => setStep('welcome')}
                    />
                );

            case 'select-accounts':
                return (
                    <SelectAccountsStep
                        selectedAccounts={data.selectedAccounts}
                        onUpdate={(accounts) => updateData({ selectedAccounts: accounts })}
                        onNext={() => setStep('pixel')}
                        onBack={() => setStep('connect-meta')}
                    />
                );

            case 'pixel':
                return (
                    <PixelStep
                        accountId={currentAccountId!}
                        selectedPixelId={currentConfig.pixelId}
                        onUpdate={(pixelId) => updateAccountConfig(currentAccountId!, { pixelId })}
                        onNext={() => setStep('pages')}
                        onBack={() => setStep('select-accounts')}
                    />
                );

            case 'pages':
                return (
                    <PagesStep
                        accountId={currentAccountId!}
                        selectedPageId={currentConfig.pageId}
                        selectedInstagramId={currentConfig.instagramId}
                        onUpdate={(data) => updateAccountConfig(currentAccountId!, data)}
                        onNext={() => setStep('goals')}
                        onBack={() => setStep('pixel')}
                    />
                );

            case 'goals':
                return (
                    <GoalsStep
                        primaryKpi={currentConfig.primaryKpi}
                        targetValue={currentConfig.targetValue}
                        riskThreshold={currentConfig.riskThreshold}
                        onUpdate={(data) => updateAccountConfig(currentAccountId!, data)}
                        onNext={() => setStep('complete')}
                        onBack={() => setStep('pages')}
                    />
                );

            case 'complete':
                return (
                    <CompletionStep
                        accountName={`Conta ${data.currentAccountIndex + 1}`}
                        config={currentConfig}
                        hasMoreAccounts={hasMoreAccounts}
                        onNextAccount={handleNextAccount}
                        onFinish={handleFinish}
                    />
                );

            default:
                return <div>Step not found</div>;
        }
    };

    return (
        <WizardLayout currentStep={step} steps={steps}>
            {renderStep()}
        </WizardLayout>
    );
};

export default OnboardingWizard;

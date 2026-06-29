import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AccountType = 'owner' | 'agency';

interface AccountTypeContextValue {
    accountType: AccountType;
    setAccountType: (type: AccountType) => void;
    isAgency: boolean;
    isOwner: boolean;
    isLoading: boolean;
    setIsAgency: (value: boolean) => void;
}

const AccountTypeContext = createContext<AccountTypeContextValue | undefined>(undefined);

export function AccountTypeProvider({ children }: { children: ReactNode }) {
    const [accountType, setAccountTypeState] = useState<AccountType>('agency'); // Default to agency mode
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load from localStorage for now (can be migrated to Supabase user_settings later)
        const stored = localStorage.getItem('lads_account_type') as AccountType | null;
        if (stored && (stored === 'owner' || stored === 'agency')) {
            setAccountTypeState(stored);
        }
        setIsLoading(false);
    }, []);

    const setAccountType = (type: AccountType) => {
        console.log('[AccountTypeContext] Setting account type to:', type);
        setAccountTypeState(type);
        localStorage.setItem('lads_account_type', type);
    };

    const setIsAgency = (value: boolean) => {
        const newType = value ? 'agency' : 'owner';
        setAccountType(newType);
    };

    return (
        <AccountTypeContext.Provider
            value={{
                accountType,
                setAccountType,
                isAgency: accountType === 'agency',
                isOwner: accountType === 'owner',
                isLoading,
                setIsAgency,
            }}
        >
            {children}
        </AccountTypeContext.Provider>
    );
}

export function useAccountType() {
    const context = useContext(AccountTypeContext);
    if (!context) {
        throw new Error('useAccountType must be used within an AccountTypeProvider');
    }
    return context;
}


import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AcademyStudent, AcademyEnrollment } from '@/hooks/useAcademy';

interface AcademyContextValue {
  student: AcademyStudent | null;
  enrollments: AcademyEnrollment[];
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasAccessTo: (moduleId: string) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AcademyContext = createContext<AcademyContextValue | undefined>(undefined);

export function AcademyProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<AcademyStudent | null>(null);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Track last known user id pra ignorar eventos do Supabase que não mudam o usuário
  // (ex: TOKEN_REFRESHED ao voltar de outra aba do navegador)
  const lastUserIdRef = useRef<string | null>(null);

  const loadStudent = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        lastUserIdRef.current = null;
        setStudent(null); setEnrollments([]); setIsAuthenticated(false);
        return;
      }
      lastUserIdRef.current = session.user.id;
      setIsAuthenticated(true);

      let { data: studentRow } = await (supabase as any)
        .from('academy_students')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      // Self-healing: se autenticado mas sem academy_students (ex: signup antes do
      // trigger existir, ou user do Portal tentando acessar /academy), cria a linha.
      if (!studentRow) {
        const meta = session.user.user_metadata || {};
        const { data: inserted } = await (supabase as any)
          .from('academy_students')
          .insert({
            user_id: session.user.id,
            full_name: meta.full_name || session.user.email?.split('@')[0] || 'Aluno',
            email: session.user.email || '',
            phone: meta.phone || null,
            plan: 'none',
          })
          .select()
          .single();
        studentRow = inserted || null;
      } else {
        // Sync client-side: se metadata do auth tiver valor mais recente, atualiza
        // o student row. Trigger SQL também cobre; isto é fallback pra UI imediata.
        const meta = session.user.user_metadata || {};
        const updates: Record<string, any> = {};
        if (meta.full_name && meta.full_name !== studentRow.full_name) updates.full_name = meta.full_name;
        if (meta.phone && meta.phone !== studentRow.phone) updates.phone = meta.phone;
        if (session.user.email && session.user.email !== studentRow.email) updates.email = session.user.email;
        if (Object.keys(updates).length > 0) {
          const { data: updated } = await (supabase as any)
            .from('academy_students')
            .update(updates)
            .eq('id', studentRow.id)
            .select()
            .single();
          if (updated) studentRow = updated;
        }
      }

      setStudent(studentRow || null);

      if (studentRow) {
        const { data: enrollRows } = await (supabase as any)
          .from('academy_enrollments')
          .select('*')
          .eq('student_id', studentRow.id);
        setEnrollments(enrollRows || []);
      } else {
        setEnrollments([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudent();
    // Só recarrega se o usuário realmente mudou (login/logout). TOKEN_REFRESHED,
    // INITIAL_SESSION e SIGNED_IN em reconexão com mesmo user são ignorados — evita
    // que voltar de outra aba do navegador desmonte a UI e perca estado (dialogs,
    // tabs selecionadas, etc).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (nextUserId === lastUserIdRef.current) return;
      loadStudent();
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [loadStudent]);

  // Memoizado pra ser estável como dep de useEffect em filhos
  const hasAccessTo = useCallback((moduleId: string) => {
    if (student?.is_admin) return true;
    // Cliente de mentoria tem acesso a todos os módulos publicados
    if (student?.is_mentorship_client) return true;
    const now = new Date();
    return enrollments.some(e =>
      e.module_id === moduleId && (!e.expires_at || new Date(e.expires_at) > now)
    );
  }, [student?.is_admin, student?.is_mentorship_client, enrollments]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setStudent(null); setEnrollments([]); setIsAuthenticated(false);
  };

  return (
    <AcademyContext.Provider value={{
      student, enrollments,
      isAdmin: !!student?.is_admin,
      isAuthenticated, isLoading,
      hasAccessTo, refresh: loadStudent, signOut,
    }}>
      {children}
    </AcademyContext.Provider>
  );
}

export function useAcademyContext() {
  const ctx = useContext(AcademyContext);
  if (!ctx) throw new Error('useAcademyContext must be used within AcademyProvider');
  return ctx;
}

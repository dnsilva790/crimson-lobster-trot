import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  user: { id: string } | null;
  isLoading: boolean;
}

// Usamos um ID de placeholder para simular um usuário logado,
// já que a implementação completa de login não foi solicitada.
const PLACEHOLDER_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; 

export const useSupabaseAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: { id: PLACEHOLDER_USER_ID }, // Assume logged in with placeholder ID
    isLoading: false,
  });

  // Em um ambiente real, este useEffect monitoraria a sessão do Supabase.
  // Por enquanto, mantemos o placeholder.
  /*
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setAuthState({ user: session.user, isLoading: false });
      } else {
        setAuthState({ user: null, isLoading: false });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({ user: session?.user || null, isLoading: false });
    });

    return () => subscription.unsubscribe();
  }, []);
  */

  return authState;
};
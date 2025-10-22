import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

interface PatientProfile {
  user_id: string;
  full_name: string | null;
  identification: string;
  document_type: string;
  age: number | null;
  eps: string | null;
  phone: string | null;
  topus_data: any;
}

interface UserData {
  id: string;
  email: string;
  roles: string[];
  isProfesional: boolean;
  isAdminClinica: boolean;
  isSuperAdmin: boolean;
}

interface GlobalStore {
  // Estado del paciente activo (para profesionales)
  activePatient: PatientProfile | null;
  activePatientLoading: boolean;
  
  // Estado del usuario autenticado
  currentUser: UserData | null;
  
  // Contexto del profesional
  currentPatientUserId: string | null;
  currentClinicaId: string | null;
  
  // Cache de datos para evitar recargas
  dataCache: {
    documents?: any[];
    conversations?: any[];
    lastFetch?: Record<string, number>;
  };
  
  // Acciones para el paciente activo
  setActivePatient: (patient: PatientProfile | null) => void;
  clearActivePatient: () => void;
  loadActivePatient: (userId: string) => Promise<void>;
  
  // Acciones para el usuario
  setCurrentUser: (user: UserData | null) => void;
  
  // Acciones para el contexto del profesional
  setPatientContext: (patientUserId: string, clinicaId: string) => Promise<void>;
  
  // Acciones para el cache
  setCacheData: (key: string, data: any) => void;
  getCacheData: (key: string, maxAge?: number) => any | null;
  clearCache: () => void;
  
  // Reset completo (logout)
  resetStore: () => void;
}

export const useGlobalStore = create<GlobalStore>()(
  persist(
    (set, get) => ({
      // Estado inicial
      activePatient: null,
      activePatientLoading: false,
      currentUser: null,
      currentPatientUserId: null,
      currentClinicaId: null,
      dataCache: {},
      
      // Acciones del paciente activo
      setActivePatient: (patient) => {
        set({ activePatient: patient });
        console.log('[GlobalStore] Paciente activo actualizado:', patient?.full_name || 'ninguno');
      },
      
      clearActivePatient: () => {
        set({ 
          activePatient: null, 
          currentPatientUserId: null,
          currentClinicaId: null 
        });
        console.log('[GlobalStore] Paciente activo limpiado');
      },
      
      loadActivePatient: async (userId: string) => {
        // Si ya está cargando el mismo paciente, no hacer nada
        const current = get();
        if (current.activePatientLoading && current.activePatient?.user_id === userId) {
          console.log('[GlobalStore] Paciente ya en proceso de carga, saltando...');
          return;
        }
        
        // Si ya está cargado el mismo paciente, no recargar
        if (current.activePatient?.user_id === userId && !current.activePatientLoading) {
          console.log('[GlobalStore] Paciente ya cargado, saltando recarga innecesaria');
          return;
        }
        
        set({ activePatientLoading: true });
        console.log('[GlobalStore] Cargando paciente:', userId);
        
        try {
          const { data: profile, error } = await supabase
            .from('patient_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (!error && profile) {
            set({ activePatient: profile });
            console.log('[GlobalStore] Paciente cargado exitosamente:', profile.full_name);
          } else {
            console.error('[GlobalStore] Error cargando paciente:', error);
          }
        } catch (error) {
          console.error('[GlobalStore] Excepción cargando paciente:', error);
        } finally {
          set({ activePatientLoading: false });
        }
      },
      
      // Acciones del usuario
      setCurrentUser: (user) => {
        set({ currentUser: user });
      },
      
      // Acciones del contexto del profesional
      setPatientContext: async (patientUserId: string, clinicaId: string) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          // Actualizar contexto en BD
          const { error } = await supabase
            .from('profesional_patient_context')
            .upsert({
              profesional_user_id: user.id,
              current_patient_user_id: patientUserId,
              current_clinica_id: clinicaId,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'profesional_user_id'
            });
          
          if (error) throw error;
          
          // Actualizar estado local
          set({ 
            currentPatientUserId: patientUserId,
            currentClinicaId: clinicaId 
          });
          
          // Cargar perfil del paciente
          await get().loadActivePatient(patientUserId);
        } catch (error) {
          console.error('Error setting patient context:', error);
        }
      },
      
      // Acciones del cache
      setCacheData: (key: string, data: any) => {
        const currentCache = get().dataCache;
        set({
          dataCache: {
            ...currentCache,
            [key]: data,
            lastFetch: {
              ...currentCache.lastFetch,
              [key]: Date.now()
            }
          }
        });
      },
      
      getCacheData: (key: string, maxAge: number = 5 * 60 * 1000) => {
        const cache = get().dataCache;
        const lastFetch = cache.lastFetch?.[key];
        
        if (!lastFetch) return null;
        
        const age = Date.now() - lastFetch;
        if (age > maxAge) return null;
        
        return cache[key] || null;
      },
      
      clearCache: () => {
        set({ dataCache: {} });
      },
      
      // Reset completo
      resetStore: () => {
        set({
          activePatient: null,
          activePatientLoading: false,
          currentUser: null,
          currentPatientUserId: null,
          currentClinicaId: null,
          dataCache: {}
        });
      }
    }),
    {
      name: 'riskcare-global-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        activePatient: state.activePatient,
        currentPatientUserId: state.currentPatientUserId,
        currentClinicaId: state.currentClinicaId,
        dataCache: state.dataCache
      })
    }
  )
);

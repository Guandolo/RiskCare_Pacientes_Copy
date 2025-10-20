import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export const useProfesionalContext = () => {
  const { isProfesional, loading: roleLoading } = useUserRole();
  const [currentPatientUserId, setCurrentPatientUserId] = useState<string | null>(null);
  const [currentClinicaId, setCurrentClinicaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roleLoading) return;
    
    const loadContext = async () => {
      if (!isProfesional) {
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: context, error } = await supabase
          .from('profesional_patient_context')
          .select('current_patient_user_id, current_clinica_id')
          .eq('profesional_user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading professional context:', error);
        }

        if (context) {
          setCurrentPatientUserId(context.current_patient_user_id);
          setCurrentClinicaId(context.current_clinica_id);
        }
      } catch (error) {
        console.error('Error in loadContext:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, [isProfesional, roleLoading]);

  const setPatientContext = async (patientUserId: string, clinicaId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      setCurrentPatientUserId(patientUserId);
      setCurrentClinicaId(clinicaId);
    } catch (error) {
      console.error('Error setting patient context:', error);
    }
  };

  return {
    currentPatientUserId,
    currentClinicaId,
    setPatientContext,
    loading,
    isProfesional
  };
};

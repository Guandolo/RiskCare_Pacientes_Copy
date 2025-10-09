import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataSourcesPanel } from "@/components/DataSourcesPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { ClinicalNotebookPanel } from "@/components/ClinicalNotebookPanel";
import { Header } from "@/components/Header";
import { PatientIdentificationModal } from "@/components/PatientIdentificationModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showIdentificationModal, setShowIdentificationModal] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("patient_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code === "PGRST116") {
        // No profile found
        setShowIdentificationModal(true);
      }
      setCheckingProfile(false);
    };

    if (user) {
      checkProfile();
    }
  }, [user]);

  if (loading || checkingProfile) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-subtle">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <PatientIdentificationModal
        open={showIdentificationModal}
        onComplete={() => setShowIdentificationModal(false)}
        userId={user.id}
      />
      
      <div className="flex flex-col h-screen bg-gradient-subtle">
        <Header />
        
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Panel - Data Sources */}
          <div className="w-full lg:w-[380px] border-b lg:border-b-0 lg:border-r border-border bg-card flex-shrink-0 overflow-y-auto lg:overflow-hidden max-h-[40vh] lg:max-h-none">
            <DataSourcesPanel />
          </div>

          {/* Center Panel - Chat Assistant */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <ChatPanel />
          </div>

          {/* Right Panel - Clinical Notebook */}
          <div className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-border bg-card flex-shrink-0 overflow-y-auto lg:overflow-hidden max-h-[40vh] lg:max-h-none">
            <ClinicalNotebookPanel />
          </div>
        </div>
      </div>
    </>
  );
};

export default Index;

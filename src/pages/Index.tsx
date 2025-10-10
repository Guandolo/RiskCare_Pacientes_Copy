import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataSourcesPanel } from "@/components/DataSourcesPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { ClinicalNotebookPanel } from "@/components/ClinicalNotebookPanel";
import { Header } from "@/components/Header";
import { PatientIdentificationModal } from "@/components/PatientIdentificationModal";
import { MobileNavigation } from "@/components/MobileNavigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnboardingTour } from "@/components/OnboardingTour";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showIdentificationModal, setShowIdentificationModal] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [mobileTab, setMobileTab] = useState<"documents" | "chat" | "notebook">("chat");
  const [profileChecked, setProfileChecked] = useState(false);
  
  useOnboardingTour();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setCheckingProfile(false);
        return;
      }
      
      // Si ya verificamos el perfil en esta sesión, no volver a verificar
      if (profileChecked) {
        setCheckingProfile(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("patient_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error checking profile:", error);
          setCheckingProfile(false);
          return;
        }

        // Solo mostrar modal si definitivamente NO hay perfil
        if (!data) {
          setShowIdentificationModal(true);
        } else {
          // Perfil existe - asegurar que modal esté cerrado
          setShowIdentificationModal(false);
        }
        
        // Marcar que ya verificamos el perfil
        setProfileChecked(true);
      } catch (error) {
        console.error("Error in checkProfile:", error);
      } finally {
        setCheckingProfile(false);
      }
    };

    if (user && !profileChecked) {
      checkProfile();
    } else if (!user) {
      setCheckingProfile(false);
    }
  }, [user, profileChecked]);

  // Listener para cerrar el modal cuando se complete el perfil
  useEffect(() => {
    const handleProfileComplete = () => {
      setShowIdentificationModal(false);
      setProfileChecked(true);
    };
    
    window.addEventListener('profileUpdated', handleProfileComplete);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileComplete);
    };
  }, []);

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
        
        {isMobile ? (
          // Vista móvil con navegación por pestañas
          <>
            <div className="flex-1 overflow-hidden pb-16">
              {mobileTab === "documents" && (
                <div className="h-full bg-card overflow-hidden">
                  <DataSourcesPanel />
                </div>
              )}
              
              {mobileTab === "chat" && (
                <div className="h-full flex flex-col overflow-hidden">
                  <ChatPanel />
                </div>
              )}
              
              {mobileTab === "notebook" && (
                <div className="h-full bg-card overflow-hidden">
                  <ClinicalNotebookPanel />
                </div>
              )}
            </div>
            
            <MobileNavigation activeTab={mobileTab} onTabChange={setMobileTab} />
          </>
        ) : (
          // Vista de escritorio con paneles redimensionables
          <div className="flex-1 overflow-hidden">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              {/* Left Panel - Data Sources */}
              <ResizablePanel 
                defaultSize={22} 
                minSize={15} 
                maxSize={35}
                collapsible={true}
                collapsedSize={0}
              >
                <div className="h-full border-r border-border bg-card overflow-hidden">
                  <DataSourcesPanel />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Center Panel - Chat Assistant */}
              <ResizablePanel defaultSize={48} minSize={30}>
                <div className="h-full flex flex-col overflow-hidden">
                  <ChatPanel />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right Panel - Clinical Notebook */}
              <ResizablePanel 
                defaultSize={30} 
                minSize={20} 
                maxSize={40}
                collapsible={true}
                collapsedSize={0}
              >
                <div className="h-full border-l border-border bg-card overflow-hidden">
                  <ClinicalNotebookPanel />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>
    </>
  );
};

export default Index;

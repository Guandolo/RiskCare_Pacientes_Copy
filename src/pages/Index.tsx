import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataSourcesPanel } from "@/components/DataSourcesPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { ClinicalNotebookPanel } from "@/components/ClinicalNotebookPanel";
import { CollapsibleDataPanel } from "@/components/CollapsibleDataPanel";
import { CollapsibleNotebookPanel } from "@/components/CollapsibleNotebookPanel";
import { Header } from "@/components/Header";
import { PatientIdentificationModal } from "@/components/PatientIdentificationModal";
import { MobileNavigation } from "@/components/MobileNavigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnboardingTour } from "@/components/OnboardingTour";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showIdentificationModal, setShowIdentificationModal] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [mobileTab, setMobileTab] = useState<"documents" | "chat" | "notebook">("chat");
  const [profileChecked, setProfileChecked] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  
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

        if (error && error.code !== 'PGRST116') {
          console.error("Error checking profile:", error);
          setCheckingProfile(false);
          return;
        }

        // Solo mostrar modal si definitivamente NO hay perfil
        if (!data) {
          console.log("No profile found, showing identification modal");
          setShowIdentificationModal(true);
        } else {
          console.log("Profile found, closing modal");
          setShowIdentificationModal(false);
        }
        
        // Marcar que ya verificamos el perfil
        setProfileChecked(true);
      } catch (error) {
        console.error("Error in checkProfile:", error);
        setShowIdentificationModal(false);
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
          // Vista de escritorio con tres paneles redimensionables
          <div className="flex-1 overflow-hidden">
            <ResizablePanelGroup direction="horizontal">
              {/* Left Panel - Data Sources (Collapsible) */}
              <ResizablePanel 
                defaultSize={25} 
                minSize={leftPanelCollapsed ? 5 : 15} 
                maxSize={40}
                collapsedSize={5}
                collapsible
                onCollapse={() => setLeftPanelCollapsed(true)}
                onExpand={() => setLeftPanelCollapsed(false)}
              >
                <CollapsibleDataPanel isCollapsed={leftPanelCollapsed} />
              </ResizablePanel>

              <ResizableHandle withHandle className="relative group">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                  className="absolute -left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  title={leftPanelCollapsed ? "Expandir" : "Colapsar"}
                >
                  {leftPanelCollapsed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronLeft className="w-3 h-3" />
                  )}
                </Button>
              </ResizableHandle>

              {/* Center Panel - Chat Assistant (Fixed, no collapsible) */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full flex flex-col overflow-hidden">
                  <ChatPanel />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="relative group">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                  className="absolute -right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  title={rightPanelCollapsed ? "Expandir" : "Colapsar"}
                >
                  {rightPanelCollapsed ? (
                    <ChevronLeft className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </Button>
              </ResizableHandle>

              {/* Right Panel - Clinical Notebook (Collapsible) */}
              <ResizablePanel 
                defaultSize={25} 
                minSize={rightPanelCollapsed ? 5 : 15} 
                maxSize={40}
                collapsedSize={5}
                collapsible
                onCollapse={() => setRightPanelCollapsed(true)}
                onExpand={() => setRightPanelCollapsed(false)}
              >
                <CollapsibleNotebookPanel isCollapsed={rightPanelCollapsed} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>
    </>
  );
};

export default Index;

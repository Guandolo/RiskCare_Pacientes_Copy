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
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { supabase } from "@/integrations/supabase/client";
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import confetti from 'canvas-confetti';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfesionalContext } from "@/hooks/useProfesionalContext";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { currentPatientUserId, isProfesional, loading: contextLoading } = useProfesionalContext();
  usePageVisibility(); // Monitorear visibilidad de la página
  const [isMobile, setIsMobile] = useState(false);
  const [showIdentificationModal, setShowIdentificationModal] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [mobileTab, setMobileTab] = useState<"documents" | "chat" | "notebook">("chat");
  const [profileChecked, setProfileChecked] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Determinar qué usuario se está visualizando (profesional puede ver pacientes)
  const displayedUserId = isProfesional && currentPatientUserId ? currentPatientUserId : user?.id;

  // ELIMINADO: window.location.reload() - Ya no es necesario con el store global
  // El estado ahora persiste correctamente entre navegaciones
  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Onboarding tour logic
  useEffect(() => {
    const handleStartOnboarding = () => {
      // Celebración con confeti
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // Iniciar tour después del confeti
      setTimeout(() => {
        const tour = new Shepherd.Tour({
          useModalOverlay: true,
          defaultStepOptions: {
            cancelIcon: {
              enabled: true
            },
            classes: 'shepherd-theme-custom',
            scrollTo: { behavior: 'smooth', block: 'center' }
          }
        });

        tour.addStep({
          id: 'welcome',
          text: `
            <div class="text-center">
              <h2 class="text-2xl font-bold mb-3">¡Bienvenido a RiskCare Pacientes! 🎉</h2>
              <p class="text-base mb-3">Tu perfil ha sido creado exitosamente.</p>
              <p class="text-sm text-muted-foreground">Déjanos mostrarte cómo aprovechar al máximo tu asistente clínico personal.</p>
            </div>
          `,
          buttons: [
            {
              text: 'Comenzar Tour',
              action: tour.next,
              classes: 'shepherd-button-primary'
            }
          ]
        });

        tour.addStep({
          id: 'documents-panel',
          text: `
            <div>
              <h3 class="font-bold text-lg mb-2">📁 Mis Documentos Clínicos</h3>
              <p class="text-sm mb-2">Aquí puedes:</p>
              <ul class="text-sm space-y-1 list-disc list-inside">
                <li>Ver tu información de paciente completa</li>
                <li>Subir tus documentos médicos (resultados de laboratorio, diagnósticos, recetas)</li>
                <li>Gestionar todos tus archivos clínicos en un solo lugar</li>
              </ul>
            </div>
          `,
          attachTo: {
            element: '[data-tour="documents-panel"]',
            on: 'right'
          },
          buttons: [
            {
              text: 'Anterior',
              action: tour.back
            },
            {
              text: 'Siguiente',
              action: tour.next,
              classes: 'shepherd-button-primary'
            }
          ]
        });

        tour.addStep({
          id: 'chat-panel',
          text: `
            <div>
              <h3 class="font-bold text-lg mb-2">💬 Asistente Clínico IA</h3>
              <p class="text-sm mb-2">Tu asistente personal que puede:</p>
              <ul class="text-sm space-y-1 list-disc list-inside">
                <li>Explicarte términos médicos en lenguaje sencillo</li>
                <li>Resumir tus documentos clínicos</li>
                <li>Encontrar información específica en tu historial</li>
                <li>Responder preguntas sobre tus resultados</li>
              </ul>
              <p class="text-xs text-muted-foreground mt-2">Nota: No da diagnósticos ni recomendaciones médicas.</p>
            </div>
          `,
          attachTo: {
            element: '[data-tour="chat-panel"]',
            on: 'left'
          },
          buttons: [
            {
              text: 'Anterior',
              action: tour.back
            },
            {
              text: 'Siguiente',
              action: tour.next,
              classes: 'shepherd-button-primary'
            }
          ]
        });

        tour.addStep({
          id: 'notebook-panel',
          text: `
            <div>
              <h3 class="font-bold text-lg mb-2">📊 Bitácora Clínica</h3>
              <p class="text-sm mb-2">Herramientas de análisis para:</p>
              <ul class="text-sm space-y-1 list-disc list-inside">
                <li><strong>Mapa Clínico:</strong> Visualiza conexiones entre tus condiciones y tratamientos</li>
                <li><strong>Paraclínicos:</strong> Gráficas de tendencia de tus exámenes de laboratorio</li>
                <li><strong>Ayudas Diagnósticas:</strong> Línea de tiempo de tus estudios de imagenología</li>
                <li><strong>Medicamentos:</strong> Historial completo de tus formulaciones</li>
              </ul>
            </div>
          `,
          attachTo: {
            element: '[data-tour="notebook-panel"]',
            on: 'left'
          },
          buttons: [
            {
              text: 'Anterior',
              action: tour.back
            },
            {
              text: 'Finalizar',
              action: tour.complete,
              classes: 'shepherd-button-primary'
            }
          ]
        });

        tour.on('complete', () => {
          localStorage.setItem('onboarding_completed', 'true');
        });

        tour.on('cancel', () => {
          localStorage.setItem('onboarding_completed', 'true');
        });

        tour.start();
      }, 3000);
    };

    window.addEventListener('startOnboarding', handleStartOnboarding);

    return () => {
      window.removeEventListener('startOnboarding', handleStartOnboarding);
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Evitar spinner prolongado: dejamos que el panel izquierdo decida
  useEffect(() => {
    if (user) setCheckingProfile(false);
  }, [user]);

  // Listener para cerrar/abrir el modal según eventos del panel izquierdo
  useEffect(() => {
    const handleProfileComplete = () => {
      setShowIdentificationModal(false);
      setProfileChecked(true);
    };
    const handleProfileLoaded = () => {
      setShowIdentificationModal(false);
    };
    const handleProfileMissing = () => {
      setShowIdentificationModal(true);
    };
    
    window.addEventListener('profileUpdated', handleProfileComplete);
    window.addEventListener('profileLoaded', handleProfileLoaded);
    window.addEventListener('profileMissing', handleProfileMissing);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileComplete);
      window.removeEventListener('profileLoaded', handleProfileLoaded);
      window.removeEventListener('profileMissing', handleProfileMissing);
    };
  }, []);

  if (loading || checkingProfile || contextLoading) {
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
                  <DataSourcesPanel displayedUserId={displayedUserId} />
                </div>
              )}
              
              {mobileTab === "chat" && (
                <div className="h-full flex flex-col overflow-hidden">
                  <ChatPanel displayedUserId={displayedUserId} />
                </div>
              )}
              
              {mobileTab === "notebook" && (
                <div className="h-full bg-card overflow-hidden">
                  <ClinicalNotebookPanel displayedUserId={displayedUserId} />
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
                <CollapsibleDataPanel isCollapsed={leftPanelCollapsed} displayedUserId={displayedUserId} />
              </ResizablePanel>

              <ResizableHandle withHandle className="relative group">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                  className="absolute left-1/2 -translate-x-1/2 top-4 w-7 h-7 rounded-full bg-background shadow-md hover:shadow-lg hover:scale-110 transition-all duration-200 z-20"
                  title={leftPanelCollapsed ? "Expandir panel de documentos" : "Contraer panel de documentos"}
                >
                  {leftPanelCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </Button>
              </ResizableHandle>

              {/* Center Panel - Chat Assistant (Fixed, no collapsible) */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full flex flex-col overflow-hidden">
                  <ChatPanel displayedUserId={displayedUserId} />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="relative group">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                  className="absolute left-1/2 -translate-x-1/2 top-4 w-7 h-7 rounded-full bg-background shadow-md hover:shadow-lg hover:scale-110 transition-all duration-200 z-20"
                  title={rightPanelCollapsed ? "Expandir bitácora clínica" : "Contraer bitácora clínica"}
                >
                  {rightPanelCollapsed ? (
                    <ChevronLeft className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
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
                <CollapsibleNotebookPanel isCollapsed={rightPanelCollapsed} displayedUserId={displayedUserId} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>
    </>
  );
};

export default Index;

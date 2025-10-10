import { useEffect } from 'react';
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import confetti from 'canvas-confetti';

export const useOnboardingTour = () => {
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
};

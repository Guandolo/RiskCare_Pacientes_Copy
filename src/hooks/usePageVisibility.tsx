import { useEffect, useRef } from 'react';
import { useGlobalStore } from '@/stores/globalStore';

/**
 * Hook para detectar cuando la página pierde y recupera el foco
 * y validar que el estado global persiste correctamente
 */
export const usePageVisibility = () => {
  const wasHiddenRef = useRef(false);
  const { activePatient } = useGlobalStore();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Página oculta (usuario cambió de pestaña)
        wasHiddenRef.current = true;
        console.log('[PageVisibility] Página oculta, estado actual preservado');
      } else {
        // Página visible de nuevo (usuario volvió a la pestaña)
        if (wasHiddenRef.current) {
          wasHiddenRef.current = false;
          console.log('[PageVisibility] Página visible de nuevo');
          
          // Verificar que el estado persiste
          const store = useGlobalStore.getState();
          if (store.activePatient) {
            console.log('[PageVisibility] ✅ Estado preservado correctamente:', store.activePatient.full_name);
          } else {
            console.warn('[PageVisibility] ⚠️ Estado perdido al recuperar foco');
          }
          
          // Emitir evento personalizado para que los componentes puedan reaccionar
          window.dispatchEvent(new CustomEvent('pageVisible', {
            detail: { activePatient: store.activePatient }
          }));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activePatient]);

  return { wasHidden: wasHiddenRef.current };
};

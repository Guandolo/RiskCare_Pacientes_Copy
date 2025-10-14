import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Página dedicada para realizar un cierre de sesión profundo y confiable
export default function Logout() {
  useEffect(() => {
    const hardLogout = async () => {
      try {
        // 1) Revocar sesión en el backend (dispositivo actual y, opcional, global)
        await supabase.auth.signOut({ scope: "global" as any });
      } catch (e) {
        // no-op
      }

      try {
        // 2) Limpiar cualquier rastro en el almacenamiento de esta origen
        //    Incluye claves de Supabase (sb-*) y cualquier estado guardado
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
        sessionStorage.clear();
      } catch {}

      try {
        // 3) Borrar Service Workers y caches (evita rehidratación desde una app vieja)
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
      } catch {}

      try {
        // 4) Eliminar bases de datos IndexedDB si el navegador lo permite
        const anyIndexed = indexedDB as any;
        if (anyIndexed && typeof anyIndexed.databases === "function") {
          const dbs = await anyIndexed.databases();
          await Promise.all(
            (dbs || [])
              .filter((d: any) => d && d.name)
              .map((d: any) => new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(d.name as string);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              }))
          );
        }
      } catch {}

      // 5) Redirigir con bust de caché y en el contexto top, para evitar iframes
      const target = `/auth?ts=${Date.now()}`;
      if (window.top) {
        (window.top as Window).location.replace(target);
      } else {
        window.location.replace(target);
      }
    };

    hardLogout();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm opacity-70">Cerrando sesión de forma segura…</p>
      </div>
    </main>
  );
}

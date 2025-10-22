import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ActivePatientProvider } from "@/hooks/useActivePatient";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Logout from "./pages/Logout";
import NotFound from "./pages/NotFound";
import SuperAdmin from "./pages/SuperAdmin";
import ClinicAdmin from "./pages/ClinicAdmin";

// 🚨 CONFIGURACIÓN CRÍTICA DE SEGURIDAD: Prevenir race conditions y mezcla de datos PII
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // 🚨 Datos NUNCA expiran automáticamente - solo recarga manual
      gcTime: Infinity, // 🚨 Mantener en cache indefinidamente durante la sesión
      refetchOnWindowFocus: false, // 🚨 CRÍTICO: NO recargar al cambiar de ventana
      refetchOnMount: false, // 🚨 CRÍTICO: NO recargar al montar componente
      refetchOnReconnect: false, // 🚨 CRÍTICO: NO recargar al reconectar
      refetchInterval: false, // 🚨 CRÍTICO: NO polling automático
      refetchIntervalInBackground: false, // 🚨 CRÍTICO: NO refetch en background
      retry: 1, // Solo 1 reintento en caso de error
      retryOnMount: false, // 🚨 NO reintentar automáticamente al montar
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ActivePatientProvider>
        <BrowserRouter>
          <Toaster />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/superadmin" element={<SuperAdmin />} />
            <Route path="/admin-clinica" element={<ClinicAdmin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ActivePatientProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

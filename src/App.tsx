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

const queryClient = new QueryClient();

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

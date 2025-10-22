import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import riskCareLogo from "@/assets/riskcare-logo.png";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) window.location.replace("/");
    });
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);
      console.log('[Auth] Google sign-in clicked');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: { prompt: 'select_account' },
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        if (window.top) {
          (window.top as Window).location.href = data.url;
        } else {
          window.location.href = data.url;
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al iniciar sesión');
    } finally {
      setAuthLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-4">
            <img 
              src={riskCareLogo} 
              alt="RiskCare" 
              className="h-16 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Bienvenido a RiskCare Pacientes</CardTitle>
          <CardDescription className="text-base">
            Tu asistente clínico personal y profesional para entender y gestionar tu historial de salud
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            onClick={handleGoogleSignIn}
            type="button"
            variant="default"
            className="w-full"
            size="lg"
            disabled={authLoading}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {authLoading ? 'Conectando con Google…' : 'Continuar con Google'}
          </Button>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              <strong>Aviso Legal:</strong> Esta plataforma es una herramienta de apoyo 
para la gestión y análisis de información clínica. Los análisis generados, 
incluidos los basados en IA, <strong>son de carácter informativo y no 
constituyen un diagnóstico</strong> ni reemplazan el juicio clínico, consejo 
o diagnóstico de un profesional médico cualificado.

Las decisiones sobre la salud y el tratamiento deben ser tomadas siempre en 
consulta con un proveedor de salud. RiskCare es una plataforma desarrollada por 
<br />
<a href="https://www.ingenieria365.com" target="_blank" rel="noopener noreferrer" style={{textDecoration: 'underline'}}>
  Ingeniería 365
</a>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

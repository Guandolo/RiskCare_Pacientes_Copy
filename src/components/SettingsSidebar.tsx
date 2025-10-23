import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Users, 
  Shield, 
  DollarSign, 
  Receipt, 
  TrendingUp, 
  Plug, 
  Lock,
  Hospital,
  UserCog,
  Search,
  Bell,
  Settings
} from "lucide-react";

export interface SettingsSidebarSection {
  id: string;
  title: string;
  icon: any;
  badge?: string;
  comingSoon?: boolean;
}

export interface SettingsSidebarCategory {
  title: string;
  sections: SettingsSidebarSection[];
}

interface SettingsSidebarProps {
  categories: SettingsSidebarCategory[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  className?: string;
}

export const SettingsSidebar = ({
  categories,
  activeSection,
  onSectionChange,
  className
}: SettingsSidebarProps) => {
  return (
    <div className={cn("w-64 bg-card border-r border-border flex flex-col h-full", className)}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Configuración</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {categories.map((category, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
              {category.title}
            </h3>
            <div className="space-y-1">
              {category.sections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-sm h-auto py-2.5 px-3",
                    activeSection === section.id && "bg-primary/10 text-primary font-medium",
                    section.comingSoon && "opacity-60"
                  )}
                  onClick={() => !section.comingSoon && onSectionChange(section.id)}
                  disabled={section.comingSoon}
                >
                  <section.icon className="h-4 w-4 mr-2.5" />
                  <span className="flex-1 text-left">{section.title}</span>
                  {section.badge && (
                    <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                      {section.badge}
                    </Badge>
                  )}
                  {section.comingSoon && (
                    <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                      Próximamente
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
            {idx < categories.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          <a 
            href="https://ingenieria365.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Ingeniería 365
          </a>
        </p>
      </div>
    </div>
  );
};

// Configuración predefinida para Admin Clínica
export const getClinicAdminCategories = (): SettingsSidebarCategory[] => [
  {
    title: "Mi Clínica",
    sections: [
      { id: "clinic-info", title: "Información General", icon: Building2 },
      { id: "clinic-patients", title: "Pacientes Asignados", icon: Users },
      { id: "clinic-professionals", title: "Profesionales de Clínica", icon: UserCog },
      { id: "clinic-access-logs", title: "Registro de Accesos", icon: Search },
    ],
  },
  {
    title: "Configuraciones Específicas",
    sections: [
      { id: "clinic-billing", title: "Facturación y Pagos", icon: DollarSign, comingSoon: true },
      { id: "clinic-value-health", title: "Programa Valor en Salud", icon: TrendingUp, comingSoon: true },
      { id: "clinic-notifications", title: "Notificaciones", icon: Bell, comingSoon: true },
      { id: "clinic-integrations", title: "Integraciones Locales", icon: Plug, comingSoon: true },
    ],
  },
];

// Configuración predefinida para SuperAdmin
export const getSuperAdminCategories = (): SettingsSidebarCategory[] => [
  {
    title: "Gestión General",
    sections: [
      { id: "manage-clinics", title: "Clínicas y IPS", icon: Building2 },
      { id: "global-users", title: "Usuarios Globales", icon: Users, comingSoon: true },
      { id: "roles-permissions", title: "Permisos y Roles", icon: Shield, comingSoon: true },
    ],
  },
  {
    title: "Facturación y Pagos",
    sections: [
      { id: "plans-subscriptions", title: "Planes y Suscripciones", icon: DollarSign, comingSoon: true },
      { id: "payment-history", title: "Historial de Pagos", icon: Receipt, comingSoon: true },
    ],
  },
  {
    title: "Configuraciones Avanzadas",
    sections: [
      { id: "value-health-programs", title: "Programas de Valor en Salud", icon: TrendingUp, comingSoon: true },
      { id: "integrations", title: "Integraciones", icon: Plug, comingSoon: true },
      { id: "audit-logs", title: "Auditoría y Logs", icon: Lock, comingSoon: true },
    ],
  },
];

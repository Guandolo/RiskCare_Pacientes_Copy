import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Header } from "@/components/Header";
import { SettingsSidebar, getClinicAdminCategories, getSuperAdminCategories } from "@/components/SettingsSidebar";
import { toast } from "sonner";

// Import section components for Clinic Admin
import { ClinicInfoSection } from "@/components/settings/ClinicInfoSection";
import { ClinicPatientsSection } from "@/components/settings/ClinicPatientsSection";
import { ClinicProfessionalsSection } from "@/components/settings/ClinicProfessionalsSection";
import { ClinicAccessLogsSection } from "@/components/settings/ClinicAccessLogsSection";

// Import section components for SuperAdmin
import { ManageClinicsSection } from "@/components/settings/ManageClinicsSection";

// Coming Soon placeholder
import { ComingSoonSection } from "@/components/settings/ComingSoonSection";

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const { isAdminClinica, isSuperAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState("");

  // Determine user context (superadmin or clinic admin)
  const isSuperAdminContext = isSuperAdmin;
  const isClinicAdminContext = isAdminClinica && !isSuperAdmin;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdminClinica && !isSuperAdmin) {
      navigate("/");
      toast.error("No tienes permisos para acceder a esta página");
    }
  }, [isAdminClinica, isSuperAdmin, roleLoading, navigate]);

  // Initialize active section from URL or default
  useEffect(() => {
    const section = searchParams.get("section");
    if (section) {
      setActiveSection(section);
    } else {
      // Set default section based on role
      if (isSuperAdminContext) {
        setActiveSection("manage-clinics");
      } else if (isClinicAdminContext) {
        setActiveSection("clinic-info");
      }
    }
  }, [searchParams, isSuperAdminContext, isClinicAdminContext]);

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId });
  };

  // Get sidebar categories based on role
  const categories = isSuperAdminContext
    ? getSuperAdminCategories()
    : getClinicAdminCategories();

  // Render active section content
  const renderSectionContent = () => {
    // SuperAdmin sections
    if (isSuperAdminContext) {
      switch (activeSection) {
        case "manage-clinics":
          return <ManageClinicsSection />;
        case "global-users":
        case "roles-permissions":
        case "plans-subscriptions":
        case "payment-history":
        case "value-health-programs":
        case "integrations":
        case "audit-logs":
          return <ComingSoonSection title={getSectionTitle(activeSection)} />;
        default:
          return <ManageClinicsSection />;
      }
    }

    // Clinic Admin sections
    if (isClinicAdminContext) {
      switch (activeSection) {
        case "clinic-info":
          return <ClinicInfoSection />;
        case "clinic-patients":
          return <ClinicPatientsSection />;
        case "clinic-professionals":
          return <ClinicProfessionalsSection />;
        case "clinic-access-logs":
          return <ClinicAccessLogsSection />;
        case "clinic-billing":
        case "clinic-value-health":
        case "clinic-notifications":
        case "clinic-integrations":
          return <ComingSoonSection title={getSectionTitle(activeSection)} />;
        default:
          return <ClinicInfoSection />;
      }
    }

    return null;
  };

  const getSectionTitle = (sectionId: string): string => {
    for (const category of categories) {
      const section = category.sections.find(s => s.id === sectionId);
      if (section) return section.title;
    }
    return "";
  };

  if (authLoading || roleLoading || (!isAdminClinica && !isSuperAdmin)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        <SettingsSidebar
          categories={categories}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />
        
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8 max-w-7xl">
            {renderSectionContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

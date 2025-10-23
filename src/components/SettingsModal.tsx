import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalStore } from "@/stores/globalStore";
import { useUserRole } from "@/hooks/useUserRole";
import { SettingsSidebar, getClinicAdminCategories, getSuperAdminCategories } from "@/components/SettingsSidebar";

// Import section components for Clinic Admin
import { ClinicInfoSection } from "@/components/settings/ClinicInfoSection";
import { ClinicPatientsSection } from "@/components/settings/ClinicPatientsSection";
import { ClinicProfessionalsSection } from "@/components/settings/ClinicProfessionalsSection";
import { ClinicAccessLogsSection } from "@/components/settings/ClinicAccessLogsSection";

// Import section components for SuperAdmin
import { ManageClinicsSection } from "@/components/settings/ManageClinicsSection";

// Coming Soon placeholder
import { ComingSoonSection } from "@/components/settings/ComingSoonSection";

export const SettingsModal = () => {
  const { 
    settingsModalOpen, 
    settingsActiveSection, 
    closeSettingsModal, 
    setSettingsSection 
  } = useGlobalStore();
  const { isAdminClinica, isSuperAdmin } = useUserRole();

  // Determine user context (superadmin or clinic admin)
  const isSuperAdminContext = isSuperAdmin;
  const isClinicAdminContext = isAdminClinica && !isSuperAdmin;

  // Set default section when modal opens
  useEffect(() => {
    if (settingsModalOpen && !settingsActiveSection) {
      if (isSuperAdminContext) {
        setSettingsSection("manage-clinics");
      } else if (isClinicAdminContext) {
        setSettingsSection("clinic-info");
      }
    }
  }, [settingsModalOpen, settingsActiveSection, isSuperAdminContext, isClinicAdminContext, setSettingsSection]);

  // Get sidebar categories based on role
  const categories = isSuperAdminContext
    ? getSuperAdminCategories()
    : getClinicAdminCategories();

  // Render active section content
  const renderSectionContent = () => {
    if (!settingsActiveSection) return null;

    // SuperAdmin sections
    if (isSuperAdminContext) {
      switch (settingsActiveSection) {
        case "manage-clinics":
          return <ManageClinicsSection />;
        case "global-users":
        case "roles-permissions":
        case "plans-subscriptions":
        case "payment-history":
        case "value-health-programs":
        case "integrations":
        case "audit-logs":
          return <ComingSoonSection title={getSectionTitle(settingsActiveSection)} />;
        default:
          return <ManageClinicsSection />;
      }
    }

    // Clinic Admin sections
    if (isClinicAdminContext) {
      switch (settingsActiveSection) {
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
          return <ComingSoonSection title={getSectionTitle(settingsActiveSection)} />;
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

  // Only render if user has permissions
  if (!isAdminClinica && !isSuperAdmin) {
    return null;
  }

  return (
    <Dialog open={settingsModalOpen} onOpenChange={closeSettingsModal}>
      <DialogContent 
        className="max-w-[95vw] h-[95vh] p-0 gap-0 overflow-hidden"
        // Remove default close button, we'll add our own
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={closeSettingsModal}
      >
        {/* Custom Header with close button */}
        <div className="absolute top-4 right-4 z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={closeSettingsModal}
            className="h-8 w-8 rounded-full bg-background shadow-md hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modal Content */}
        <div className="flex h-full overflow-hidden">
          <SettingsSidebar
            categories={categories}
            activeSection={settingsActiveSection || ""}
            onSectionChange={setSettingsSection}
          />
          
          <div className="flex-1 overflow-y-auto bg-gradient-subtle">
            <div className="container mx-auto px-6 py-8 max-w-7xl">
              {renderSectionContent()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

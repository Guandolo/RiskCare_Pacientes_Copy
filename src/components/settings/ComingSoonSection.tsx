import { Card } from "@/components/ui/card";
import { Rocket } from "lucide-react";

interface ComingSoonSectionProps {
  title: string;
}

export const ComingSoonSection = ({ title }: ComingSoonSectionProps) => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">Esta funcionalidad estará disponible próximamente</p>
      </div>

      <Card className="p-12 text-center">
        <Rocket className="h-16 w-16 text-primary mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-semibold mb-2">Próximamente</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Estamos trabajando en esta funcionalidad para mejorar tu experiencia. 
          Pronto estará disponible.
        </p>
      </Card>
    </div>
  );
};

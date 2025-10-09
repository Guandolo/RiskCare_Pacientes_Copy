import { DataSourcesPanel } from "@/components/DataSourcesPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { ClinicalNotebookPanel } from "@/components/ClinicalNotebookPanel";
import { Header } from "@/components/Header";

const Index = () => {
  return (
    <div className="flex flex-col h-screen bg-gradient-subtle">
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Data Sources */}
        <div className="w-80 border-r border-border bg-card flex-shrink-0 overflow-hidden">
          <DataSourcesPanel />
        </div>

        {/* Center Panel - Chat Assistant */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatPanel />
        </div>

        {/* Right Panel - Clinical Notebook */}
        <div className="w-96 border-l border-border bg-card flex-shrink-0 overflow-hidden">
          <ClinicalNotebookPanel />
        </div>
      </div>
    </div>
  );
};

export default Index;

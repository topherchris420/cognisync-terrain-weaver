
import { useState } from "react";
import { CognitiveFieldVisualization } from "@/components/CognitiveFieldVisualization";
import { Header } from "@/components/Header";
import { LeftPanel } from "@/components/LeftPanel";
import { RightPanel } from "@/components/RightPanel";
import { SystemIndicators } from "@/components/SystemIndicators";
import { StatusStrip } from "@/components/StatusStrip";
import { BiometricAuth } from "@/components/BiometricAuth";
import { useFieldActivity } from "@/hooks/useFieldActivity";
import { useSystemInit } from "@/hooks/useSystemInit";
import { useAuthentication } from "@/hooks/useAuthentication";

const Index = () => {
  const [activeTab, setActiveTab] = useState('core');
  
  const fieldActivity = useFieldActivity();
  const systemsOnline = useSystemInit();
  const {
    activeMode,
    isSecureSession,
    showBiometricAuth,
    handleSecureAccess,
    handleAuthSuccess,
    handleModeChange
  } = useAuthentication();

  return (
    <div className="min-h-screen bg-cyber-darker neural-bg overflow-hidden touch-manipulation">
      <Header 
        activeMode={activeMode}
        isSecureSession={isSecureSession}
        fieldActivity={fieldActivity}
        onModeChange={handleModeChange}
        onSecureAccess={handleSecureAccess}
      />

      {/* Mobile-optimized responsive layout */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-60px)] md:h-[calc(100vh-80px)]">
        {/* Mobile: Collapsible panels */}
        <div className="lg:hidden">
          <LeftPanel 
            activeTab={activeTab}
            activeMode={activeMode}
            onTabChange={setActiveTab}
          />
        </div>
        
        {/* Desktop: Side panel */}
        <div className="hidden lg:block">
          <LeftPanel 
            activeTab={activeTab}
            activeMode={activeMode}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Center - Field Visualization - Full width on mobile */}
        <div className="flex-1 relative min-h-[50vh] lg:min-h-[300px]">
          <CognitiveFieldVisualization 
            fieldActivity={fieldActivity}
            activeMode={activeMode}
            isSecureSession={isSecureSession}
          />
          
          <SystemIndicators 
            systemsOnline={systemsOnline}
            isSecureSession={isSecureSession}
          />
        </div>

        {/* Mobile: Bottom panel, Desktop: Right panel */}
        <div className="lg:block">
          <RightPanel 
            activeMode={activeMode}
            isSecureSession={isSecureSession}
            onModeChange={handleModeChange}
          />
        </div>
      </div>

      <StatusStrip fieldActivity={fieldActivity} />
      
      <BiometricAuth 
        onAuthSuccess={handleAuthSuccess}
        isVisible={showBiometricAuth}
      />
    </div>
  );
};

export default Index;

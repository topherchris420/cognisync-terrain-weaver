
import { useState, useEffect } from "react";
import { CognitiveFieldVisualization } from "@/components/CognitiveFieldVisualization";
import { Header } from "@/components/Header";
import { LeftPanel } from "@/components/LeftPanel";
import { RightPanel } from "@/components/RightPanel";
import { SystemIndicators } from "@/components/SystemIndicators";
import { StatusStrip } from "@/components/StatusStrip";

const Index = () => {
  const [activeMode, setActiveMode] = useState<'civilian' | 'strategic'>('strategic');
  const [isSecureSession, setIsSecureSession] = useState(true);
  const [fieldActivity, setFieldActivity] = useState(87.3);
  const [activeTab, setActiveTab] = useState('core');
  const [systemsOnline, setSystemsOnline] = useState(false);

  // Real-time system activation
  useEffect(() => {
    const initSequence = setTimeout(() => {
      setSystemsOnline(true);
    }, 1000);

    return () => clearTimeout(initSequence);
  }, []);

  // Live field activity simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setFieldActivity(prev => {
        const variation = (Math.random() - 0.5) * 15;
        return Math.max(70, Math.min(100, prev + variation));
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  const handleSecureAccess = () => {
    setIsSecureSession(true);
    setActiveMode('strategic');
  };

  return (
    <div className="min-h-screen bg-cyber-darker neural-bg overflow-hidden">
      <Header 
        activeMode={activeMode}
        isSecureSession={isSecureSession}
        fieldActivity={fieldActivity}
        onModeChange={setActiveMode}
        onSecureAccess={handleSecureAccess}
      />

      {/* Mobile-first responsive layout */}
      <div className="flex flex-col md:flex-row h-[calc(100vh-60px)] md:h-[calc(100vh-80px)]">
        <LeftPanel 
          activeTab={activeTab}
          activeMode={activeMode}
          onTabChange={setActiveTab}
        />

        {/* Center - Field Visualization */}
        <div className="flex-1 relative min-h-[300px]">
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

        <RightPanel 
          activeMode={activeMode}
          isSecureSession={isSecureSession}
          onModeChange={setActiveMode}
        />
      </div>

      <StatusStrip fieldActivity={fieldActivity} />
    </div>
  );
};

export default Index;


import { useState, useEffect } from "react";
import { CognitiveFieldVisualization } from "@/components/CognitiveFieldVisualization";
import { Header } from "@/components/Header";
import { LeftPanel } from "@/components/LeftPanel";
import { RightPanel } from "@/components/RightPanel";
import { SystemIndicators } from "@/components/SystemIndicators";
import { StatusStrip } from "@/components/StatusStrip";
import { BiometricAuth } from "@/components/BiometricAuth";

const Index = () => {
  const [activeMode, setActiveMode] = useState<'civilian' | 'strategic'>('civilian');
  const [isSecureSession, setIsSecureSession] = useState(false);
  const [fieldActivity, setFieldActivity] = useState(87.3);
  const [activeTab, setActiveTab] = useState('core');
  const [systemsOnline, setSystemsOnline] = useState(false);
  const [showBiometricAuth, setShowBiometricAuth] = useState(false);

  // Real-time system activation
  useEffect(() => {
    const initSequence = setTimeout(() => {
      setSystemsOnline(true);
    }, 1000);

    return () => clearTimeout(initSequence);
  }, []);

  // Live field activity simulation with more realistic patterns
  useEffect(() => {
    const interval = setInterval(() => {
      setFieldActivity(prev => {
        // Create more realistic field fluctuations
        const baseActivity = 85;
        const time = Date.now() / 1000;
        const wave1 = Math.sin(time * 0.1) * 10;
        const wave2 = Math.sin(time * 0.3) * 5;
        const noise = (Math.random() - 0.5) * 8;
        const newActivity = baseActivity + wave1 + wave2 + noise;
        return Math.max(70, Math.min(100, newActivity));
      });
    }, 500); // Faster updates for more realistic feel

    return () => clearInterval(interval);
  }, []);

  const handleSecureAccess = () => {
    setShowBiometricAuth(true);
  };

  const handleAuthSuccess = () => {
    setIsSecureSession(true);
    setActiveMode('strategic');
    setShowBiometricAuth(false);
  };

  const handleModeChange = (mode: 'civilian' | 'strategic') => {
    if (mode === 'strategic' && !isSecureSession) {
      handleSecureAccess();
    } else {
      setActiveMode(mode);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-darker neural-bg overflow-hidden">
      <Header 
        activeMode={activeMode}
        isSecureSession={isSecureSession}
        fieldActivity={fieldActivity}
        onModeChange={handleModeChange}
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
          onModeChange={handleModeChange}
        />
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

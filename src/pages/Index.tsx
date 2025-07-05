
import { useState, useEffect } from "react";
import { CognitiveFieldVisualization } from "@/components/CognitiveFieldVisualization";
import { DataIngestionPanel } from "@/components/DataIngestionPanel";
import { ResonanceAnalysis } from "@/components/ResonanceAnalysis";
import { ThreatDetection } from "@/components/ThreatDetection";
import { ControlPanel } from "@/components/ControlPanel";
import { StatusBar } from "@/components/StatusBar";
import { QuantumEdgeMesh } from "@/components/QuantumEdgeMesh";
import { HolographicResonanceAtlas } from "@/components/HolographicResonanceAtlas";
import { CounterResonanceSynthesizer } from "@/components/CounterResonanceSynthesizer";
import { DreamStateCaptureLayer } from "@/components/DreamStateCaptureLayer";
import { AugmentedRealityOverwatch } from "@/components/AugmentedRealityOverwatch";
import { TimelineConvergenceController } from "@/components/TimelineConvergenceController";
import { OntologicalCryptography } from "@/components/OntologicalCryptography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Zap, Database, Monitor, Brain, Eye, Clock, Lock, Menu, X } from "lucide-react";

const Index = () => {
  const [activeMode, setActiveMode] = useState<'civilian' | 'strategic'>('strategic');
  const [isSecureSession, setIsSecureSession] = useState(true);
  const [fieldActivity, setFieldActivity] = useState(87.3);
  const [activeTab, setActiveTab] = useState('core');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      {/* Mobile-optimized Header */}
      <header className="border-b border-cyber-blue/20 bg-cyber-dark/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between p-3 md:p-4">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="relative">
              <Zap className="w-6 h-6 md:w-8 md:h-8 text-cyber-blue animate-pulse-glow" />
              <div className="absolute -top-1 -right-1 w-2 h-2 md:w-3 md:h-3 bg-cyber-green rounded-full animate-cognitive-pulse"></div>
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
                VERS3DYNAMICS
              </h1>
              <p className="text-xs text-cyber-blue/60 hidden md:block">Advanced Cognitive Terrain Mapping Platform</p>
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center space-x-2 md:hidden">
            <StatusBar fieldActivity={fieldActivity} />
            <Button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              variant="outline"
              size="sm"
              className="border-cyber-blue/50 text-cyber-blue"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>

          {/* Desktop controls */}
          <div className="hidden md:flex items-center space-x-4">
            <StatusBar fieldActivity={fieldActivity} />
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></div>
              <span className="text-xs text-cyber-green font-semibold">ALL SYSTEMS ACTIVE</span>
            </div>
            <Button
              onClick={() => setActiveMode(activeMode === 'civilian' ? 'strategic' : 'civilian')}
              variant="outline"
              className="border-cyber-blue/50 hover:border-cyber-blue text-cyber-blue"
            >
              {activeMode === 'civilian' ? 'Wellness Mode' : 'Strategic Mode'}
            </Button>
            {!isSecureSession && (
              <Button
                onClick={handleSecureAccess}
                className="bg-gradient-to-r from-cyber-red to-cyber-orange hover:from-cyber-red/80 hover:to-cyber-orange/80"
              >
                <Shield className="w-4 h-4 mr-2" />
                Secure Access
              </Button>
            )}
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-cyber-blue/20 bg-cyber-dark/95 p-3 space-y-3">
            <Button
              onClick={() => setActiveMode(activeMode === 'civilian' ? 'strategic' : 'civilian')}
              variant="outline"
              className="w-full border-cyber-blue/50 text-cyber-blue"
            >
              {activeMode === 'civilian' ? 'Wellness Mode' : 'Strategic Mode'}
            </Button>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></div>
              <span className="text-xs text-cyber-green font-semibold">ALL SYSTEMS ACTIVE</span>
            </div>
          </div>
        )}
      </header>

      {/* Mobile-first responsive layout */}
      <div className="flex flex-col md:flex-row h-[calc(100vh-60px)] md:h-[calc(100vh-80px)]">
        {/* Left Panel - Mobile: Full width tabs, Desktop: Sidebar */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-cyber-blue/20 bg-cyber-dark/40 backdrop-blur-sm overflow-y-auto max-h-[40vh] md:max-h-none">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-4 bg-cyber-dark/60 m-2 sticky top-0 z-10">
              <TabsTrigger value="core" className="text-xs">Core</TabsTrigger>
              <TabsTrigger value="quantum" className="text-xs">Quantum</TabsTrigger>
              <TabsTrigger value="neural" className="text-xs">Neural</TabsTrigger>
              <TabsTrigger value="temporal" className="text-xs">Temporal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="core" className="p-2 md:p-4 space-y-3 md:space-y-4">
              <DataIngestionPanel activeMode={activeMode} />
              <ResonanceAnalysis />
              <OntologicalCryptography />
            </TabsContent>
            
            <TabsContent value="quantum" className="p-2 md:p-4 space-y-3 md:space-y-4">
              <QuantumEdgeMesh />
              <HolographicResonanceAtlas />
            </TabsContent>
            
            <TabsContent value="neural" className="p-2 md:p-4 space-y-3 md:space-y-4">
              <DreamStateCaptureLayer />
              <CounterResonanceSynthesizer />
            </TabsContent>
            
            <TabsContent value="temporal" className="p-2 md:p-4 space-y-3 md:space-y-4">
              <TimelineConvergenceController />
              <AugmentedRealityOverwatch />
            </TabsContent>
          </Tabs>
        </div>

        {/* Center - Field Visualization */}
        <div className="flex-1 relative min-h-[300px]">
          <CognitiveFieldVisualization 
            fieldActivity={fieldActivity}
            activeMode={activeMode}
            isSecureSession={isSecureSession}
          />
          
          {/* Live System Status - Mobile optimized */}
          {systemsOnline && (
            <div className="absolute top-2 md:top-4 right-2 md:right-4 space-y-1 md:space-y-2">
              <Button
                size="sm"
                className="bg-cyber-purple/30 border border-cyber-purple/70 hover:bg-cyber-purple/40 text-cyber-purple animate-pulse"
              >
                <Database className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
              <Button
                size="sm"
                className="bg-cyber-green/30 border border-cyber-green/70 hover:bg-cyber-green/40 text-cyber-green animate-pulse"
              >
                <Monitor className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
              <Button
                size="sm"
                className="bg-cyber-orange/30 border border-cyber-orange/70 hover:bg-cyber-orange/40 text-cyber-orange animate-pulse"
              >
                <Brain className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
              <Button
                size="sm"
                className="bg-cyber-blue/30 border border-cyber-blue/70 hover:bg-cyber-blue/40 text-cyber-blue animate-pulse"
              >
                <Eye className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
            </div>
          )}

          {/* Live System Indicators - Mobile optimized */}
          {isSecureSession && systemsOnline && (
            <div className="absolute bottom-2 md:bottom-4 right-2 md:right-4 grid grid-cols-2 gap-1 md:gap-2">
              <Card className="bg-cyber-green/30 border-cyber-green/70 p-1 md:p-2 animate-pulse">
                <div className="flex items-center space-x-1">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-cyber-green rounded-full animate-pulse"></div>
                  <span className="text-xs text-cyber-green font-bold">QUANTUM</span>
                </div>
              </Card>
              <Card className="bg-cyber-purple/30 border-cyber-purple/70 p-1 md:p-2 animate-pulse">
                <div className="flex items-center space-x-1">
                  <Brain className="w-2 h-2 md:w-3 md:h-3 text-cyber-purple" />
                  <span className="text-xs text-cyber-purple font-bold">NEURAL</span>
                </div>
              </Card>
              <Card className="bg-cyber-orange/30 border-cyber-orange/70 p-1 md:p-2 animate-pulse">
                <div className="flex items-center space-x-1">
                  <Clock className="w-2 h-2 md:w-3 md:h-3 text-cyber-orange" />
                  <span className="text-xs text-cyber-orange font-bold">TEMPORAL</span>
                </div>
              </Card>
              <Card className="bg-cyber-blue/30 border-cyber-blue/70 p-1 md:p-2 animate-pulse">
                <div className="flex items-center space-x-1">
                  <Lock className="w-2 h-2 md:w-3 md:h-3 text-cyber-blue" />
                  <span className="text-xs text-cyber-blue font-bold">SECURE</span>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Right Panel - Mobile: Bottom section, Desktop: Sidebar */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-cyber-blue/20 bg-cyber-dark/40 backdrop-blur-sm p-2 md:p-4 space-y-3 md:space-y-4 overflow-y-auto max-h-[40vh] md:max-h-none">
          <ThreatDetection activeMode={activeMode} isSecureSession={isSecureSession} />
          <ControlPanel 
            activeMode={activeMode} 
            isSecureSession={isSecureSession}
            onModeChange={setActiveMode}
          />
        </div>
      </div>

      {/* Enhanced Bottom Status Strip - Mobile optimized */}
      <div className="h-6 md:h-8 bg-cyber-dark/80 border-t border-cyber-blue/20 flex items-center justify-between px-2 md:px-4 text-xs text-cyber-blue/80 overflow-x-auto">
        <div className="flex items-center space-x-2 md:space-x-4 whitespace-nowrap">
          <span>Field: {Math.round(fieldActivity)}%</span>
          <span className="hidden sm:inline">Quantum: 847</span>
          <span className="hidden md:inline">Dreams: 23</span>
          <span className="hidden lg:inline">Timeline: 84.2%</span>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4 whitespace-nowrap">
          <span className="hidden sm:inline">0.003ms</span>
          <span className="hidden md:inline">Post-Quantum</span>
          <span className="hidden lg:inline">12.4 GB/s</span>
          <div className="flex items-center space-x-1">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-cyber-green rounded-full animate-pulse"></div>
            <span className="font-bold">LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

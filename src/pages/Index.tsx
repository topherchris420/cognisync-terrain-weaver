
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
import { Shield, Zap, Database, Monitor, Brain, Eye, Clock, Lock } from "lucide-react";

const Index = () => {
  const [activeMode, setActiveMode] = useState<'civilian' | 'strategic'>('civilian');
  const [isSecureSession, setIsSecureSession] = useState(false);
  const [fieldActivity, setFieldActivity] = useState(0);
  const [activeTab, setActiveTab] = useState('core');

  useEffect(() => {
    // Simulate field activity fluctuations
    const interval = setInterval(() => {
      setFieldActivity(Math.random() * 100);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSecureAccess = () => {
    setIsSecureSession(true);
    setActiveMode('strategic');
  };

  return (
    <div className="min-h-screen bg-cyber-darker neural-bg overflow-hidden">
      {/* Header */}
      <header className="border-b border-cyber-blue/20 bg-cyber-dark/80 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Zap className="w-8 h-8 text-cyber-blue animate-pulse-glow" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyber-green rounded-full animate-cognitive-pulse"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
                COGNISYNC
              </h1>
              <p className="text-xs text-cyber-blue/60">Advanced Cognitive Terrain Mapping Platform</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <StatusBar fieldActivity={fieldActivity} />
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
      </header>

      {/* Main Dashboard */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Advanced Systems */}
        <div className="w-80 border-r border-cyber-blue/20 bg-cyber-dark/40 backdrop-blur-sm overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-4 bg-cyber-dark/60 m-2">
              <TabsTrigger value="core" className="text-xs">Core</TabsTrigger>
              <TabsTrigger value="quantum" className="text-xs">Quantum</TabsTrigger>
              <TabsTrigger value="neural" className="text-xs">Neural</TabsTrigger>
              <TabsTrigger value="temporal" className="text-xs">Temporal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="core" className="p-4 space-y-4">
              <DataIngestionPanel activeMode={activeMode} />
              <ResonanceAnalysis />
              <OntologicalCryptography />
            </TabsContent>
            
            <TabsContent value="quantum" className="p-4 space-y-4">
              <QuantumEdgeMesh />
              <HolographicResonanceAtlas />
            </TabsContent>
            
            <TabsContent value="neural" className="p-4 space-y-4">
              <DreamStateCaptureLayer />
              <CounterResonanceSynthesizer />
            </TabsContent>
            
            <TabsContent value="temporal" className="p-4 space-y-4">
              <TimelineConvergenceController />
              <AugmentedRealityOverwatch />
            </TabsContent>
          </Tabs>
        </div>

        {/* Center - Field Visualization */}
        <div className="flex-1 relative">
          <CognitiveFieldVisualization 
            fieldActivity={fieldActivity}
            activeMode={activeMode}
            isSecureSession={isSecureSession}
          />
          
          {/* Floating System Status */}
          <div className="absolute top-4 right-4 space-y-2">
            <Button
              size="sm"
              className="bg-cyber-purple/20 border border-cyber-purple/50 hover:bg-cyber-purple/30 text-cyber-purple"
            >
              <Database className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="bg-cyber-green/20 border border-cyber-green/50 hover:bg-cyber-green/30 text-cyber-green"
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="bg-cyber-orange/20 border border-cyber-orange/50 hover:bg-cyber-orange/30 text-cyber-orange"
            >
              <Brain className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="bg-cyber-blue/20 border border-cyber-blue/50 hover:bg-cyber-blue/30 text-cyber-blue"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>

          {/* Advanced System Indicators */}
          {isSecureSession && (
            <div className="absolute bottom-4 right-4 grid grid-cols-2 gap-2">
              <Card className="bg-cyber-green/20 border-cyber-green/50 p-2">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></div>
                  <span className="text-xs text-cyber-green">QUANTUM MESH</span>
                </div>
              </Card>
              <Card className="bg-cyber-purple/20 border-cyber-purple/50 p-2">
                <div className="flex items-center space-x-1">
                  <Brain className="w-3 h-3 text-cyber-purple" />
                  <span className="text-xs text-cyber-purple">DREAM SYNC</span>
                </div>
              </Card>
              <Card className="bg-cyber-orange/20 border-cyber-orange/50 p-2">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-cyber-orange" />
                  <span className="text-xs text-cyber-orange">TIMELINE</span>
                </div>
              </Card>
              <Card className="bg-cyber-blue/20 border-cyber-blue/50 p-2">
                <div className="flex items-center space-x-1">
                  <Lock className="w-3 h-3 text-cyber-blue" />
                  <span className="text-xs text-cyber-blue">ENCRYPTED</span>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Right Panel - Threat Detection & Control */}
        <div className="w-80 border-l border-cyber-blue/20 bg-cyber-dark/40 backdrop-blur-sm p-4 space-y-4 overflow-y-auto">
          <ThreatDetection activeMode={activeMode} isSecureSession={isSecureSession} />
          <ControlPanel 
            activeMode={activeMode} 
            isSecureSession={isSecureSession}
            onModeChange={setActiveMode}
          />
        </div>
      </div>

      {/* Enhanced Bottom Status Strip */}
      <div className="h-8 bg-cyber-dark/60 border-t border-cyber-blue/20 flex items-center justify-between px-4 text-xs text-cyber-blue/60">
        <div className="flex items-center space-x-4">
          <span>Field Coherence: {Math.round(fieldActivity)}%</span>
          <span>Quantum Nodes: 847</span>
          <span>Dream Streams: 23</span>
          <span>Timeline Stability: 84.2%</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Latency: 0.003ms</span>
          <span>Encryption: Post-Quantum</span>
          <span>Bandwidth: 12.4 GB/s</span>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></div>
            <span>HYPERSYNC OPERATIONAL</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;


import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataIngestionPanel } from "@/components/DataIngestionPanel";
import { ResonanceAnalysis } from "@/components/ResonanceAnalysis";
import { OntologicalCryptography } from "@/components/OntologicalCryptography";
import { QuantumEdgeMesh } from "@/components/QuantumEdgeMesh";
import { HolographicResonanceAtlas } from "@/components/HolographicResonanceAtlas";
import { DreamStateCaptureLayer } from "@/components/DreamStateCaptureLayer";
import { CounterResonanceSynthesizer } from "@/components/CounterResonanceSynthesizer";
import { TimelineConvergenceController } from "@/components/TimelineConvergenceController";
import { AugmentedRealityOverwatch } from "@/components/AugmentedRealityOverwatch";

interface LeftPanelProps {
  activeTab: string;
  activeMode: 'civilian' | 'strategic';
  onTabChange: (tab: string) => void;
}

export const LeftPanel = ({ activeTab, activeMode, onTabChange }: LeftPanelProps) => {
  return (
    <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-cyber-blue/20 bg-cyber-dark/40 backdrop-blur-sm overflow-y-auto max-h-[40vh] md:max-h-none">
      <Tabs value={activeTab} onValueChange={onTabChange} className="h-full">
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
  );
};

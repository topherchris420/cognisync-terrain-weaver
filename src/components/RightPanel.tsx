
import { ThreatDetection } from "@/components/ThreatDetection";
import { ControlPanel } from "@/components/ControlPanel";

interface RightPanelProps {
  activeMode: 'civilian' | 'strategic';
  isSecureSession: boolean;
  onModeChange: (mode: 'civilian' | 'strategic') => void;
}

export const RightPanel = ({ activeMode, isSecureSession, onModeChange }: RightPanelProps) => {
  return (
    <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-cyber-blue/20 bg-cyber-dark/40 backdrop-blur-sm p-2 md:p-4 space-y-3 md:space-y-4 overflow-y-auto max-h-[40vh] md:max-h-none">
      <ThreatDetection activeMode={activeMode} isSecureSession={isSecureSession} />
      <ControlPanel 
        activeMode={activeMode} 
        isSecureSession={isSecureSession}
        onModeChange={onModeChange}
      />
    </div>
  );
};

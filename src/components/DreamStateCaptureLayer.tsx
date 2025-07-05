
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Moon, Brain, Waves, Eye } from "lucide-react";

interface DreamMetric {
  phase: 'N1' | 'N2' | 'N3' | 'REM';
  duration: number;
  intensity: number;
  narrativeFragments: string[];
  symbolicDensity: number;
  emotionalValence: number;
}

interface SubconsciousFlow {
  id: string;
  theme: string;
  strength: number;
  trajectory: 'emerging' | 'stabilizing' | 'dissipating';
  ideologicalWeight: number;
}

export const DreamStateCaptureLayer = () => {
  const [currentPhase, setCurrentPhase] = useState<DreamMetric['phase']>('REM');
  const [remProgress, setRemProgress] = useState(67);
  const [captureActive, setCaptureActive] = useState(true);
  const [biometricSync, setBiometricSync] = useState(94.2);

  const [dreamMetrics, setDreamMetrics] = useState<DreamMetric>({
    phase: 'REM',
    duration: 23.7,
    intensity: 78,
    narrativeFragments: [
      'Floating geometric patterns',
      'Childhood memory echoes',
      'Future-state visualizations',
      'Social connection symbols'
    ],
    symbolicDensity: 0.84,
    emotionalValence: 0.62
  });

  const [subconsciousFlows, setSubconsciousFlows] = useState<SubconsciousFlow[]>([
    { id: 'SF-001', theme: 'Collective Unity', strength: 89, trajectory: 'emerging', ideologicalWeight: 0.76 },
    { id: 'SF-002', theme: 'Technological Anxiety', strength: 56, trajectory: 'dissipating', ideologicalWeight: 0.43 },
    { id: 'SF-003', theme: 'Hope Manifestation', strength: 72, trajectory: 'stabilizing', ideologicalWeight: 0.68 },
    { id: 'SF-004', theme: 'Identity Evolution', strength: 91, trajectory: 'emerging', ideologicalWeight: 0.82 }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemProgress(prev => (prev + Math.random() * 10) % 100);
      setBiometricSync(prev => Math.max(80, Math.min(100, prev + (Math.random() - 0.5) * 5)));
      
      setDreamMetrics(prev => ({
        ...prev,
        intensity: Math.max(30, Math.min(100, prev.intensity + (Math.random() - 0.5) * 15)),
        duration: prev.duration + 0.1,
        symbolicDensity: Math.max(0.3, Math.min(1, prev.symbolicDensity + (Math.random() - 0.5) * 0.1)),
        emotionalValence: Math.max(0, Math.min(1, prev.emotionalValence + (Math.random() - 0.5) * 0.2))
      }));

      setSubconsciousFlows(prev => prev.map(flow => ({
        ...flow,
        strength: Math.max(20, Math.min(100, flow.strength + (Math.random() - 0.5) * 12)),
        ideologicalWeight: Math.max(0.2, Math.min(1, flow.ideologicalWeight + (Math.random() - 0.5) * 0.1))
      })));
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const getPhaseColor = (phase: DreamMetric['phase']) => {
    switch (phase) {
      case 'N1': return 'text-cyber-blue';
      case 'N2': return 'text-cyber-green';
      case 'N3': return 'text-cyber-purple';
      case 'REM': return 'text-cyber-orange';
    }
  };

  const getTrajectoryColor = (trajectory: SubconsciousFlow['trajectory']) => {
    switch (trajectory) {
      case 'emerging': return 'bg-cyber-green text-cyber-dark';
      case 'stabilizing': return 'bg-cyber-blue text-white';
      case 'dissipating': return 'bg-cyber-red text-white';
    }
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-purple/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-purple text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Moon className="w-4 h-4 animate-pulse" />
            <span>Dream-State Capture Layer</span>
          </div>
          <Badge variant="outline" className={`border-current ${captureActive ? 'text-cyber-green' : 'text-cyber-red'}`}>
            {captureActive ? 'CAPTURING' : 'OFFLINE'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sleep Phase Status */}
        <div className="p-3 bg-cyber-purple/10 border border-cyber-purple/30 rounded">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span>Current Phase:</span>
              <span className={getPhaseColor(currentPhase)}>{currentPhase}</span>
            </div>
            <div className="flex justify-between">
              <span>REM Progress:</span>
              <span className="text-cyber-orange">{remProgress.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Biometric Sync:</span>
              <span className="text-cyber-green">{biometricSync.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Capture Rate:</span>
              <span className="text-cyber-blue">847 Hz</span>
            </div>
          </div>
        </div>

        {/* REM Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-cyber-orange">REM Cycle Progress</span>
            <span className="text-cyber-green">{remProgress.toFixed(0)}%</span>
          </div>
          <Progress value={remProgress} className="h-2 bg-cyber-darker" />
        </div>

        {/* Dream Metrics */}
        <div className="p-3 bg-cyber-blue/10 border border-cyber-blue/30 rounded">
          <div className="text-xs font-semibold text-cyber-blue mb-2 flex items-center space-x-2">
            <Brain className="w-3 h-3" />
            <span>Current Dream Metrics</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
            <div className="flex justify-between">
              <span>Duration:</span>
              <span className="text-cyber-green">{dreamMetrics.duration.toFixed(1)} min</span>
            </div>
            <div className="flex justify-between">
              <span>Intensity:</span>
              <span className="text-cyber-orange">{dreamMetrics.intensity}%</span>
            </div>
            <div className="flex justify-between">
              <span>Symbolic Density:</span>
              <span className="text-cyber-purple">{dreamMetrics.symbolicDensity.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Emotional Valence:</span>
              <span className="text-cyber-blue">{dreamMetrics.emotionalValence.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-xs text-gray-400">Narrative Fragments:</div>
            {dreamMetrics.narrativeFragments.map((fragment, index) => (
              <div key={index} className="text-xs text-cyber-green/80">
                • {fragment}
              </div>
            ))}
          </div>
        </div>

        {/* Subconscious Flows */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-purple/80 mb-2 flex items-center space-x-2">
            <Waves className="w-3 h-3" />
            <span>Subconscious Narrative Flows</span>
          </div>
          
          {subconsciousFlows.map(flow => (
            <div key={flow.id} className="p-2 rounded border border-cyber-purple/20 hover:border-cyber-purple/40 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-cyber-purple">{flow.theme}</span>
                <Badge variant="secondary" className={`text-xs ${getTrajectoryColor(flow.trajectory)}`}>
                  {flow.trajectory.toUpperCase()}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                <div className="flex justify-between">
                  <span>Strength:</span>
                  <span className="text-cyber-green">{flow.strength.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Ideological Weight:</span>
                  <span className="text-cyber-orange">{flow.ideologicalWeight.toFixed(2)}</span>
                </div>
              </div>
              
              <Progress value={flow.strength} className="h-1 bg-cyber-darker" />
            </div>
          ))}
        </div>

        {/* Forecasting */}
        <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded">
          <div className="text-xs font-semibold text-cyber-green mb-2 flex items-center space-x-2">
            <Eye className="w-3 h-3" />
            <span>Latent Ideological Emergence Forecast</span>
          </div>
          <div className="space-y-1 text-xs text-cyber-green/80">
            <div>• 73% probability of unity-theme amplification within 48h</div>
            <div>• 42% chance of technological anxiety spike in 24h</div>
            <div>• 91% likelihood of hope-resonance stabilization</div>
            <div>• 67% potential for identity-evolution narrative emergence</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

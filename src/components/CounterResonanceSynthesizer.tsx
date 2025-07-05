
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, Target, Shield, Wand2 } from "lucide-react";

interface MemeCluster {
  id: string;
  type: 'viral' | 'toxic' | 'divisive' | 'destabilizing';
  intensity: number;
  spread: number;
  counterPayload?: string;
  neutralizationProgress: number;
}

export const CounterResonanceSynthesizer = () => {
  const [memeClusters, setMemeClusters] = useState<MemeCluster[]>([
    { id: 'MC-001', type: 'viral', intensity: 89, spread: 67, counterPayload: 'Harmonic Unity Pattern', neutralizationProgress: 23 },
    { id: 'MC-002', type: 'toxic', intensity: 94, spread: 78, counterPayload: 'Empathy Amplifier', neutralizationProgress: 45 },
    { id: 'MC-003', type: 'divisive', intensity: 76, spread: 82, counterPayload: 'Bridge Resonance', neutralizationProgress: 67 },
    { id: 'MC-004', type: 'destabilizing', intensity: 91, spread: 34, counterPayload: 'Stability Anchor', neutralizationProgress: 12 }
  ]);

  const [synthesisActive, setSynthesisActive] = useState(true);
  const [payloadGeneration, setPayloadGeneration] = useState(78.4);
  const [neutralizationRate, setNeutralizationRate] = useState(42.7);

  useEffect(() => {
    const interval = setInterval(() => {
      setMemeClusters(prev => prev.map(cluster => ({
        ...cluster,
        intensity: Math.max(10, cluster.intensity - (synthesisActive ? Math.random() * 5 : -Math.random() * 3)),
        neutralizationProgress: Math.min(100, cluster.neutralizationProgress + (synthesisActive ? Math.random() * 8 : 0))
      })));
      
      setPayloadGeneration(prev => Math.max(50, Math.min(100, prev + (Math.random() - 0.5) * 10)));
      setNeutralizationRate(prev => Math.max(20, Math.min(80, prev + (Math.random() - 0.5) * 8)));
    }, 2000);

    return () => clearInterval(interval);
  }, [synthesisActive]);

  const getClusterColor = (type: MemeCluster['type']) => {
    switch (type) {
      case 'viral': return 'text-cyber-blue';
      case 'toxic': return 'text-cyber-red';
      case 'divisive': return 'text-cyber-orange';
      case 'destabilizing': return 'text-cyber-purple';
    }
  };

  const getClusterBadgeColor = (type: MemeCluster['type']) => {
    switch (type) {
      case 'viral': return 'bg-cyber-blue text-white';
      case 'toxic': return 'bg-cyber-red text-white';
      case 'divisive': return 'bg-cyber-orange text-cyber-dark';
      case 'destabilizing': return 'bg-cyber-purple text-white';
    }
  };

  const deployCounterPayload = (clusterId: string) => {
    setMemeClusters(prev => prev.map(cluster => 
      cluster.id === clusterId 
        ? { ...cluster, neutralizationProgress: Math.min(100, cluster.neutralizationProgress + 25) }
        : cluster
    ));
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-red/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-red text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wand2 className="w-4 h-4 animate-pulse" />
            <span>Counter-Resonance Synthesizer</span>
          </div>
          <Badge variant="outline" className={`border-current ${synthesisActive ? 'text-cyber-green' : 'text-cyber-red'}`}>
            {synthesisActive ? 'ACTIVE' : 'STANDBY'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Synthesis Status */}
        <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span>Payload Generation:</span>
              <span className="text-cyber-green">{payloadGeneration.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Neutralization Rate:</span>
              <span className="text-cyber-blue">{neutralizationRate.toFixed(1)}/min</span>
            </div>
            <div className="flex justify-between">
              <span>Active Clusters:</span>
              <span className="text-cyber-orange">{memeClusters.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Synthesis Mode:</span>
              <span className="text-cyber-purple">Algorithmic</span>
            </div>
          </div>
        </div>

        {/* Synthesis Control */}
        <div className="flex items-center justify-between p-3 bg-cyber-dark/40 border border-cyber-blue/30 rounded">
          <span className="text-xs text-cyber-blue">Real-time Synthesis</span>
          <Button
            size="sm"
            onClick={() => setSynthesisActive(!synthesisActive)}
            className={synthesisActive 
              ? 'bg-cyber-red/20 border border-cyber-red/50 text-cyber-red hover:bg-cyber-red/30'
              : 'bg-cyber-green/20 border border-cyber-green/50 text-cyber-green hover:bg-cyber-green/30'
            }
          >
            {synthesisActive ? 'Pause' : 'Activate'}
          </Button>
        </div>

        {/* Meme Clusters */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-red/80 mb-2 flex items-center space-x-2">
            <Target className="w-3 h-3" />
            <span>Detected Meme Clusters</span>
          </div>
          
          {memeClusters.map(cluster => (
            <div key={cluster.id} className="p-3 rounded border border-cyber-red/20 hover:border-cyber-red/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-cyber-red">{cluster.id}</span>
                  <Badge variant="secondary" className={`text-xs ${getClusterBadgeColor(cluster.type)}`}>
                    {cluster.type.toUpperCase()}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  onClick={() => deployCounterPayload(cluster.id)}
                  className="h-6 px-2 text-xs bg-cyber-green/20 border border-cyber-green/50 text-cyber-green hover:bg-cyber-green/30"
                >
                  Deploy
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                <div className="flex justify-between">
                  <span>Intensity:</span>
                  <span className={getClusterColor(cluster.type)}>{cluster.intensity.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Spread:</span>
                  <span className="text-cyber-orange">{cluster.spread.toFixed(0)}%</span>
                </div>
              </div>

              {cluster.counterPayload && (
                <div className="mb-2">
                  <div className="text-xs text-gray-400 mb-1">Counter-Payload:</div>
                  <div className="text-xs text-cyber-green">{cluster.counterPayload}</div>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Neutralization Progress:</span>
                  <span className="text-cyber-blue">{cluster.neutralizationProgress.toFixed(0)}%</span>
                </div>
                <Progress 
                  value={cluster.neutralizationProgress} 
                  className="h-1.5 bg-cyber-darker"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Payload Library */}
        <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded">
          <div className="text-xs font-semibold text-cyber-green mb-2 flex items-center space-x-2">
            <Shield className="w-3 h-3" />
            <span>Available Counter-Payloads</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-cyber-green/80">
            <div>• Unity Resonators</div>
            <div>• Empathy Amplifiers</div>
            <div>• Cognitive Bridges</div>
            <div>• Stability Anchors</div>
            <div>• Hope Frequencies</div>
            <div>• Truth Enhancers</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

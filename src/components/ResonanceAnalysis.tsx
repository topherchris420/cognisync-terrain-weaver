
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface ResonancePattern {
  id: string;
  name: string;
  intensity: number;
  frequency: number;
  phase: number;
  stability: 'anchored' | 'drifting' | 'volatile';
}

export const ResonanceAnalysis = () => {
  const [patterns, setPatterns] = useState<ResonancePattern[]>([
    { id: '1', name: 'Unity Narrative', intensity: 78, frequency: 2.4, phase: 45, stability: 'anchored' },
    { id: '2', name: 'Crisis Response', intensity: 92, frequency: 1.8, phase: 120, stability: 'volatile' },
    { id: '3', name: 'Hope Resonance', intensity: 65, frequency: 3.2, phase: 200, stability: 'drifting' },
    { id: '4', name: 'Fear Amplification', intensity: 41, frequency: 0.9, phase: 310, stability: 'anchored' },
  ]);

  const [drrData, setDrrData] = useState<Array<{ time: number; value: number }>>([]);

  useEffect(() => {
    // Simulate DRR (Dynamic Resonance Rooting) data
    const generateDRRData = () => {
      const newData = Array.from({ length: 20 }, (_, i) => ({
        time: i,
        value: Math.sin(i * 0.3) * 30 + 50 + Math.random() * 10
      }));
      setDrrData(newData);
    };

    generateDRRData();
    const interval = setInterval(generateDRRData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update pattern intensities
    const interval = setInterval(() => {
      setPatterns(prev => prev.map(pattern => ({
        ...pattern,
        intensity: Math.max(0, Math.min(100, pattern.intensity + (Math.random() - 0.5) * 15)),
        phase: (pattern.phase + pattern.frequency * 10) % 360
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStabilityColor = (stability: ResonancePattern['stability']) => {
    switch (stability) {
      case 'anchored': return 'bg-cyber-green text-cyber-dark';
      case 'drifting': return 'bg-cyber-orange text-cyber-dark';
      case 'volatile': return 'bg-cyber-red text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity > 80) return 'text-cyber-red';
    if (intensity > 60) return 'text-cyber-orange';
    if (intensity > 40) return 'text-cyber-blue';
    return 'text-cyber-green';
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-purple/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-purple text-sm">
          Dynamic Resonance Rooting (DRR)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* DRR Chart */}
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={drrData}>
              <XAxis hide />
              <YAxis hide />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#b84dff" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Resonance Patterns */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-purple/80 mb-2">
            Active Resonance Patterns
          </div>
          {patterns.map(pattern => (
            <div key={pattern.id} className="p-2 rounded border border-cyber-purple/20 hover:border-cyber-purple/40 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-cyber-purple">
                  {pattern.name}
                </span>
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${getStabilityColor(pattern.stability)}`}
                >
                  {pattern.stability.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span>
                    Intensity: <span className={getIntensityColor(pattern.intensity)}>
                      {Math.round(pattern.intensity)}%
                    </span>
                  </span>
                  <span className="text-cyber-blue">
                    Freq: {pattern.frequency.toFixed(1)}Hz
                  </span>
                </div>
                <span className="text-cyber-green">
                  Phase: {Math.round(pattern.phase)}°
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Root Anchors */}
        <div className="p-3 bg-cyber-purple/10 border border-cyber-purple/30 rounded">
          <div className="text-xs font-semibold text-cyber-purple mb-2">
            Root Anchor Status
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Primary Anchors:</span>
              <span className="text-cyber-green">8 Active</span>
            </div>
            <div className="flex justify-between">
              <span>Drift Rate:</span>
              <span className="text-cyber-orange">0.3°/min</span>
            </div>
            <div className="flex justify-between">
              <span>Coherence:</span>
              <span className="text-cyber-blue">84.2%</span>
            </div>
            <div className="flex justify-between">
              <span>Stability:</span>
              <span className="text-cyber-green">Nominal</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

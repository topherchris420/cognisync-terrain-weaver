import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Box, RotateCcw, Maximize, Eye } from "lucide-react";

interface DimensionControl {
  name: string;
  value: number;
  range: [number, number];
  unit: string;
}

export const HolographicResonanceAtlas = () => {
  const [dimensions, setDimensions] = useState<DimensionControl[]>([
    { name: 'X-Space', value: 0, range: [-100, 100], unit: 'units' },
    { name: 'Y-Space', value: 0, range: [-100, 100], unit: 'units' },
    { name: 'Z-Space', value: 0, range: [-100, 100], unit: 'units' },
    { name: 'Time', value: 0, range: [-50, 50], unit: 'τ' },
    { name: 'Symbolic Magnitude', value: 75, range: [0, 200], unit: 'ψ' },
    { name: 'Decoherence Index', value: 25, range: [0, 100], unit: 'δ' }
  ]);

  const [hologramIntensity, setHologramIntensity] = useState(87.3);
  const [renderMode, setRenderMode] = useState<'full' | 'slice' | 'projection'>('full');
  const [phaseAlignment, setPhaseAlignment] = useState(0.92);

  useEffect(() => {
    const interval = setInterval(() => {
      setHologramIntensity(prev => Math.max(60, Math.min(100, prev + (Math.random() - 0.5) * 10)));
      setPhaseAlignment(prev => Math.max(0.7, Math.min(1, prev + (Math.random() - 0.5) * 0.1)));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const updateDimension = (index: number, newValue: number[]) => {
    setDimensions(prev => prev.map((dim, i) => 
      i === index ? { ...dim, value: newValue[0] } : dim
    ));
  };

  const resetDimensions = () => {
    setDimensions(prev => prev.map(dim => ({ ...dim, value: 0 })));
  };

  const getRenderModeColor = (mode: typeof renderMode) => {
    switch (mode) {
      case 'full': return 'bg-cyber-green text-cyber-dark';
      case 'slice': return 'bg-cyber-blue text-white';
      case 'projection': return 'bg-cyber-purple text-white';
    }
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-purple/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-purple text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Box className="w-4 h-4 animate-cognitive-pulse" />
            <span>Holographic Resonance Atlas (6D)</span>
          </div>
          <Badge variant="outline" className="border-cyber-purple text-cyber-purple">
            {hologramIntensity.toFixed(1)}% Intensity
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase Alignment Status */}
        <div className="p-3 bg-cyber-purple/10 border border-cyber-purple/30 rounded">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span>Phase Alignment:</span>
              <span className="text-cyber-green">{(phaseAlignment * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Render Mode:</span>
              <Badge variant="secondary" className={`text-xs ${getRenderModeColor(renderMode)}`}>
                {renderMode.toUpperCase()}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Hologram Stability:</span>
              <span className="text-cyber-blue">{hologramIntensity > 80 ? 'Stable' : 'Fluctuating'}</span>
            </div>
            <div className="flex justify-between">
              <span>6D Coordinates:</span>
              <span className="text-cyber-orange">Active</span>
            </div>
          </div>
        </div>

        {/* 6D Controls */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-cyber-purple/80 mb-2 flex items-center space-x-2">
            <Eye className="w-3 h-3" />
            <span>6-Dimensional Navigation</span>
          </div>
          
          {dimensions.map((dim, index) => (
            <div key={dim.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-cyber-purple">{dim.name}</span>
                <span className="text-cyber-green">
                  {dim.value.toFixed(1)} {dim.unit}
                </span>
              </div>
              <Slider
                value={[dim.value]}
                onValueChange={(value) => updateDimension(index, value)}
                min={dim.range[0]}
                max={dim.range[1]}
                step={0.1}
                className="w-full"
              />
            </div>
          ))}
        </div>

        {/* Render Mode Controls */}
        <div className="grid grid-cols-3 gap-2">
          {(['full', 'slice', 'projection'] as const).map(mode => (
            <Button
              key={mode}
              size="sm"
              onClick={() => setRenderMode(mode)}
              className={`text-xs ${renderMode === mode 
                ? 'bg-cyber-purple text-white' 
                : 'bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/30'
              }`}
            >
              {mode.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* Control Actions */}
        <div className="flex space-x-2">
          <Button 
            size="sm" 
            onClick={resetDimensions}
            className="flex-1 bg-cyber-orange/20 border border-cyber-orange/50 hover:bg-cyber-orange/30 text-cyber-orange"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
          <Button 
            size="sm" 
            className="flex-1 bg-cyber-green/20 border border-cyber-green/50 hover:bg-cyber-green/30 text-cyber-green"
          >
            <Maximize className="w-3 h-3 mr-1" />
            Maximize
          </Button>
        </div>

        {/* Resonance Hotspots */}
        <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded">
          <div className="text-xs font-semibold text-cyber-green mb-2">
            Detected Resonance Hotspots
          </div>
          <div className="space-y-1 text-xs text-cyber-green/80">
            <div>• Symbolic Convergence at (12.4, 45.7, -8.2, +2.1τ, 156ψ, 23δ)</div>
            <div>• Temporal Echo at (-34.1, 12.9, 67.3, -1.8τ, 89ψ, 45δ)</div>
            <div>• Narrative Vortex at (78.2, -23.4, 12.7, +4.3τ, 203ψ, 67δ)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

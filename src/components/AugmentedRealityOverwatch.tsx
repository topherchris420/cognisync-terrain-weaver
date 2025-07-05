
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Glasses, Drone, MapPin, Crosshair } from "lucide-react";

interface AROverlay {
  id: string;
  type: 'threat' | 'resonance' | 'stability' | 'influence';
  location: { x: number; y: number; z: number };
  intensity: number;
  confidence: number;
  description: string;
}

interface DroneSwarm {
  id: string;
  position: string;
  status: 'active' | 'deploying' | 'returning';
  battery: number;
  projectionRange: number;
}

export const AugmentedRealityOverwatch = () => {
  const [arActive, setArActive] = useState(true);
  const [headsetConnected, setHeadsetConnected] = useState(true);
  const [overlayDensity, setOverlayDensity] = useState(67);
  const [projectionIntensity, setProjectionIntensity] = useState(84.3);

  const [arOverlays, setArOverlays] = useState<AROverlay[]>([
    { id: 'AR-001', type: 'threat', location: { x: 12.4, y: 34.7, z: 2.1 }, intensity: 78, confidence: 92, description: 'Destabilizing narrative cluster' },
    { id: 'AR-002', type: 'resonance', location: { x: -8.2, y: 45.1, z: 1.8 }, intensity: 89, confidence: 87, description: 'Positive unity resonance' },
    { id: 'AR-003', type: 'stability', location: { x: 23.7, y: -12.4, z: 3.2 }, intensity: 56, confidence: 73, description: 'Anchor point stabilization' },
    { id: 'AR-004', type: 'influence', location: { x: -15.8, y: 67.3, z: 0.9 }, intensity: 94, confidence: 88, description: 'Counter-resonance deployment zone' }
  ]);

  const [droneSwarms, setDroneSwarms] = useState<DroneSwarm[]>([
    { id: 'DS-Alpha', position: 'Urban Sector 7', status: 'active', battery: 87, projectionRange: 250 },
    { id: 'DS-Beta', position: 'Financial District', status: 'deploying', battery: 92, projectionRange: 180 },
    { id: 'DS-Gamma', position: 'University Campus', status: 'active', battery: 73, projectionRange: 320 }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setArOverlays(prev => prev.map(overlay => ({
        ...overlay,
        intensity: Math.max(20, Math.min(100, overlay.intensity + (Math.random() - 0.5) * 15)),
        confidence: Math.max(60, Math.min(100, overlay.confidence + (Math.random() - 0.5) * 8))
      })));

      setDroneSwarms(prev => prev.map(drone => ({
        ...drone,
        battery: Math.max(20, drone.battery - Math.random() * 2),
        projectionRange: Math.max(100, Math.min(400, drone.projectionRange + (Math.random() - 0.5) * 20))
      })));

      setProjectionIntensity(prev => Math.max(70, Math.min(100, prev + (Math.random() - 0.5) * 8)));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getOverlayColor = (type: AROverlay['type']) => {
    switch (type) {
      case 'threat': return 'text-cyber-red';
      case 'resonance': return 'text-cyber-green';
      case 'stability': return 'text-cyber-blue';
      case 'influence': return 'text-cyber-purple';
    }
  };

  const getOverlayBadgeColor = (type: AROverlay['type']) => {
    switch (type) {
      case 'threat': return 'bg-cyber-red text-white';
      case 'resonance': return 'bg-cyber-green text-cyber-dark';
      case 'stability': return 'bg-cyber-blue text-white';
      case 'influence': return 'bg-cyber-purple text-white';
    }
  };

  const getStatusColor = (status: DroneSwarm['status']) => {
    switch (status) {
      case 'active': return 'bg-cyber-green text-cyber-dark';
      case 'deploying': return 'bg-cyber-orange text-cyber-dark';
      case 'returning': return 'bg-cyber-blue text-white';
    }
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-green/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-green text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Glasses className="w-4 h-4 animate-pulse-glow" />
            <span>Augmented Reality Overwatch</span>
          </div>
          <Badge variant="outline" className={`border-current ${arActive && headsetConnected ? 'text-cyber-green' : 'text-cyber-red'}`}>
            {arActive && headsetConnected ? 'ACTIVE' : 'OFFLINE'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Status */}
        <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span>Headset Status:</span>
              <span className={headsetConnected ? 'text-cyber-green' : 'text-cyber-red'}>
                {headsetConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Projection Intensity:</span>
              <span className="text-cyber-blue">{projectionIntensity.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Overlay Density:</span>
              <span className="text-cyber-purple">{overlayDensity}%</span>
            </div>
            <div className="flex justify-between">
              <span>Active Drones:</span>
              <span className="text-cyber-orange">{droneSwarms.filter(d => d.status === 'active').length}</span>
            </div>
          </div>
        </div>

        {/* AR Controls */}
        <div className="flex space-x-2">
          <Button
            size="sm"
            onClick={() => setArActive(!arActive)}
            className={`flex-1 ${arActive 
              ? 'bg-cyber-red/20 border border-cyber-red/50 text-cyber-red hover:bg-cyber-red/30'
              : 'bg-cyber-green/20 border border-cyber-green/50 text-cyber-green hover:bg-cyber-green/30'
            }`}
          >
            {arActive ? 'Disable AR' : 'Enable AR'}
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-cyber-blue/20 border border-cyber-blue/50 text-cyber-blue hover:bg-cyber-blue/30"
          >
            Calibrate
          </Button>
        </div>

        {/* AR Overlays */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-green/80 mb-2 flex items-center space-x-2">
            <Crosshair className="w-3 h-3" />
            <span>Active AR Overlays</span>
          </div>
          
          {arOverlays.map(overlay => (
            <div key={overlay.id} className="p-2 rounded border border-cyber-green/20 hover:border-cyber-green/40 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-3 h-3 text-cyber-green" />
                  <span className="text-xs font-medium text-cyber-green">{overlay.id}</span>
                  <Badge variant="secondary" className={`text-xs ${getOverlayBadgeColor(overlay.type)}`}>
                    {overlay.type.toUpperCase()}
                  </Badge>
                </div>
                <span className="text-xs text-cyber-blue">{overlay.confidence}% conf</span>
              </div>
              
              <div className="text-xs text-gray-300 mb-2">{overlay.description}</div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between">
                  <span>Position:</span>
                  <span className="text-cyber-purple">
                    ({overlay.location.x.toFixed(1)}, {overlay.location.y.toFixed(1)}, {overlay.location.z.toFixed(1)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Intensity:</span>
                  <span className={getOverlayColor(overlay.type)}>{overlay.intensity}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Drone Swarms */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-green/80 mb-2 flex items-center space-x-2">
            <Drone className="w-3 h-3" />
            <span>Projection Drone Swarms</span>
          </div>
          
          {droneSwarms.map(drone => (
            <div key={drone.id} className="p-2 rounded border border-cyber-green/20 hover:border-cyber-green/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-cyber-green">{drone.id}</span>
                  <Badge variant="secondary" className={`text-xs ${getStatusColor(drone.status)}`}>
                    {drone.status.toUpperCase()}
                  </Badge>
                </div>
                <span className="text-xs text-cyber-blue">{drone.position}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                <div className="flex justify-between">
                  <span>Battery:</span>
                  <span className="text-cyber-green">{drone.battery.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Range:</span>
                  <span className="text-cyber-orange">{drone.projectionRange}m</span>
                </div>
              </div>
              
              <Progress value={drone.battery} className="h-1 bg-cyber-darker" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

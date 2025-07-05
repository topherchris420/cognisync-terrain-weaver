
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, GitBranch, Target, Zap } from "lucide-react";

interface BifurcationPoint {
  id: string;
  timestamp: Date;
  probability: number;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  influenceVector: string;
  interventionStatus: 'pending' | 'active' | 'completed';
}

interface MediaIntervention {
  id: string;
  platform: string;
  contentType: 'narrative' | 'symbolic' | 'emotional';
  deploymentStatus: 'queued' | 'deploying' | 'active' | 'completed';
  reach: number;
  effectiveness: number;
}

export const TimelineConvergenceController = () => {
  const [convergenceActive, setConvergenceActive] = useState(true);
  const [bifurcationDetection, setBifurcationDetection] = useState(92.7);
  const [interventionSuccess, setInterventionSuccess] = useState(78.4);
  const [timelineStability, setTimelineStability] = useState(84.2);

  const [bifurcationPoints, setBifurcationPoints] = useState<BifurcationPoint[]>([
    {
      id: 'BP-001',
      timestamp: new Date(Date.now() + 3600000),
      probability: 87,
      impactLevel: 'high',
      description: 'Political narrative convergence point',
      influenceVector: 'Unity amplification protocol',
      interventionStatus: 'active'
    },
    {
      id: 'BP-002',
      timestamp: new Date(Date.now() + 7200000),
      probability: 94,
      impactLevel: 'critical',
      description: 'Economic sentiment bifurcation',
      influenceVector: 'Stability anchor deployment',
      interventionStatus: 'pending'
    },
    {
      id: 'BP-003',
      timestamp: new Date(Date.now() + 10800000),
      probability: 73,
      impactLevel: 'medium',
      description: 'Social cohesion decision node',
      influenceVector: 'Empathy resonance boost',
      interventionStatus: 'completed'
    }
  ]);

  const [mediaInterventions, setMediaInterventions] = useState<MediaIntervention[]>([
    { id: 'MI-001', platform: 'Social Network Alpha', contentType: 'narrative', deploymentStatus: 'active', reach: 2.4e6, effectiveness: 89 },
    { id: 'MI-002', platform: 'News Aggregator Beta', contentType: 'symbolic', deploymentStatus: 'deploying', reach: 1.8e6, effectiveness: 76 },
    { id: 'MI-003', platform: 'Video Platform Gamma', contentType: 'emotional', deploymentStatus: 'queued', reach: 3.1e6, effectiveness: 0 }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBifurcationDetection(prev => Math.max(80, Math.min(100, prev + (Math.random() - 0.5) * 8)));
      setInterventionSuccess(prev => Math.max(60, Math.min(95, prev + (Math.random() - 0.5) * 10)));
      setTimelineStability(prev => Math.max(70, Math.min(100, prev + (Math.random() - 0.5) * 6)));

      setBifurcationPoints(prev => prev.map(point => ({
        ...point,
        probability: Math.max(30, Math.min(100, point.probability + (Math.random() - 0.5) * 12))
      })));

      setMediaInterventions(prev => prev.map(intervention => ({
        ...intervention,
        effectiveness: intervention.deploymentStatus === 'active' 
          ? Math.max(50, Math.min(100, intervention.effectiveness + (Math.random() - 0.5) * 8))
          : intervention.effectiveness,
        reach: intervention.deploymentStatus === 'active'
          ? intervention.reach + Math.floor((Math.random() - 0.5) * 100000)
          : intervention.reach
      })));
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const getImpactColor = (level: BifurcationPoint['impactLevel']) => {
    switch (level) {
      case 'low': return 'bg-cyber-green text-cyber-dark';
      case 'medium': return 'bg-cyber-blue text-white';
      case 'high': return 'bg-cyber-orange text-cyber-dark';
      case 'critical': return 'bg-cyber-red text-white animate-pulse';
    }
  };

  const getInterventionStatusColor = (status: BifurcationPoint['interventionStatus']) => {
    switch (status) {
      case 'pending': return 'text-cyber-orange';
      case 'active': return 'text-cyber-blue animate-pulse';
      case 'completed': return 'text-cyber-green';
    }
  };

  const getDeploymentStatusColor = (status: MediaIntervention['deploymentStatus']) => {
    switch (status) {
      case 'queued': return 'bg-gray-500 text-white';
      case 'deploying': return 'bg-cyber-orange text-cyber-dark';
      case 'active': return 'bg-cyber-green text-cyber-dark';
      case 'completed': return 'bg-cyber-blue text-white';
    }
  };

  const executeIntervention = (bifurcationId: string) => {
    setBifurcationPoints(prev => prev.map(point => 
      point.id === bifurcationId 
        ? { ...point, interventionStatus: 'active' }
        : point
    ));
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-orange/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-orange text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 animate-cognitive-pulse" />
            <span>Timeline Convergence Controller</span>
          </div>
          <Badge variant="outline" className={`border-current ${convergenceActive ? 'text-cyber-green' : 'text-cyber-red'}`}>
            {convergenceActive ? 'ACTIVE' : 'STANDBY'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Status */}
        <div className="p-3 bg-cyber-orange/10 border border-cyber-orange/30 rounded">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span>Bifurcation Detection:</span>
              <span className="text-cyber-green">{bifurcationDetection.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Timeline Stability:</span>
              <span className="text-cyber-blue">{timelineStability.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Intervention Success:</span>
              <span className="text-cyber-purple">{interventionSuccess.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Active Interventions:</span>
              <span className="text-cyber-orange">{bifurcationPoints.filter(p => p.interventionStatus === 'active').length}</span>
            </div>
          </div>
        </div>

        {/* Timeline Stability */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-cyber-orange">Timeline Stability Index</span>
            <span className="text-cyber-green">{timelineStability.toFixed(1)}%</span>
          </div>
          <Progress value={timelineStability} className="h-2 bg-cyber-darker" />
        </div>

        {/* Bifurcation Points */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-orange/80 mb-2 flex items-center space-x-2">
            <GitBranch className="w-3 h-3" />
            <span>Detected Bifurcation Hotspots</span>
          </div>
          
          {bifurcationPoints.map(point => (
            <div key={point.id} className="p-3 rounded border border-cyber-orange/20 hover:border-cyber-orange/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-cyber-orange">{point.id}</span>
                  <Badge variant="secondary" className={`text-xs ${getImpactColor(point.impactLevel)}`}>
                    {point.impactLevel.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs ${getInterventionStatusColor(point.interventionStatus)}`}>
                    {point.interventionStatus.toUpperCase()}
                  </span>
                  {point.interventionStatus === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => executeIntervention(point.id)}
                      className="h-5 px-2 text-xs bg-cyber-green/20 border border-cyber-green/50 text-cyber-green hover:bg-cyber-green/30"
                    >
                      Execute
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="text-xs text-gray-300 mb-2">{point.description}</div>
              
              <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                <div className="flex justify-between">
                  <span>Probability:</span>
                  <span className="text-cyber-red">{point.probability}%</span>
                </div>
                <div className="flex justify-between">
                  <span>ETA:</span>
                  <span className="text-cyber-blue">
                    {Math.round((point.timestamp.getTime() - Date.now()) / 60000)}min
                  </span>
                </div>
              </div>
              
              <div className="text-xs">
                <span className="text-gray-400">Influence Vector: </span>
                <span className="text-cyber-green">{point.influenceVector}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Media Interventions */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-orange/80 mb-2 flex items-center space-x-2">
            <Target className="w-3 h-3" />
            <span>Media API Interventions</span>
          </div>
          
          {mediaInterventions.map(intervention => (
            <div key={intervention.id} className="p-2 rounded border border-cyber-orange/20 hover:border-cyber-orange/40 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-cyber-orange">{intervention.platform}</span>
                <Badge variant="secondary" className={`text-xs ${getDeploymentStatusColor(intervention.deploymentStatus)}`}>
                  {intervention.deploymentStatus.toUpperCase()}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between">
                  <span>Content Type:</span>
                  <span className="text-cyber-purple">{intervention.contentType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reach:</span>
                  <span className="text-cyber-blue">{(intervention.reach / 1e6).toFixed(1)}M</span>
                </div>
                <div className="flex justify-between">
                  <span>Effectiveness:</span>
                  <span className="text-cyber-green">{intervention.effectiveness}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* System Controls */}
        <div className="flex space-x-2">
          <Button
            size="sm"
            onClick={() => setConvergenceActive(!convergenceActive)}
            className={`flex-1 ${convergenceActive 
              ? 'bg-cyber-red/20 border border-cyber-red/50 text-cyber-red hover:bg-cyber-red/30'
              : 'bg-cyber-green/20 border border-cyber-green/50 text-cyber-green hover:bg-cyber-green/30'
            }`}
          >
            {convergenceActive ? 'Pause' : 'Activate'}
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/30"
          >
            <Zap className="w-3 h-3 mr-1" />
            Emergency Override
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

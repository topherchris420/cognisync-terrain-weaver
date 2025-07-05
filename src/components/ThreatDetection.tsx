
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

interface ThreatAlert {
  id: string;
  type: 'narrative' | 'symbolic' | 'coherence' | 'behavioral';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location?: string;
  timestamp: Date;
  confidence: number;
}

interface ThreatDetectionProps {
  activeMode: 'civilian' | 'strategic';
  isSecureSession: boolean;
}

export const ThreatDetection = ({ activeMode, isSecureSession }: ThreatDetectionProps) => {
  const [threats, setThreats] = useState<ThreatAlert[]>([]);
  const [threatLevel, setThreatLevel] = useState<'green' | 'yellow' | 'orange' | 'red'>('green');

  useEffect(() => {
    // Generate threat alerts based on mode
    const generateThreats = () => {
      const civilianThreats: ThreatAlert[] = [
        {
          id: '1',
          type: 'coherence',
          severity: 'low',
          title: 'Mild Anxiety Spike',
          description: 'Localized stress pattern detected in wellness metrics',
          confidence: 67,
          timestamp: new Date()
        },
        {
          id: '2',
          type: 'narrative',
          severity: 'medium',
          title: 'Negative Sentiment Cluster',
          description: 'Increased negative social media sentiment in health discussions',
          confidence: 78,
          timestamp: new Date()
        }
      ];

      const strategicThreats: ThreatAlert[] = [
        {
          id: '3',
          type: 'symbolic',
          severity: 'high',
          title: 'Symbolic Overload Detected',
          description: 'Coordinated manipulation of key cultural symbols identified',
          location: 'Sector 7-Alpha',
          confidence: 91,
          timestamp: new Date()
        },
        {
          id: '4',
          type: 'narrative',
          severity: 'critical',
          title: 'Destabilizing Narrative Vector',
          description: 'Multi-platform coordinated disinformation campaign active',
          location: 'Multiple vectors',
          confidence: 95,
          timestamp: new Date()
        },
        {
          id: '5',
          type: 'behavioral',
          severity: 'medium',
          title: 'Anomalous Behavioral Pattern',
          description: 'Unusual crowd dynamics suggesting external influence',
          location: 'Urban Zone 12',
          confidence: 73,
          timestamp: new Date()
        }
      ];

      if (activeMode === 'strategic' && isSecureSession) {
        setThreats([...civilianThreats, ...strategicThreats]);
        setThreatLevel('orange');
      } else {
        setThreats(civilianThreats);
        setThreatLevel('yellow');
      }
    };

    generateThreats();
    const interval = setInterval(generateThreats, 10000);
    return () => clearInterval(interval);
  }, [activeMode, isSecureSession]);

  const getSeverityColor = (severity: ThreatAlert['severity']) => {
    switch (severity) {
      case 'low': return 'bg-cyber-green text-cyber-dark';
      case 'medium': return 'bg-cyber-orange text-cyber-dark';
      case 'high': return 'bg-red-500 text-white';
      case 'critical': return 'bg-cyber-red text-white animate-pulse';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getTypeIcon = (type: ThreatAlert['type']) => {
    switch (type) {
      case 'narrative': return '📰';
      case 'symbolic': return '🎭';
      case 'coherence': return '🧠';
      case 'behavioral': return '👥';
      default: return '⚠️';
    }
  };

  const getThreatLevelColor = (level: typeof threatLevel) => {
    switch (level) {
      case 'green': return 'text-cyber-green';
      case 'yellow': return 'text-yellow-400';
      case 'orange': return 'text-cyber-orange';
      case 'red': return 'text-cyber-red';
      default: return 'text-gray-400';
    }
  };

  const dismissThreat = (id: string) => {
    setThreats(prev => prev.filter(threat => threat.id !== id));
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-red/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-red text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Threat Detection</span>
          </div>
          <Badge 
            variant="outline" 
            className={`border-current ${getThreatLevelColor(threatLevel)}`}
          >
            {threatLevel.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Threat Level Indicator */}
        <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cyber-red">
              Current Threat Level
            </span>
            <div className={`w-3 h-3 rounded-full ${getThreatLevelColor(threatLevel) === 'text-cyber-red' ? 'bg-cyber-red animate-pulse' : 'bg-cyber-orange'}`}></div>
          </div>
          <div className="text-xs text-cyber-red/80">
            {activeMode === 'strategic' 
              ? 'Enhanced monitoring active - Multiple threat vectors detected'
              : 'Standard monitoring - Routine wellness patterns observed'
            }
          </div>
        </div>

        {/* Active Threats */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-red/80 mb-2">
            Active Threat Alerts ({threats.length})
          </div>
          
          {threats.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">
              No active threats detected
            </div>
          ) : (
            threats.map(threat => (
              <Alert key={threat.id} className="border-cyber-red/30 bg-cyber-red/5 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <span className="text-sm">{getTypeIcon(threat.type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-semibold text-cyber-red">
                          {threat.title}
                        </span>
                        <Badge 
                          variant="secondary"
                          className={`text-xs ${getSeverityColor(threat.severity)}`}
                        >
                          {threat.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <AlertDescription className="text-xs text-gray-300 mb-2">
                        {threat.description}
                      </AlertDescription>
                      <div className="flex items-center justify-between text-xs">
                        <div className="space-x-2">
                          {threat.location && (
                            <span className="text-cyber-blue">📍 {threat.location}</span>
                          )}
                          <span className="text-cyber-green">
                            {threat.confidence}% confidence
                          </span>
                        </div>
                        <span className="text-gray-400">
                          {threat.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissThreat(threat.id)}
                    className="h-6 w-6 p-0 text-cyber-red/60 hover:text-cyber-red"
                  >
                    ×
                  </Button>
                </div>
              </Alert>
            ))
          )}
        </div>

        {/* Influence Suggestions */}
        {isSecureSession && (
          <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded">
            <div className="text-xs font-semibold text-cyber-green mb-2">
              Suggested Countermeasures
            </div>
            <div className="space-y-1 text-xs text-cyber-green/80">
              <div>• Deploy positive narrative anchors in affected regions</div>
              <div>• Increase symbolic stabilization protocols</div>
              <div>• Activate community resilience networks</div>
              <div>• Initialize counter-narrative propagation</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

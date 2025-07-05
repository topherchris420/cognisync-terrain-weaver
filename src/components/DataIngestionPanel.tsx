
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface DataIngestionPanelProps {
  activeMode: 'civilian' | 'strategic';
}

interface DataStream {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'biometric' | 'geolocation' | 'social' | 'environmental';
  status: 'active' | 'paused' | 'error';
  rate: number;
  volume: number;
}

export const DataIngestionPanel = ({ activeMode }: DataIngestionPanelProps) => {
  const [streams, setStreams] = useState<DataStream[]>([
    { id: '1', name: 'Social Media Feed', type: 'social', status: 'active', rate: 85, volume: 2400 },
    { id: '2', name: 'Voice Analysis', type: 'voice', status: 'active', rate: 67, volume: 156 },
    { id: '3', name: 'Biometric Sensors', type: 'biometric', status: 'active', rate: 92, volume: 89 },
    { id: '4', name: 'Geographic Data', type: 'geolocation', status: 'active', rate: 73, volume: 445 },
    { id: '5', name: 'Text Processing', type: 'text', status: 'active', rate: 88, volume: 1200 },
    { id: '6', name: 'Environmental', type: 'environmental', status: 'paused', rate: 0, volume: 0 },
  ]);

  const [totalIngestion, setTotalIngestion] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStreams(prev => prev.map(stream => ({
        ...stream,
        rate: stream.status === 'active' ? Math.max(20, Math.min(100, stream.rate + (Math.random() - 0.5) * 20)) : 0,
        volume: stream.status === 'active' ? stream.volume + Math.floor(Math.random() * 10) : stream.volume
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const total = streams.reduce((sum, stream) => sum + stream.rate, 0) / streams.length;
    setTotalIngestion(total);
  }, [streams]);

  const getStreamColor = (type: DataStream['type']) => {
    switch (type) {
      case 'social': return 'text-cyber-blue';
      case 'voice': return 'text-cyber-purple';
      case 'biometric': return 'text-cyber-green';
      case 'geolocation': return 'text-cyber-orange';
      case 'text': return 'text-cyan-400';
      case 'environmental': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusColor = (status: DataStream['status']) => {
    switch (status) {
      case 'active': return 'bg-cyber-green';
      case 'paused': return 'bg-yellow-500';
      case 'error': return 'bg-cyber-red';
      default: return 'bg-gray-500';
    }
  };

  const toggleStream = (id: string) => {
    setStreams(prev => prev.map(stream => 
      stream.id === id 
        ? { ...stream, status: stream.status === 'active' ? 'paused' : 'active' }
        : stream
    ));
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-blue/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-blue text-sm flex items-center justify-between">
          Multi-Modal Data Ingestion
          <Badge variant="outline" className="border-cyber-green text-cyber-green">
            {Math.round(totalIngestion)}% Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Total Ingestion Rate</span>
            <span className="text-cyber-green">{Math.round(totalIngestion)}%</span>
          </div>
          <Progress 
            value={totalIngestion} 
            className="h-2 bg-cyber-darker"
          />
        </div>

        {/* Data Streams */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-blue/80 mb-2">
            Active Data Streams
          </div>
          {streams.map(stream => (
            <div key={stream.id} className="flex items-center justify-between p-2 rounded border border-cyber-blue/20 hover:border-cyber-blue/40 transition-colors">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(stream.status)} animate-pulse`}></div>
                <div>
                  <div className={`text-xs font-medium ${getStreamColor(stream.type)}`}>
                    {stream.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {stream.volume.toLocaleString()} units/min
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-xs text-right">
                  <div className="text-cyber-green">{Math.round(stream.rate)}%</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleStream(stream.id)}
                  className="h-6 w-12 text-xs border border-cyber-blue/30 hover:border-cyber-blue/60"
                >
                  {stream.status === 'active' ? 'Pause' : 'Start'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {activeMode === 'strategic' && (
          <div className="mt-4 p-3 bg-cyber-red/10 border border-cyber-red/30 rounded">
            <div className="text-xs font-semibold text-cyber-red mb-2">
              Strategic Data Sources
            </div>
            <div className="text-xs text-cyber-red/80 space-y-1">
              <div>• Classified Signal Intelligence</div>
              <div>• Deep Web Monitoring</div>
              <div>• Behavioral Pattern Analysis</div>
              <div>• Predictive Threat Modeling</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

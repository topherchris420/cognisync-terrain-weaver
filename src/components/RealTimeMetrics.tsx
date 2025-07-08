
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Zap, Brain, Target } from "lucide-react";

interface Metric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'optimal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

export const RealTimeMetrics = () => {
  const [metrics, setMetrics] = useState<Metric[]>([
    { id: '1', name: 'Cognitive Load', value: 73, unit: '%', status: 'optimal', trend: 'stable' },
    { id: '2', name: 'Neural Sync', value: 89, unit: 'Hz', status: 'optimal', trend: 'up' },
    { id: '3', name: 'Threat Level', value: 12, unit: '', status: 'optimal', trend: 'down' },
    { id: '4', name: 'Field Coherence', value: 94, unit: '%', status: 'optimal', trend: 'up' },
    { id: '5', name: 'Quantum Entanglement', value: 67, unit: 'qubits', status: 'warning', trend: 'stable' },
    { id: '6', name: 'Timeline Stability', value: 98, unit: '%', status: 'optimal', trend: 'stable' },
  ]);

  const [systemHealth, setSystemHealth] = useState(95);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => prev.map(metric => {
        const variation = (Math.random() - 0.5) * 10;
        const newValue = Math.max(0, Math.min(100, metric.value + variation));
        
        let status: Metric['status'] = 'optimal';
        if (metric.name === 'Threat Level') {
          status = newValue > 50 ? 'critical' : newValue > 25 ? 'warning' : 'optimal';
        } else {
          status = newValue < 30 ? 'critical' : newValue < 60 ? 'warning' : 'optimal';
        }
        
        const trend: Metric['trend'] = 
          Math.abs(variation) < 2 ? 'stable' : 
          variation > 0 ? 'up' : 'down';

        return {
          ...metric,
          value: newValue,
          status,
          trend
        };
      }));

      // Update system health
      setSystemHealth(prev => Math.max(80, Math.min(100, prev + (Math.random() - 0.5) * 5)));
      
      // Update alert count
      setAlertCount(prev => {
        const change = Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        return Math.max(0, prev + change);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: Metric['status']) => {
    switch (status) {
      case 'optimal': return 'text-cyber-green';
      case 'warning': return 'text-cyber-orange';
      case 'critical': return 'text-cyber-red';
      default: return 'text-cyber-blue';
    }
  };

  const getStatusBadge = (status: Metric['status']) => {
    const colors = {
      optimal: 'bg-cyber-green',
      warning: 'bg-cyber-orange',
      critical: 'bg-cyber-red'
    };
    return colors[status];
  };

  const getTrendIcon = (trend: Metric['trend']) => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      case 'stable': return '→';
    }
  };

  const criticalMetrics = metrics.filter(m => m.status === 'critical').length;
  const warningMetrics = metrics.filter(m => m.status === 'warning').length;

  return (
    <Card className="bg-cyber-dark/60 border-cyber-green/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-green text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Real-Time Metrics</span>
          </div>
          <Badge variant="outline" className="border-cyber-green text-cyber-green">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Health Overview */}
        <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cyber-green">System Health</span>
            <span className="text-xs text-cyber-green">{Math.round(systemHealth)}%</span>
          </div>
          <Progress value={systemHealth} className="h-2 bg-cyber-darker" />
          <div className="flex justify-between text-xs mt-2">
            <span className="text-cyber-red">Critical: {criticalMetrics}</span>
            <span className="text-cyber-orange">Warnings: {warningMetrics}</span>
            <span className="text-cyber-blue">Alerts: {alertCount}</span>
          </div>
        </div>

        {/* Individual Metrics */}
        <div className="space-y-2">
          {metrics.map(metric => (
            <div key={metric.id} className="flex items-center justify-between p-2 rounded border border-cyber-green/20 hover:border-cyber-green/40 transition-colors">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getStatusBadge(metric.status)} animate-pulse`}></div>
                <span className="text-xs font-medium text-cyber-green">{metric.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs ${getStatusColor(metric.status)}`}>
                  {Math.round(metric.value)}{metric.unit}
                </span>
                <span className="text-xs text-cyber-blue">
                  {getTrendIcon(metric.trend)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center space-x-1">
            <Brain className="w-3 h-3 text-cyber-purple" />
            <span>Neural: Active</span>
          </div>
          <div className="flex items-center space-x-1">
            <Zap className="w-3 h-3 text-cyber-orange" />
            <span>Quantum: Stable</span>
          </div>
          <div className="flex items-center space-x-1">
            <Target className="w-3 h-3 text-cyber-blue" />
            <span>Targeting: Online</span>
          </div>
          <div className="flex items-center space-x-1">
            <Activity className="w-3 h-3 text-cyber-green" />
            <span>Field: Resonant</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

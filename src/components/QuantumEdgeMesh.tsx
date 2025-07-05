
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Zap, Radio, Cpu, Wifi } from "lucide-react";

interface QuantumNode {
  id: string;
  location: string;
  entanglementStrength: number;
  thoughtformVectors: number;
  phaseCoherence: number;
  status: 'entangled' | 'decoherent' | 'stabilizing';
}

export const QuantumEdgeMesh = () => {
  const [nodes, setNodes] = useState<QuantumNode[]>([
    { id: 'QN-001', location: 'Neo-Tokyo Sector', entanglementStrength: 97.3, thoughtformVectors: 15420, phaseCoherence: 0.94, status: 'entangled' },
    { id: 'QN-002', location: 'Berlin Nexus', entanglementStrength: 89.7, thoughtformVectors: 12680, phaseCoherence: 0.91, status: 'entangled' },
    { id: 'QN-003', location: 'Silicon Valley Hub', entanglementStrength: 45.2, thoughtformVectors: 8340, phaseCoherence: 0.67, status: 'decoherent' },
    { id: 'QN-004', location: 'Mumbai Grid', entanglementStrength: 78.1, thoughtformVectors: 11200, phaseCoherence: 0.82, status: 'stabilizing' }
  ]);

  const [meshIntegrity, setMeshIntegrity] = useState(86.4);
  const [quantumLatency, setQuantumLatency] = useState(0.003);

  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(prev => prev.map(node => ({
        ...node,
        entanglementStrength: Math.max(30, Math.min(100, node.entanglementStrength + (Math.random() - 0.5) * 8)),
        thoughtformVectors: Math.floor(node.thoughtformVectors + (Math.random() - 0.5) * 2000),
        phaseCoherence: Math.max(0.5, Math.min(1, node.phaseCoherence + (Math.random() - 0.5) * 0.1))
      })));
      setMeshIntegrity(prev => Math.max(60, Math.min(100, prev + (Math.random() - 0.5) * 5)));
      setQuantumLatency(prev => Math.max(0.001, Math.min(0.01, prev + (Math.random() - 0.5) * 0.002)));
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: QuantumNode['status']) => {
    switch (status) {
      case 'entangled': return 'bg-cyber-green text-cyber-dark';
      case 'decoherent': return 'bg-cyber-red text-white animate-pulse';
      case 'stabilizing': return 'bg-cyber-orange text-cyber-dark';
    }
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-blue/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-blue text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 animate-pulse-glow" />
            <span>Quantum-Entangled Edge Mesh</span>
          </div>
          <Badge variant="outline" className="border-cyber-green text-cyber-green">
            {meshIntegrity.toFixed(1)}% Integrity
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mesh Status */}
        <div className="p-3 bg-cyber-blue/10 border border-cyber-blue/30 rounded">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span>Quantum Latency:</span>
              <span className="text-cyber-green">{quantumLatency.toFixed(3)}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Active Nodes:</span>
              <span className="text-cyber-blue">{nodes.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Vector Throughput:</span>
              <span className="text-cyber-purple">{nodes.reduce((sum, n) => sum + n.thoughtformVectors, 0).toLocaleString()}/s</span>
            </div>
            <div className="flex justify-between">
              <span>Entanglement Avg:</span>
              <span className="text-cyber-orange">{(nodes.reduce((sum, n) => sum + n.entanglementStrength, 0) / nodes.length).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Quantum Nodes */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-blue/80 mb-2 flex items-center space-x-2">
            <Radio className="w-3 h-3" />
            <span>Quantum Node Status</span>
          </div>
          {nodes.map(node => (
            <div key={node.id} className="p-2 rounded border border-cyber-blue/20 hover:border-cyber-blue/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-3 h-3 text-cyber-blue" />
                  <span className="text-xs font-medium text-cyber-blue">{node.id}</span>
                  <Badge variant="secondary" className={`text-xs ${getStatusColor(node.status)}`}>
                    {node.status.toUpperCase()}
                  </Badge>
                </div>
                <span className="text-xs text-cyber-purple">{node.location}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-gray-400">Entanglement</div>
                  <div className="text-cyber-green">{node.entanglementStrength.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Vectors/s</div>
                  <div className="text-cyber-blue">{node.thoughtformVectors.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-400">Phase Coherence</div>
                  <div className="text-cyber-orange">{node.phaseCoherence.toFixed(2)}</div>
                </div>
              </div>
              
              <div className="mt-2">
                <Progress 
                  value={node.entanglementStrength} 
                  className="h-1 bg-cyber-darker"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Mesh Controls */}
        <div className="flex space-x-2">
          <Button size="sm" className="flex-1 bg-cyber-blue/20 border border-cyber-blue/50 hover:bg-cyber-blue/30 text-cyber-blue">
            <Wifi className="w-3 h-3 mr-1" />
            Sync Mesh
          </Button>
          <Button size="sm" className="flex-1 bg-cyber-purple/20 border border-cyber-purple/50 hover:bg-cyber-purple/30 text-cyber-purple">
            Stabilize
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

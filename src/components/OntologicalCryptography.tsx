
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock, Key, Shield, RefreshCw } from "lucide-react";

interface CryptoKey {
  id: string;
  type: 'primary' | 'secondary' | 'quantum' | 'symbolic';
  strength: number;
  resonanceFingerprint: string;
  mutationRate: number;
  phaseAlignment: number;
  status: 'active' | 'rotating' | 'compromised';
}

interface EncryptionLayer {
  name: string;
  algorithm: string;
  strength: number;
  status: 'operational' | 'mutating' | 'realigning';
}

export const OntologicalCryptography = () => {
  const [cryptoActive, setCryptoActive] = useState(true);
  const [overallSecurity, setOverallSecurity] = useState(96.7);
  const [mutationCycle, setMutationCycle] = useState(73.2);
  const [phaseSync, setPhaseSync] = useState(0.94);

  const [cryptoKeys, setCryptoKeys] = useState<CryptoKey[]>([
    {
      id: 'OK-001',
      type: 'primary',
      strength: 2048,
      resonanceFingerprint: 'Ψ4f7a9b2e',
      mutationRate: 0.73,
      phaseAlignment: 0.97,
      status: 'active'
    },
    {
      id: 'OK-002',
      type: 'quantum',
      strength: 4096,
      resonanceFingerprint: 'Θ8c3d1f6a',
      mutationRate: 0.89,
      phaseAlignment: 0.91,
      status: 'rotating'
    },
    {
      id: 'OK-003',
      type: 'symbolic',
      strength: 8192,
      resonanceFingerprint: 'Φ2e9a4b7c',
      mutationRate: 0.84,
      phaseAlignment: 0.88,
      status: 'active'
    }
  ]);

  const [encryptionLayers, setEncryptionLayers] = useState<EncryptionLayer[]>([
    { name: 'Resonance Lattice', algorithm: 'Post-Quantum RSA', strength: 95, status: 'operational' },
    { name: 'Symbolic Matrix', algorithm: 'Ontological Cipher', strength: 89, status: 'mutating' },
    { name: 'Phase Lock', algorithm: 'Quantum Entanglement', strength: 97, status: 'operational' },
    { name: 'Narrative Shield', algorithm: 'Semantic Encryption', strength: 91, status: 'realigning' }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOverallSecurity(prev => Math.max(90, Math.min(100, prev + (Math.random() - 0.5) * 3)));
      setMutationCycle(prev => (prev + Math.random() * 5) % 100);
      setPhaseSync(prev => Math.max(0.85, Math.min(1, prev + (Math.random() - 0.5) * 0.05)));

      setCryptoKeys(prev => prev.map(key => ({
        ...key,
        phaseAlignment: Math.max(0.8, Math.min(1, key.phaseAlignment + (Math.random() - 0.5) * 0.1)),
        mutationRate: Math.max(0.5, Math.min(1, key.mutationRate + (Math.random() - 0.5) * 0.1))
      })));

      setEncryptionLayers(prev => prev.map(layer => ({
        ...layer,
        strength: Math.max(80, Math.min(100, layer.strength + (Math.random() - 0.5) * 8))
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getKeyStatusColor = (status: CryptoKey['status']) => {
    switch (status) {
      case 'active': return 'bg-cyber-green text-cyber-dark';
      case 'rotating': return 'bg-cyber-orange text-cyber-dark animate-pulse';
      case 'compromised': return 'bg-cyber-red text-white animate-pulse';
    }
  };

  const getLayerStatusColor = (status: EncryptionLayer['status']) => {
    switch (status) {
      case 'operational': return 'text-cyber-green';
      case 'mutating': return 'text-cyber-orange animate-pulse';
      case 'realigning': return 'text-cyber-blue animate-pulse';
    }
  };

  const rotateKey = (keyId: string) => {
    setCryptoKeys(prev => prev.map(key => 
      key.id === keyId 
        ? { ...key, status: 'rotating', mutationRate: Math.min(1, key.mutationRate + 0.1) }
        : key
    ));
  };

  const generateFingerprint = () => {
    const symbols = ['Ψ', 'Θ', 'Φ', 'Ω', 'Δ', 'Λ'];
    const hex = '0123456789abcdef';
    return symbols[Math.floor(Math.random() * symbols.length)] + 
           Array.from({length: 8}, () => hex[Math.floor(Math.random() * hex.length)]).join('');
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-green/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-green text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 animate-pulse-glow" />
            <span>Ontological Cryptography</span>
          </div>
          <Badge variant="outline" className={`border-current ${cryptoActive ? 'text-cyber-green' : 'text-cyber-red'}`}>
            {overallSecurity.toFixed(1)}% SECURE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Status */}
        <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span>Overall Security:</span>
              <span className="text-cyber-green">{overallSecurity.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Phase Synchronization:</span>
              <span className="text-cyber-blue">{(phaseSync * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Mutation Cycle:</span>
              <span className="text-cyber-orange">{mutationCycle.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Key Rotation:</span>
              <span className="text-cyber-purple">Auto</span>
            </div>
          </div>
        </div>

        {/* Mutation Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-cyber-green">Key Mutation Cycle</span>
            <span className="text-cyber-orange">{mutationCycle.toFixed(0)}%</span>
          </div>
          <Progress value={mutationCycle} className="h-2 bg-cyber-darker" />
        </div>

        {/* Cryptographic Keys */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-green/80 mb-2 flex items-center space-x-2">
            <Key className="w-3 h-3" />
            <span>Symbolic Cryptographic Keys</span>
          </div>
          
          {cryptoKeys.map(key => (
            <div key={key.id} className="p-3 rounded border border-cyber-green/20 hover:border-cyber-green/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-cyber-green">{key.id}</span>
                  <Badge variant="secondary" className={`text-xs ${getKeyStatusColor(key.status)}`}>
                    {key.status.toUpperCase()}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  onClick={() => rotateKey(key.id)}
                  className="h-5 px-2 text-xs bg-cyber-blue/20 border border-cyber-blue/50 text-cyber-blue hover:bg-cyber-blue/30"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="text-cyber-purple capitalize">{key.type}</span>
                </div>
                <div className="flex justify-between">
                  <span>Strength:</span>
                  <span className="text-cyber-blue">{key.strength}-bit</span>
                </div>
                <div className="flex justify-between">
                  <span>Mutation Rate:</span>
                  <span className="text-cyber-orange">{(key.mutationRate * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Phase Alignment:</span>
                  <span className="text-cyber-green">{(key.phaseAlignment * 100).toFixed(1)}%</span>
                </div>
              </div>
              
              <div className="text-xs">
                <span className="text-gray-400">Resonance Fingerprint: </span>
                <span className="text-cyber-green font-mono">{key.resonanceFingerprint}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Encryption Layers */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-cyber-green/80 mb-2 flex items-center space-x-2">
            <Shield className="w-3 h-3" />
            <span>Multi-Layer Encryption Stack</span>
          </div>
          
          {encryptionLayers.map((layer, index) => (
            <div key={index} className="p-2 rounded border border-cyber-green/20 hover:border-cyber-green/40 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-cyber-green">{layer.name}</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs ${getLayerStatusColor(layer.status)}`}>
                    {layer.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-cyber-blue">{layer.strength}%</span>
                </div>
              </div>
              
              <div className="text-xs text-gray-400 mb-1">{layer.algorithm}</div>
              <Progress value={layer.strength} className="h-1 bg-cyber-darker" />
            </div>
          ))}
        </div>

        {/* Security Controls */}
        <div className="flex space-x-2">
          <Button
            size="sm"
            className="flex-1 bg-cyber-green/20 border border-cyber-green/50 text-cyber-green hover:bg-cyber-green/30"
          >
            Force Mutation
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-cyber-blue/20 border border-cyber-blue/50 text-cyber-blue hover:bg-cyber-blue/30"
          >
            Realign Phase
          </Button>
        </div>

        {/* Zero-Trust Status */}
        <div className="p-3 bg-cyber-blue/10 border border-cyber-blue/30 rounded">
          <div className="text-xs font-semibold text-cyber-blue mb-2">
            Zero-Trust Framework Status
          </div>
          <div className="space-y-1 text-xs text-cyber-blue/80">
            <div>• Post-quantum lattice encryption: Active</div>
            <div>• Autonomous anomaly quarantine: Enabled</div>
            <div>• Adaptive threat response: Operational</div>
            <div>• Indecipherability without phase alignment: Verified</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

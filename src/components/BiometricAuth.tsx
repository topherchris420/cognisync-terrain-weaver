
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Eye, Fingerprint, Zap, Shield } from "lucide-react";

interface BiometricAuthProps {
  onAuthSuccess: () => void;
  isVisible: boolean;
}

export const BiometricAuth = ({ onAuthSuccess, isVisible }: BiometricAuthProps) => {
  const [authStage, setAuthStage] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [biometricData, setBiometricData] = useState({
    retinal: false,
    neural: false,
    quantum: false,
  });

  useEffect(() => {
    if (authStage === 'scanning') {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setAuthStage('processing');
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      // Simulate biometric checks
      setTimeout(() => setBiometricData(prev => ({ ...prev, retinal: true })), 1000);
      setTimeout(() => setBiometricData(prev => ({ ...prev, neural: true })), 2000);
      setTimeout(() => setBiometricData(prev => ({ ...prev, quantum: true })), 3000);

      return () => clearInterval(interval);
    }
  }, [authStage]);

  useEffect(() => {
    if (authStage === 'processing') {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          setAuthStage('success');
          setTimeout(() => {
            onAuthSuccess();
          }, 1500);
        } else {
          setAuthStage('failed');
          setTimeout(() => {
            setAuthStage('idle');
            setProgress(0);
            setBiometricData({ retinal: false, neural: false, quantum: false });
          }, 2000);
        }
      }, 2000);
    }
  }, [authStage, onAuthSuccess]);

  const startAuth = () => {
    setAuthStage('scanning');
    setProgress(0);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-cyber-darker/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-cyber-dark/90 border-cyber-blue/30">
        <CardHeader className="text-center">
          <CardTitle className="text-cyber-blue flex items-center justify-center space-x-2">
            <Shield className="w-6 h-6" />
            <span>Biometric Authentication</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {authStage === 'idle' && (
            <div className="text-center space-y-4">
              <div className="text-cyber-blue/80 text-sm">
                Strategic access requires multi-factor biometric verification
              </div>
              <Button
                onClick={startAuth}
                className="w-full bg-gradient-to-r from-cyber-blue to-cyber-purple"
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                Begin Authentication
              </Button>
            </div>
          )}

          {authStage === 'scanning' && (
            <div className="space-y-4">
              <div className="text-center">
                <Eye className="w-12 h-12 mx-auto text-cyber-green animate-pulse mb-2" />
                <div className="text-cyber-green text-sm font-semibold">
                  SCANNING IN PROGRESS
                </div>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Retinal Pattern:</span>
                  <Badge variant={biometricData.retinal ? "default" : "secondary"}>
                    {biometricData.retinal ? "VERIFIED" : "SCANNING"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Neural Signature:</span>
                  <Badge variant={biometricData.neural ? "default" : "secondary"}>
                    {biometricData.neural ? "VERIFIED" : "SCANNING"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Quantum Resonance:</span>
                  <Badge variant={biometricData.quantum ? "default" : "secondary"}>
                    {biometricData.quantum ? "VERIFIED" : "SCANNING"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {authStage === 'processing' && (
            <div className="text-center space-y-4">
              <Zap className="w-12 h-12 mx-auto text-cyber-orange animate-spin" />
              <div className="text-cyber-orange text-sm font-semibold">
                PROCESSING AUTHENTICATION
              </div>
              <div className="text-xs text-cyber-blue/60">
                Validating quantum entanglement patterns...
              </div>
            </div>
          )}

          {authStage === 'success' && (
            <div className="text-center space-y-4">
              <Shield className="w-12 h-12 mx-auto text-cyber-green" />
              <div className="text-cyber-green text-sm font-semibold">
                AUTHENTICATION SUCCESS
              </div>
              <div className="text-xs text-cyber-green/60">
                Welcome to Strategic Command
              </div>
            </div>
          )}

          {authStage === 'failed' && (
            <div className="text-center space-y-4">
              <Shield className="w-12 h-12 mx-auto text-cyber-red" />
              <div className="text-cyber-red text-sm font-semibold">
                AUTHENTICATION FAILED
              </div>
              <div className="text-xs text-cyber-red/60">
                Access denied. Retrying in 3 seconds...
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

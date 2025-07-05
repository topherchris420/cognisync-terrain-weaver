
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cog, Database, Zap } from "lucide-react";
import { toast } from "sonner";

interface ControlPanelProps {
  activeMode: 'civilian' | 'strategic';
  isSecureSession: boolean;
  onModeChange: (mode: 'civilian' | 'strategic') => void;
}

export const ControlPanel = ({ activeMode, isSecureSession, onModeChange }: ControlPanelProps) => {
  const [fieldCalibration, setFieldCalibration] = useState([75]);
  const [sensitivityLevel, setSensitivityLevel] = useState([60]);
  const [autoResponse, setAutoResponse] = useState(true);
  const [resonanceAmplification, setResonanceAmplification] = useState([45]);
  const [isExportingLogs, setIsExportingLogs] = useState(false);

  const handleExportLogs = async () => {
    setIsExportingLogs(true);
    toast("Exporting system logs...", {
      description: "Generating encrypted semantic resonance snapshots"
    });
    
    // Simulate export process
    setTimeout(() => {
      setIsExportingLogs(false);
      toast("Export completed", {
        description: "Logs saved to secure storage with timestamp encryption"
      });
    }, 3000);
  };

  const handleEmergencyStop = () => {
    toast("Emergency protocols activated", {
      description: "All field operations suspended - System entering safe mode"
    });
  };

  const handleFieldReset = () => {
    setFieldCalibration([75]);
    setSensitivityLevel([60]);
    setResonanceAmplification([45]);
    toast("Field parameters reset", {
      description: "All calibration values returned to baseline"
    });
  };

  return (
    <Card className="bg-cyber-dark/60 border-cyber-green/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-green text-sm flex items-center space-x-2">
          <Cog className="w-4 h-4" />
          <span>Control Panel</span>
          {isSecureSession && (
            <Badge variant="outline" className="border-cyber-red text-cyber-red ml-auto">
              CLASSIFIED
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="calibration" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-cyber-darker">
            <TabsTrigger value="calibration" className="text-xs">Calibration</TabsTrigger>
            <TabsTrigger value="operations" className="text-xs">Operations</TabsTrigger>
            <TabsTrigger value="export" className="text-xs">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="calibration" className="space-y-4 mt-4">
            {/* Field Calibration */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-cyber-green">
                Field Calibration: {fieldCalibration[0]}%
              </label>
              <Slider
                value={fieldCalibration}
                onValueChange={setFieldCalibration}
                max={100}
                step={1}
                className="[&>span:first-child]:bg-cyber-darker [&>span:first-child>span]:bg-cyber-green"
              />
              <div className="text-xs text-gray-400">
                Adjusts cognitive field sensitivity and resolution
              </div>
            </div>

            {/* Sensitivity Level */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-cyber-green">
                Detection Sensitivity: {sensitivityLevel[0]}%
              </label>
              <Slider
                value={sensitivityLevel}
                onValueChange={setSensitivityLevel}
                max={100}
                step={1}
                className="[&>span:first-child]:bg-cyber-darker [&>span:first-child>span]:bg-cyber-green"
              />
              <div className="text-xs text-gray-400">
                Threshold for anomaly detection and threat identification
              </div>
            </div>

            {/* Resonance Amplification (Strategic Mode Only) */}
            {isSecureSession && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-cyber-red">
                  Resonance Amplification: {resonanceAmplification[0]}%
                </label>
                <Slider
                  value={resonanceAmplification}
                  onValueChange={setResonanceAmplification}
                  max={100}
                  step={1}
                  className="[&>span:first-child]:bg-cyber-darker [&>span:first-child>span]:bg-cyber-red"
                />
                <div className="text-xs text-cyber-red/80">
                  CLASSIFIED: Influence vector amplification control
                </div>
              </div>
            )}

            {/* Auto Response Toggle */}
            <div className="flex items-center justify-between p-2 border border-cyber-green/20 rounded">
              <div>
                <div className="text-xs font-semibold text-cyber-green">
                  Automated Response
                </div>
                <div className="text-xs text-gray-400">
                  Enable AI-driven field corrections
                </div>
              </div>
              <Switch
                checked={autoResponse}
                onCheckedChange={setAutoResponse}
              />
            </div>
          </TabsContent>

          <TabsContent value="operations" className="space-y-3 mt-4">
            {/* Operation Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                onClick={handleFieldReset}
                className="bg-cyber-blue/20 border border-cyber-blue/50 hover:bg-cyber-blue/30 text-cyber-blue"
              >
                Reset Field
              </Button>
              <Button
                size="sm"
                onClick={handleEmergencyStop}
                className="bg-cyber-red/20 border border-cyber-red/50 hover:bg-cyber-red/30 text-cyber-red"
              >
                Emergency Stop
              </Button>
            </div>

            {/* System Status */}
            <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded">
              <div className="text-xs font-semibold text-cyber-green mb-2">
                System Status
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>CPU Usage:</span>
                  <span className="text-cyber-blue">23.7%</span>
                </div>
                <div className="flex justify-between">
                  <span>Memory:</span>
                  <span className="text-cyber-blue">4.2GB / 16GB</span>
                </div>
                <div className="flex justify-between">
                  <span>Network:</span>
                  <span className="text-cyber-green">Optimal</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className="text-cyber-green">47h 23m</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {isSecureSession && (
              <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded">
                <div className="text-xs font-semibold text-cyber-red mb-2">
                  Strategic Operations
                </div>
                <div className="space-y-2">
                  <Button
                    size="sm"
                    className="w-full bg-cyber-red/20 border border-cyber-red/50 hover:bg-cyber-red/30 text-cyber-red"
                  >
                    Deploy Countermeasures
                  </Button>
                  <Button
                    size="sm"
                    className="w-full bg-cyber-orange/20 border border-cyber-orange/50 hover:bg-cyber-orange/30 text-cyber-orange"
                  >
                    Initiate Stabilization
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="export" className="space-y-3 mt-4">
            {/* Export Options */}
            <div className="space-y-2">
              <Button
                onClick={handleExportLogs}
                disabled={isExportingLogs}
                className="w-full bg-cyber-purple/20 border border-cyber-purple/50 hover:bg-cyber-purple/30 text-cyber-purple"
              >
                <Database className="w-4 h-4 mr-2" />
                {isExportingLogs ? 'Exporting...' : 'Export System Logs'}
              </Button>
              
              <Button
                size="sm"
                className="w-full bg-cyber-blue/20 border border-cyber-blue/50 hover:bg-cyber-blue/30 text-cyber-blue"
              >
                <Zap className="w-4 h-4 mr-2" />
                Generate Resonance Snapshot
              </Button>
            </div>

            {/* Export Status */}
            <div className="p-3 bg-cyber-purple/10 border border-cyber-purple/30 rounded">
              <div className="text-xs font-semibold text-cyber-purple mb-2">
                Export History
              </div>
              <div className="space-y-1 text-xs text-cyber-purple/80">
                <div className="flex justify-between">
                  <span>Last Export:</span>
                  <span>2 hours ago</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Exports:</span>
                  <span>247</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage Used:</span>
                  <span>12.4 GB</span>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
              <div className="text-xs text-yellow-400">
                ⚠️ All exports are encrypted with AES-256 and require biometric authentication for access.
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

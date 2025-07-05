
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Database, Monitor, Brain, Eye, Clock, Lock } from "lucide-react";

interface SystemIndicatorsProps {
  systemsOnline: boolean;
  isSecureSession: boolean;
}

export const SystemIndicators = ({ systemsOnline, isSecureSession }: SystemIndicatorsProps) => {
  if (!systemsOnline) return null;

  return (
    <>
      {/* Live System Status - Mobile optimized */}
      <div className="absolute top-2 md:top-4 right-2 md:right-4 space-y-1 md:space-y-2">
        <Button
          size="sm"
          className="bg-cyber-purple/30 border border-cyber-purple/70 hover:bg-cyber-purple/40 text-cyber-purple animate-pulse"
        >
          <Database className="w-3 h-3 md:w-4 md:h-4" />
        </Button>
        <Button
          size="sm"
          className="bg-cyber-green/30 border border-cyber-green/70 hover:bg-cyber-green/40 text-cyber-green animate-pulse"
        >
          <Monitor className="w-3 h-3 md:w-4 md:h-4" />
        </Button>
        <Button
          size="sm"
          className="bg-cyber-orange/30 border border-cyber-orange/70 hover:bg-cyber-orange/40 text-cyber-orange animate-pulse"
        >
          <Brain className="w-3 h-3 md:w-4 md:h-4" />
        </Button>
        <Button
          size="sm"
          className="bg-cyber-blue/30 border border-cyber-blue/70 hover:bg-cyber-blue/40 text-cyber-blue animate-pulse"
        >
          <Eye className="w-3 h-3 md:w-4 md:h-4" />
        </Button>
      </div>

      {/* Live System Indicators - Mobile optimized */}
      {isSecureSession && (
        <div className="absolute bottom-2 md:bottom-4 right-2 md:right-4 grid grid-cols-2 gap-1 md:gap-2">
          <Card className="bg-cyber-green/30 border-cyber-green/70 p-1 md:p-2 animate-pulse">
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-cyber-green rounded-full animate-pulse"></div>
              <span className="text-xs text-cyber-green font-bold">QUANTUM</span>
            </div>
          </Card>
          <Card className="bg-cyber-purple/30 border-cyber-purple/70 p-1 md:p-2 animate-pulse">
            <div className="flex items-center space-x-1">
              <Brain className="w-2 h-2 md:w-3 md:h-3 text-cyber-purple" />
              <span className="text-xs text-cyber-purple font-bold">NEURAL</span>
            </div>
          </Card>
          <Card className="bg-cyber-orange/30 border-cyber-orange/70 p-1 md:p-2 animate-pulse">
            <div className="flex items-center space-x-1">
              <Clock className="w-2 h-2 md:w-3 md:h-3 text-cyber-orange" />
              <span className="text-xs text-cyber-orange font-bold">TEMPORAL</span>
            </div>
          </Card>
          <Card className="bg-cyber-blue/30 border-cyber-blue/70 p-1 md:p-2 animate-pulse">
            <div className="flex items-center space-x-1">
              <Lock className="w-2 h-2 md:w-3 md:h-3 text-cyber-blue" />
              <span className="text-xs text-cyber-blue font-bold">SECURE</span>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

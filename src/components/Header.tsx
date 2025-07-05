
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Menu, X } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { MobileMenu } from "@/components/MobileMenu";

interface HeaderProps {
  activeMode: 'civilian' | 'strategic';
  isSecureSession: boolean;
  fieldActivity: number;
  onModeChange: (mode: 'civilian' | 'strategic') => void;
  onSecureAccess: () => void;
}

export const Header = ({ 
  activeMode, 
  isSecureSession, 
  fieldActivity, 
  onModeChange, 
  onSecureAccess 
}: HeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-cyber-blue/20 bg-cyber-dark/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between p-3 md:p-4">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="relative">
            <Zap className="w-6 h-6 md:w-8 md:h-8 text-cyber-blue animate-pulse-glow" />
            <div className="absolute -top-1 -right-1 w-2 h-2 md:w-3 md:h-3 bg-cyber-green rounded-full animate-cognitive-pulse"></div>
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
              VERS3DYNAMICS
            </h1>
            <p className="text-xs text-cyber-blue/60 hidden md:block">Advanced Cognitive Terrain Mapping Platform</p>
          </div>
        </div>
        
        {/* Mobile menu button */}
        <div className="flex items-center space-x-2 md:hidden">
          <StatusBar fieldActivity={fieldActivity} />
          <Button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            variant="outline"
            size="sm"
            className="border-cyber-blue/50 text-cyber-blue"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:flex items-center space-x-4">
          <StatusBar fieldActivity={fieldActivity} />
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></div>
            <span className="text-xs text-cyber-green font-semibold">ALL SYSTEMS ACTIVE</span>
          </div>
          <Button
            onClick={() => onModeChange(activeMode === 'civilian' ? 'strategic' : 'civilian')}
            variant="outline"
            className="border-cyber-blue/50 hover:border-cyber-blue text-cyber-blue"
          >
            {activeMode === 'civilian' ? 'Wellness Mode' : 'Strategic Mode'}
          </Button>
          {!isSecureSession && (
            <Button
              onClick={onSecureAccess}
              className="bg-gradient-to-r from-cyber-red to-cyber-orange hover:from-cyber-red/80 hover:to-cyber-orange/80"
            >
              <Shield className="w-4 h-4 mr-2" />
              Secure Access
            </Button>
          )}
        </div>
      </div>

      <MobileMenu 
        isOpen={isMobileMenuOpen}
        activeMode={activeMode}
        onModeChange={onModeChange}
      />
    </header>
  );
};

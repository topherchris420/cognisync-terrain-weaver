
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
    <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50 glass-card">
      <div className="flex items-center justify-between p-3 md:p-4">
        <div className="flex items-center space-x-3 md:space-x-4">
          <img 
            src="/lovable-uploads/b177c347-5d1a-4459-ae9c-772d4efed423.png" 
            alt="Vers3Dynamics" 
            className="w-8 h-8 md:w-10 md:h-10 object-contain"
          />
          <div>
            <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-[hsl(320,80%,70%)] via-[hsl(200,100%,60%)] to-[hsl(280,60%,65%)] bg-clip-text text-transparent">
              VERS3DYNAMICS
            </h1>
            <p className="text-xs text-muted-foreground hidden md:block">Advanced Cognitive Terrain Mapping Platform</p>
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
            <div className="w-2 h-2 bg-gradient-to-r from-[hsl(200,100%,60%)] to-[hsl(320,80%,70%)] rounded-full animate-pulse"></div>
            <span className="text-xs font-semibold bg-gradient-to-r from-[hsl(200,100%,60%)] to-[hsl(320,80%,70%)] bg-clip-text text-transparent">ALL SYSTEMS ACTIVE</span>
          </div>
          <Button
            onClick={() => onModeChange(activeMode === 'civilian' ? 'strategic' : 'civilian')}
            variant="outline"
            className="border-white/20 hover:border-white/40 transition-all duration-300"
          >
            {activeMode === 'civilian' ? 'Wellness Mode' : 'Strategic Mode'}
          </Button>
          {!isSecureSession && (
            <Button
              onClick={onSecureAccess}
              className="bg-gradient-to-r from-[hsl(120,100%,50%)] to-[hsl(160,100%,45%)] hover:shadow-lg hover:scale-105 transition-all duration-300"
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

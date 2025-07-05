
import { Button } from "@/components/ui/button";

interface MobileMenuProps {
  isOpen: boolean;
  activeMode: 'civilian' | 'strategic';
  onModeChange: (mode: 'civilian' | 'strategic') => void;
}

export const MobileMenu = ({ isOpen, activeMode, onModeChange }: MobileMenuProps) => {
  if (!isOpen) return null;

  return (
    <div className="md:hidden border-t border-cyber-blue/20 bg-cyber-dark/95 p-3 space-y-3">
      <Button
        onClick={() => onModeChange(activeMode === 'civilian' ? 'strategic' : 'civilian')}
        variant="outline"
        className="w-full border-cyber-blue/50 text-cyber-blue"
      >
        {activeMode === 'civilian' ? 'Wellness Mode' : 'Strategic Mode'}
      </Button>
      <div className="flex items-center justify-center space-x-2">
        <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></div>
        <span className="text-xs text-cyber-green font-semibold">ALL SYSTEMS ACTIVE</span>
      </div>
    </div>
  );
};

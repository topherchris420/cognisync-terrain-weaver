
import { Badge } from "@/components/ui/badge";

interface StatusBarProps {
  fieldActivity: number;
}

export const StatusBar = ({ fieldActivity }: StatusBarProps) => {
  const getActivityColor = (activity: number) => {
    if (activity > 80) return 'text-cyber-red';
    if (activity > 60) return 'text-cyber-orange';
    if (activity > 40) return 'text-cyber-blue';
    return 'text-cyber-green';
  };

  const getStatusLevel = (activity: number) => {
    if (activity > 80) return 'CRITICAL';
    if (activity > 60) return 'ELEVATED';
    if (activity > 40) return 'MODERATE';
    return 'NORMAL';
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></div>
        <span className="text-xs text-cyber-green font-semibold">ONLINE</span>
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-400">Field Activity:</span>
        <Badge 
          variant="outline" 
          className={`text-xs border-current ${getActivityColor(fieldActivity)}`}
        >
          {getStatusLevel(fieldActivity)}
        </Badge>
      </div>

      <div className="flex items-center space-x-1">
        <div className="w-1 h-4 bg-cyber-blue/30 rounded"></div>
        <div className="w-1 h-4 bg-cyber-blue/50 rounded"></div>
        <div className="w-1 h-4 bg-cyber-blue/70 rounded"></div>
        <div className="w-1 h-4 bg-cyber-blue rounded animate-pulse"></div>
        <span className="text-xs text-cyber-blue ml-2">Signal: Strong</span>
      </div>
    </div>
  );
};

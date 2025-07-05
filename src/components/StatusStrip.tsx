
interface StatusStripProps {
  fieldActivity: number;
}

export const StatusStrip = ({ fieldActivity }: StatusStripProps) => {
  return (
    <div className="h-6 md:h-8 bg-cyber-dark/80 border-t border-cyber-blue/20 flex items-center justify-between px-2 md:px-4 text-xs text-cyber-blue/80 overflow-x-auto">
      <div className="flex items-center space-x-2 md:space-x-4 whitespace-nowrap">
        <span>Field: {Math.round(fieldActivity)}%</span>
        <span className="hidden sm:inline">Quantum: 847</span>
        <span className="hidden md:inline">Dreams: 23</span>
        <span className="hidden lg:inline">Timeline: 84.2%</span>
      </div>
      <div className="flex items-center space-x-2 md:space-x-4 whitespace-nowrap">
        <span className="hidden sm:inline">0.003ms</span>
        <span className="hidden md:inline">Post-Quantum</span>
        <span className="hidden lg:inline">12.4 GB/s</span>
        <div className="flex items-center space-x-1">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-cyber-green rounded-full animate-pulse"></div>
          <span className="font-bold">LIVE</span>
        </div>
      </div>
    </div>
  );
};

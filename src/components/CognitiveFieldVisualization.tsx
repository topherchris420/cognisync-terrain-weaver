
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface CognitiveFieldVisualizationProps {
  fieldActivity: number;
  activeMode: 'civilian' | 'strategic';
  isSecureSession: boolean;
}

export const CognitiveFieldVisualization = ({ 
  fieldActivity, 
  activeMode, 
  isSecureSession 
}: CognitiveFieldVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thoughtformsRef = useRef<Array<{
    x: number;
    y: number;
    intensity: number;
    type: 'positive' | 'negative' | 'neutral' | 'threat';
    age: number;
  }>>([]);
  const [thoughtCount, setThoughtCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    let rafId = 0;
    let running = true;

    const animate = () => {
      if (!running) return;

      // Clear canvas with fade effect
      ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      // Draw and update thoughtforms from ref
      const arr = thoughtformsRef.current;
      for (let i = 0; i < arr.length; i++) {
        const form = arr[i];
        const opacity = Math.max(0, 1 - form.age / 1000);

        // Main particle
        ctx.beginPath();
        ctx.arc(form.x, form.y, form.intensity / 10, 0, Math.PI * 2);
        switch (form.type) {
          case 'positive':
            ctx.fillStyle = `rgba(0, 255, 136, ${opacity})`;
            break;
          case 'negative':
            ctx.fillStyle = `rgba(255, 51, 102, ${opacity})`;
            break;
          case 'threat':
            ctx.fillStyle = `rgba(255, 136, 0, ${opacity})`;
            break;
          default:
            ctx.fillStyle = `rgba(0, 212, 255, ${opacity})`;
        }
        ctx.fill();

        // Glow effect
        const gradient = ctx.createRadialGradient(
          form.x, form.y, 0,
          form.x, form.y, form.intensity / 5
        );
        gradient.addColorStop(0, `rgba(0, 212, 255, ${opacity * 0.5})`);
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx.beginPath();
        ctx.arc(form.x, form.y, form.intensity / 5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Update age
        form.age += 16;
      }

      // Remove old thoughtforms
      thoughtformsRef.current = arr.filter(form => form.age < 1000);

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    window.addEventListener('resize', resize);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);


  // Generate new thoughtforms based on field activity
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < fieldActivity / 100) {
        const newThoughtform = {
          x: Math.random() * (canvasRef.current?.width || 800),
          y: Math.random() * (canvasRef.current?.height || 600),
          intensity: Math.random() * 50 + 10,
          type: isSecureSession && Math.random() < 0.1 ? 'threat' as const :
                Math.random() < 0.3 ? 'positive' as const :
                Math.random() < 0.3 ? 'negative' as const : 'neutral' as const,
          age: 0
        };
        thoughtformsRef.current.push(newThoughtform);
        // Cap to prevent unbounded growth
        if (thoughtformsRef.current.length > 500) {
          thoughtformsRef.current.splice(0, thoughtformsRef.current.length - 500);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [fieldActivity, isSecureSession]);

  // Sync count to UI at a gentle cadence
  useEffect(() => {
    const id = setInterval(() => {
      setThoughtCount(thoughtformsRef.current.length);
    }, 250);
    return () => clearInterval(id);
  }, []);


  return (
    <div className="relative h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      />
      
      {/* Overlay Information */}
      <div className="absolute top-4 left-4 space-y-2">
        <Card className="bg-cyber-dark/80 border-cyber-blue/30 p-3">
          <h3 className="text-sm font-semibold text-cyber-blue mb-2">
            Cognitive Field Status
          </h3>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Thoughtforms Active:</span>
              <span className="text-cyber-green">{thoughtCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Field Intensity:</span>
              <span className="text-cyber-purple">{Math.round(fieldActivity)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Mode:</span>
              <span className={activeMode === 'strategic' ? 'text-cyber-red' : 'text-cyber-green'}>
                {activeMode.toUpperCase()}
              </span>
            </div>
          </div>
        </Card>

        {isSecureSession && (
          <Card className="bg-cyber-red/20 border-cyber-red/50 p-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyber-red rounded-full animate-pulse"></div>
              <span className="text-xs text-cyber-red font-semibold">
                SECURE SESSION ACTIVE
              </span>
            </div>
          </Card>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4">
        <Card className="bg-cyber-dark/80 border-cyber-blue/30 p-3">
          <h4 className="text-xs font-semibold text-cyber-blue mb-2">Thoughtform Types</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyber-green rounded-full"></div>
              <span>Positive Resonance</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyber-red rounded-full"></div>
              <span>Negative Resonance</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyber-blue rounded-full"></div>
              <span>Neutral Field</span>
            </div>
            {isSecureSession && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-cyber-orange rounded-full animate-pulse"></div>
                <span>Threat Vector</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

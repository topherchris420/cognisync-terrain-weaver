
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Maximize2, RotateCcw } from "lucide-react";

interface DataPoint {
  x: number;
  y: number;
  z: number;
  intensity: number;
  type: 'resonance' | 'disruption' | 'harmony' | 'chaos';
  age: number;
}

export const AdvancedVisualization = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Generate initial data points
  useEffect(() => {
    const generatePoints = () => {
      const points: DataPoint[] = [];
      for (let i = 0; i < 50; i++) {
        points.push({
          x: Math.random() * 400,
          y: Math.random() * 300,
          z: Math.random() * 200,
          intensity: Math.random() * 100,
          type: ['resonance', 'disruption', 'harmony', 'chaos'][Math.floor(Math.random() * 4)] as DataPoint['type'],
          age: 0
        });
      }
      setDataPoints(points);
    };

    generatePoints();
  }, []);

  // Update data points
  useEffect(() => {
    const interval = setInterval(() => {
      setDataPoints(prev => {
        // Update existing points
        const updated = prev.map(point => ({
          ...point,
          x: point.x + (Math.random() - 0.5) * 2,
          y: point.y + (Math.random() - 0.5) * 2,
          z: point.z + (Math.random() - 0.5) * 2,
          intensity: Math.max(0, Math.min(100, point.intensity + (Math.random() - 0.5) * 10)),
          age: point.age + 1
        })).filter(point => point.age < 200); // Remove old points

        // Add new points occasionally
        if (Math.random() < 0.3) {
          updated.push({
            x: Math.random() * 400,
            y: Math.random() * 300,
            z: Math.random() * 200,
            intensity: Math.random() * 100,
            type: ['resonance', 'disruption', 'harmony', 'chaos'][Math.floor(Math.random() * 4)] as DataPoint['type'],
            age: 0
          });
        }

        return updated;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // Clear with fade
      ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw connection lines
      dataPoints.forEach((point, i) => {
        dataPoints.slice(i + 1).forEach(otherPoint => {
          const distance = Math.sqrt(
            Math.pow(point.x - otherPoint.x, 2) + 
            Math.pow(point.y - otherPoint.y, 2)
          );

          if (distance < 80) {
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(otherPoint.x, otherPoint.y);
            ctx.strokeStyle = `rgba(0, 212, 255, ${0.3 * (1 - distance / 80)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      // Draw data points
      dataPoints.forEach(point => {
        const radius = 2 + (point.intensity / 100) * 8;
        const opacity = Math.max(0.3, 1 - point.age / 200);

        // 3D effect simulation
        if (viewMode === '3d') {
          const perspective = 1 + point.z / 400;
          const adjustedX = point.x * perspective;
          const adjustedY = point.y * perspective;
          const adjustedRadius = radius * perspective;

          ctx.beginPath();
          ctx.arc(adjustedX, adjustedY, adjustedRadius, 0, Math.PI * 2);
        } else {
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        }

        // Color based on type
        let color;
        switch (point.type) {
          case 'resonance':
            color = `rgba(0, 255, 136, ${opacity})`;
            break;
          case 'disruption':
            color = `rgba(255, 51, 102, ${opacity})`;
            break;
          case 'harmony':
            color = `rgba(0, 212, 255, ${opacity})`;
            break;
          case 'chaos':
            color = `rgba(255, 136, 0, ${opacity})`;
            break;
        }

        ctx.fillStyle = color;
        ctx.fill();

        // Glow effect
        const gradient = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, radius * 2
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, [dataPoints, viewMode]);

  const toggleViewMode = () => {
    setViewMode(prev => prev === '2d' ? '3d' : '2d');
  };

  const resetView = () => {
    setRotation({ x: 0, y: 0 });
    setDataPoints([]);
  };

  return (
    <Card className={`bg-cyber-dark/60 border-cyber-purple/30 ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-cyber-purple text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>Advanced Cognitive Visualization</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="border-cyber-purple text-cyber-purple">
              {viewMode.toUpperCase()}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleViewMode}
              className="h-6 w-8 p-0 text-cyber-purple hover:bg-cyber-purple/20"
            >
              3D
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={resetView}
              className="h-6 w-8 p-0 text-cyber-purple hover:bg-cyber-purple/20"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-6 w-8 p-0 text-cyber-purple hover:bg-cyber-purple/20"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className={`w-full border border-cyber-purple/20 rounded ${isFullscreen ? 'h-96' : 'h-48'}`}
            style={{ background: 'transparent' }}
          />
          
          {/* Legend */}
          <div className="absolute bottom-2 left-2 bg-cyber-dark/80 p-2 rounded text-xs space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyber-green rounded-full"></div>
              <span>Resonance</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyber-red rounded-full"></div>
              <span>Disruption</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyber-blue rounded-full"></div>
              <span>Harmony</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyber-orange rounded-full"></div>
              <span>Chaos</span>
            </div>
          </div>

          {/* Stats */}
          <div className="absolute top-2 right-2 bg-cyber-dark/80 p-2 rounded text-xs">
            <div>Points: {dataPoints.length}</div>
            <div>Mode: {viewMode.toUpperCase()}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

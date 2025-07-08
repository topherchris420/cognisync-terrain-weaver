
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface Node {
  id: string;
  x: number;
  y: number;
  connections: string[];
  activity: number;
  type: 'input' | 'hidden' | 'output';
}

interface Connection {
  from: string;
  to: string;
  strength: number;
  active: boolean;
}

export const NeuralNetworkGrid = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [networkActivity, setNetworkActivity] = useState(0);

  // Initialize neural network
  useEffect(() => {
    const generateNodes = (): Node[] => {
      const nodeList: Node[] = [];
      
      // Input layer
      for (let i = 0; i < 6; i++) {
        nodeList.push({
          id: `input-${i}`,
          x: 50,
          y: 50 + i * 60,
          connections: [],
          activity: Math.random(),
          type: 'input'
        });
      }
      
      // Hidden layers
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 8; i++) {
          nodeList.push({
            id: `hidden-${layer}-${i}`,
            x: 150 + layer * 100,
            y: 30 + i * 45,
            connections: [],
            activity: Math.random(),
            type: 'hidden'
          });
        }
      }
      
      // Output layer
      for (let i = 0; i < 4; i++) {
        nodeList.push({
          id: `output-${i}`,
          x: 450,
          y: 80 + i * 80,
          connections: [],
          activity: Math.random(),
          type: 'output'
        });
      }
      
      return nodeList;
    };

    const generateConnections = (nodes: Node[]): Connection[] => {
      const connectionList: Connection[] = [];
      
      nodes.forEach(node => {
        const targetNodes = nodes.filter(target => 
          target.id !== node.id && 
          Math.abs(target.x - node.x) <= 120 &&
          target.x > node.x
        );
        
        targetNodes.forEach(target => {
          if (Math.random() > 0.3) {
            connectionList.push({
              from: node.id,
              to: target.id,
              strength: Math.random(),
              active: Math.random() > 0.5
            });
          }
        });
      });
      
      return connectionList;
    };

    const initialNodes = generateNodes();
    const initialConnections = generateConnections(initialNodes);
    
    setNodes(initialNodes);
    setConnections(initialConnections);
  }, []);

  // Animate network activity
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(prev => prev.map(node => ({
        ...node,
        activity: Math.max(0, Math.min(1, node.activity + (Math.random() - 0.5) * 0.3))
      })));
      
      setConnections(prev => prev.map(conn => ({
        ...conn,
        active: Math.random() > 0.4,
        strength: Math.max(0.1, Math.min(1, conn.strength + (Math.random() - 0.5) * 0.2))
      })));
      
      setNetworkActivity(prev => Math.max(0, Math.min(100, prev + (Math.random() - 0.5) * 20)));
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 500;
    canvas.height = 400;

    const animate = () => {
      // Clear canvas
      ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      connections.forEach(conn => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        
        if (fromNode && toNode && conn.active) {
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);
          ctx.strokeStyle = `rgba(0, 212, 255, ${conn.strength * 0.8})`;
          ctx.lineWidth = conn.strength * 2;
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        const radius = 3 + node.activity * 4;
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        
        switch (node.type) {
          case 'input':
            ctx.fillStyle = `rgba(0, 255, 136, ${0.3 + node.activity * 0.7})`;
            break;
          case 'hidden':
            ctx.fillStyle = `rgba(0, 212, 255, ${0.3 + node.activity * 0.7})`;
            break;
          case 'output':
            ctx.fillStyle = `rgba(184, 77, 255, ${0.3 + node.activity * 0.7})`;
            break;
        }
        
        ctx.fill();
        
        // Glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 2);
        gradient.addColorStop(0, `rgba(0, 212, 255, ${node.activity * 0.5})`);
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, [nodes, connections]);

  return (
    <Card className="bg-cyber-dark/60 border-cyber-blue/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-cyber-blue">Neural Network Activity</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></div>
          <span className="text-xs text-cyber-green">{Math.round(networkActivity)}% Active</span>
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        className="w-full h-48 border border-cyber-blue/20 rounded"
        style={{ background: 'transparent' }}
      />
      
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-cyber-green rounded-full"></div>
          <span>Input Layer</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-cyber-blue rounded-full"></div>
          <span>Hidden Layers</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-cyber-purple rounded-full"></div>
          <span>Output Layer</span>
        </div>
      </div>
    </Card>
  );
};

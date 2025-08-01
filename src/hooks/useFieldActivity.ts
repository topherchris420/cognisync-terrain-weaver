import { useState, useEffect } from 'react';

export const useFieldActivity = () => {
  const [fieldActivity, setFieldActivity] = useState(87.3);

  useEffect(() => {
    const interval = setInterval(() => {
      setFieldActivity(prev => {
        // Create more realistic field fluctuations
        const baseActivity = 85;
        const time = Date.now() / 1000;
        const wave1 = Math.sin(time * 0.1) * 10;
        const wave2 = Math.sin(time * 0.3) * 5;
        const noise = (Math.random() - 0.5) * 8;
        const newActivity = baseActivity + wave1 + wave2 + noise;
        return Math.max(70, Math.min(100, newActivity));
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return fieldActivity;
};
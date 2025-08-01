import { useState, useEffect } from 'react';

export const useSystemInit = () => {
  const [systemsOnline, setSystemsOnline] = useState(false);

  useEffect(() => {
    const initSequence = setTimeout(() => {
      setSystemsOnline(true);
    }, 1000);

    return () => clearTimeout(initSequence);
  }, []);

  return systemsOnline;
};
import { useState } from 'react';

export const useAuthentication = () => {
  const [activeMode, setActiveMode] = useState<'civilian' | 'strategic'>('civilian');
  const [isSecureSession, setIsSecureSession] = useState(false);
  const [showBiometricAuth, setShowBiometricAuth] = useState(false);

  const handleSecureAccess = () => {
    setShowBiometricAuth(true);
  };

  const handleAuthSuccess = () => {
    setIsSecureSession(true);
    setActiveMode('strategic');
    setShowBiometricAuth(false);
  };

  const handleModeChange = (mode: 'civilian' | 'strategic') => {
    if (mode === 'strategic' && !isSecureSession) {
      handleSecureAccess();
    } else {
      setActiveMode(mode);
    }
  };

  return {
    activeMode,
    isSecureSession,
    showBiometricAuth,
    handleSecureAccess,
    handleAuthSuccess,
    handleModeChange
  };
};
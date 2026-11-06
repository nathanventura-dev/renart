import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { getMascotSrc } from '../theme/mascot';

interface MascotProps {
  size: number;
}

export const Mascot: React.FC<MascotProps> = ({ size }) => {
  const { resolved } = useTheme();
  return (
    <img
      src={getMascotSrc(resolved)}
      alt="RenArt"
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
};

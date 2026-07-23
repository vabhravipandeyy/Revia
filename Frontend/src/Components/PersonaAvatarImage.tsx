import { useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';

function buildDicebearFallback(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || 'Revia Persona')}`;
}

interface PersonaAvatarImageProps {
  src?: string | null;
  name: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
}

export default function PersonaAvatarImage({
  src,
  name,
  className = '',
  imgClassName = '',
  fallbackClassName = '',
}: PersonaAvatarImageProps) {
  const fallbackSrc = useMemo(() => buildDicebearFallback(name), [name]);
  const preferredSrc = typeof src === 'string' && src.trim().length > 0 ? src.trim() : fallbackSrc;
  const [currentSrc, setCurrentSrc] = useState(preferredSrc);
  const [usedFallback, setUsedFallback] = useState(preferredSrc === fallbackSrc);

  useEffect(() => {
    setCurrentSrc(preferredSrc);
    setUsedFallback(preferredSrc === fallbackSrc);
  }, [preferredSrc, fallbackSrc]);

  return (
    <div className={className}>
      <img
        src={currentSrc}
        alt={name}
        referrerPolicy="no-referrer"
        className={imgClassName}
        onError={() => {
          if (!usedFallback) {
            setCurrentSrc(fallbackSrc);
            setUsedFallback(true);
            return;
          }

          setCurrentSrc('');
        }}
      />
      {!currentSrc && (
        <div className={fallbackClassName}>
          <UserPlus className="w-5 h-5 text-[#CCCCCC]" />
        </div>
      )}
    </div>
  );
}

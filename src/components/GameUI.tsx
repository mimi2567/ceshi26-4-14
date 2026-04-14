import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Character } from '../types';

interface DialogueBoxProps {
  name: string;
  text: string;
  onComplete?: () => void;
  color?: string;
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({ name, text, onComplete, color = '#ff007f' }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text[i]);
        i++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
        onComplete?.();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl z-50">
      <div className="pixel-card relative min-h-[120px] flex flex-col">
        <div 
          className="absolute -top-6 left-4 px-4 py-1 border-4 border-black bg-white text-black font-pixel text-xs"
          style={{ backgroundColor: color, color: '#fff' }}
        >
          {name}
        </div>
        <div className="mt-2 text-lg leading-relaxed font-silk">
          {displayedText}
          {isTyping && <span className="animate-pulse">_</span>}
        </div>
        {!isTyping && (
          <div className="absolute bottom-2 right-4 animate-bounce text-xs opacity-50">
            ▼ 点击继续
          </div>
        )}
      </div>
    </div>
  );
};

interface CharacterPortraitProps {
  character: Character;
  isActive: boolean;
}

export const CharacterPortrait: React.FC<CharacterPortraitProps> = ({ character, isActive }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: isActive ? 1 : 0.4, 
        y: isActive ? 0 : 10,
        scale: isActive ? 1.05 : 0.95
      }}
      className="relative w-64 h-96 flex-shrink-0"
    >
      <div className="absolute inset-0 border-4 border-black overflow-hidden bg-gray-800">
        <img 
          src={character.portrait} 
          alt={character.name}
          className="w-full h-full object-cover grayscale-[0.2]"
          referrerPolicy="no-referrer"
        />
        <div 
          className="absolute bottom-0 left-0 right-0 h-1" 
          style={{ backgroundColor: character.color }}
        />
      </div>
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full text-center">
        <div className="bg-black text-white text-[10px] py-1 px-2 font-pixel inline-block border-2 border-white">
          {character.name}
        </div>
      </div>
    </motion.div>
  );
};

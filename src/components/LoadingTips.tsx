'use client';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LOADING_TIPS } from '@/lib/loadingTips';

export default function LoadingTips() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * LOADING_TIPS.length));
    const id = setInterval(() => {
      setIndex(i => (i + 1) % LOADING_TIPS.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const tip = LOADING_TIPS[index];

  return (
    <div className="flex flex-col items-center w-full max-w-[280px] mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center text-center"
        >
          <span className="text-6xl mb-4">{tip.emoji}</span>
          <p className="text-sm text-text-secondary leading-relaxed break-keep text-center">
            {tip.text.split(/ — |(?<=\.) /).map((line, i) => (
              <span key={i}>{i > 0 && <br />}{line}</span>
            ))}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

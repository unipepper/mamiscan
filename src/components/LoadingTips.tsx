'use client';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LOADING_TIPS } from '@/lib/loadingTips';

export default function LoadingTips() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * LOADING_TIPS.length));

  useEffect(() => {
    const id = setInterval(() => {
      setIndex(i => (i + 1) % LOADING_TIPS.length);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const tip = LOADING_TIPS[index];

  return (
    <div className="flex flex-col items-center px-8 pt-6 max-w-xs mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center text-center"
        >
          <span className="text-5xl mb-3">{tip.emoji}</span>
          <p className="text-sm text-text-secondary leading-relaxed">{tip.text}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

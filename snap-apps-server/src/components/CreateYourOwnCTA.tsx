"use client";

/**
 * Create Your Own CTA - Encouraging users to try Mino
 *
 * This component appears at the bottom of shared Snap Apps
 * to drive conversion and app downloads.
 */

import { motion } from "framer-motion";
import { useState } from "react";

export function CreateYourOwnCTA() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="max-w-2xl mx-auto mt-12"
    >
      <div
        className="glass rounded-2xl p-8 text-center relative overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Animated background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-cyan-500/10"
          animate={{
            backgroundPosition: isHovered ? "200% 0" : "0% 0",
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          style={{ backgroundSize: "200% 100%" }}
        />

        {/* Content */}
        <div className="relative z-10 space-y-4">
          {/* Sparkle icons */}
          <div className="flex justify-center gap-2 text-2xl">
            <motion.span
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ✨
            </motion.span>
            <span>🚀</span>
            <motion.span
              animate={{ rotate: [0, -15, 15, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ✨
            </motion.span>
          </div>

          <h2 className="text-2xl font-bold text-white">
            Create Your Own Snap Apps
          </h2>

          <p className="text-white/60 max-w-md mx-auto">
            Turn any question into a beautiful, interactive app. Just ask Mino
            and watch it come to life.
          </p>

          {/* Example prompts */}
          <div className="flex flex-wrap justify-center gap-2 text-sm">
            {[
              "Compare iPhone prices",
              "Find the best restaurants",
              "Track flight prices",
            ].map((prompt, i) => (
              <motion.span
                key={prompt}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="px-3 py-1 rounded-full bg-white/5 text-white/50 border border-white/10"
              >
                &ldquo;{prompt}&rdquo;
              </motion.span>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <motion.a
              href="https://apps.apple.com/app/mino"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download for iOS
            </motion.a>

            <motion.a
              href="imessage://+1234567890"
              className="btn-secondary inline-flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>💬</span>
              Try via iMessage
            </motion.a>
          </div>

          {/* Trust indicators */}
          <div className="flex justify-center gap-6 pt-4 text-white/40 text-xs">
            <span>Free to use</span>
            <span>No account needed</span>
            <span>Works instantly</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

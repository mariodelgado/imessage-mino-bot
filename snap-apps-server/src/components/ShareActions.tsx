"use client";

/**
 * Share Actions - Client-side sharing functionality
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ShareActionsProps {
  snapAppId: string;
  title: string;
}

export function ShareActions({ snapAppId, title }: ShareActionsProps) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/app/${snapAppId}`
      : `/app/${snapAppId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);

      // Record share event
      fetch(`/api/snap-apps/${snapAppId}?action=share`, { method: "POST" });

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Check out this Snap App: ${title}`,
          url: shareUrl,
        });

        // Record share event
        fetch(`/api/snap-apps/${snapAppId}?action=share`, { method: "POST" });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      setShowMenu(true);
    }
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(`Check out this Snap App: ${title}`);
    const url = encodeURIComponent(shareUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank"
    );
    fetch(`/api/snap-apps/${snapAppId}?action=share`, { method: "POST" });
  };

  const shareToiMessage = () => {
    const text = encodeURIComponent(`Check out this Snap App: ${title} ${shareUrl}`);
    window.location.href = `sms:&body=${text}`;
    fetch(`/api/snap-apps/${snapAppId}?action=share`, { method: "POST" });
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Copy Link Button */}
        <motion.button
          onClick={handleCopy}
          className="btn-secondary text-sm flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                ✓
              </motion.span>
            ) : (
              <motion.span
                key="link"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                🔗
              </motion.span>
            )}
          </AnimatePresence>
          {copied ? "Copied!" : "Copy Link"}
        </motion.button>

        {/* Share Button */}
        <motion.button
          onClick={handleNativeShare}
          className="btn-primary text-sm flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span>↗</span>
          Share
        </motion.button>
      </div>

      {/* Share Menu (fallback for non-native share) */}
      <AnimatePresence>
        {showMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-full mt-2 z-50 glass rounded-xl py-2 min-w-[160px]"
            >
              <button
                onClick={shareToTwitter}
                className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-3"
              >
                <span>🐦</span>
                Twitter
              </button>
              <button
                onClick={shareToiMessage}
                className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-3"
              >
                <span>💬</span>
                iMessage
              </button>
              <button
                onClick={handleCopy}
                className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-3"
              >
                <span>🔗</span>
                Copy Link
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

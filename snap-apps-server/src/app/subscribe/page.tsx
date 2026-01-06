"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type DeliveryMethod = "imessage" | "sms" | "email";
type Step = "intro" | "topics" | "schedule" | "delivery" | "success";

const PRESET_TOPICS = [
  { id: "ai", label: "AI & Machine Learning", icon: "◉" },
  { id: "crypto", label: "Crypto & Web3", icon: "◈" },
  { id: "fintech", label: "Fintech", icon: "◎" },
  { id: "biotech", label: "Biotech & Health", icon: "◇" },
  { id: "climate", label: "Climate Tech", icon: "◆" },
  { id: "saas", label: "Enterprise SaaS", icon: "◊" },
  { id: "consumer", label: "Consumer Tech", icon: "○" },
  { id: "robotics", label: "Robotics & Hardware", icon: "●" },
];

const SCHEDULE_OPTIONS = [
  { id: "6am", time: "06:00", label: "6:00 AM", sublabel: "Early bird" },
  { id: "7am", time: "07:00", label: "7:00 AM", sublabel: "Morning brew" },
  { id: "8am", time: "08:00", label: "8:00 AM", sublabel: "Market open" },
  { id: "custom", time: "", label: "Custom", sublabel: "Pick your time" },
];

export default function SubscribePage() {
  const [step, setStep] = useState<Step>("intro");
  const [name, setName] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customCompanies, setCustomCompanies] = useState("");
  const [scheduleTime, setScheduleTime] = useState("07:00");
  const [customTime, setCustomTime] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("imessage");
  const [contactInfo, setContactInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState("");

  const toggleTopic = useCallback((topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((t) => t !== topicId)
        : [...prev, topicId]
    );
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const topics = selectedTopics.map(
        (id) => PRESET_TOPICS.find((t) => t.id === id)?.label || id
      );
      const companies = customCompanies
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const response = await fetch("/api/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          topics,
          companies,
          schedule: {
            enabled: true,
            time: scheduleTime === "" ? customTime : scheduleTime,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            daysOfWeek: [1, 2, 3, 4, 5],
          },
          deliveryMethod,
          phone: deliveryMethod !== "email" ? contactInfo : undefined,
          email: deliveryMethod === "email" ? contactInfo : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubscriptionId(data.subscription.id);
        setStep("success");
      }
    } catch (error) {
      console.error("Subscription error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case "intro":
        return name.trim().length > 0;
      case "topics":
        return selectedTopics.length > 0 || customCompanies.trim().length > 0;
      case "schedule":
        return scheduleTime !== "" || customTime !== "";
      case "delivery":
        return contactInfo.trim().length > 0;
      default:
        return false;
    }
  };

  const nextStep = () => {
    const steps: Step[] = ["intro", "topics", "schedule", "delivery", "success"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 2) {
      setStep(steps[currentIndex + 1]);
    } else if (step === "delivery") {
      handleSubmit();
    }
  };

  const prevStep = () => {
    const steps: Step[] = ["intro", "topics", "schedule", "delivery", "success"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  return (
    <div className="subscribe-container">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600&display=swap');

        :root {
          --glass-bg: rgba(20, 20, 22, 0.75);
          --glass-border: rgba(255, 255, 255, 0.08);
          --glass-highlight: rgba(255, 255, 255, 0.04);
          --text-primary: rgba(255, 255, 255, 0.95);
          --text-secondary: rgba(255, 255, 255, 0.55);
          --text-tertiary: rgba(255, 255, 255, 0.35);
          --accent: #3b82f6;
          --accent-glow: rgba(59, 130, 246, 0.25);
          --success: #10b981;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
          background: #0a0a0b;
          color: var(--text-primary);
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        .subscribe-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
          overflow: hidden;
        }

        .subscribe-container::before {
          content: '';
          position: fixed;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background:
            radial-gradient(ellipse at 20% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(99, 102, 241, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(20, 20, 22, 1) 0%, #0a0a0b 100%);
          z-index: -1;
        }

        .glass-card {
          background: var(--glass-bg);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 3rem;
          width: 100%;
          max-width: 480px;
          position: relative;
          overflow: hidden;
        }

        .glass-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        }

        .step-indicator {
          display: flex;
          gap: 8px;
          margin-bottom: 2.5rem;
          justify-content: center;
        }

        .step-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-tertiary);
          transition: all 0.3s ease;
        }

        .step-dot.active {
          background: var(--accent);
          box-shadow: 0 0 12px var(--accent-glow);
          transform: scale(1.2);
        }

        .step-dot.completed {
          background: var(--text-secondary);
        }

        h1 {
          font-size: 1.75rem;
          font-weight: 500;
          letter-spacing: -0.02em;
          margin-bottom: 0.75rem;
          text-align: center;
        }

        .subtitle {
          font-size: 0.95rem;
          color: var(--text-secondary);
          text-align: center;
          margin-bottom: 2rem;
          line-height: 1.5;
        }

        .input-group {
          margin-bottom: 1.5rem;
        }

        .input-label {
          display: block;
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="time"],
        textarea {
          width: 100%;
          padding: 1rem 1.25rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 1rem;
          transition: all 0.2s ease;
          outline: none;
        }

        input:focus,
        textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        input::placeholder,
        textarea::placeholder {
          color: var(--text-tertiary);
        }

        textarea {
          resize: none;
          min-height: 80px;
        }

        .topic-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .topic-chip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.85rem;
        }

        .topic-chip:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .topic-chip.selected {
          background: rgba(59, 130, 246, 0.15);
          border-color: var(--accent);
        }

        .topic-icon {
          font-size: 0.75rem;
          opacity: 0.6;
        }

        .schedule-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .schedule-option {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .schedule-option:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .schedule-option.selected {
          background: rgba(59, 130, 246, 0.15);
          border-color: var(--accent);
        }

        .schedule-time {
          font-size: 1.25rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .schedule-sublabel {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .delivery-options {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .delivery-option {
          flex: 1;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .delivery-option:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .delivery-option.selected {
          background: rgba(59, 130, 246, 0.15);
          border-color: var(--accent);
        }

        .delivery-icon {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .delivery-label {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }

        .btn {
          flex: 1;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          outline: none;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }

        .btn-primary {
          background: var(--accent);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #4f8ef7;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px var(--accent-glow);
        }

        .btn-primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .success-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          font-size: 2.5rem;
        }

        .success-details {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          padding: 1.25rem;
          margin-top: 1.5rem;
        }

        .success-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--glass-border);
        }

        .success-row:last-child {
          border-bottom: none;
        }

        .success-label {
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .success-value {
          font-size: 0.85rem;
        }

        .brand-mark {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.75rem;
          color: var(--text-tertiary);
          letter-spacing: 0.1em;
        }

        @media (max-width: 520px) {
          .glass-card {
            padding: 2rem 1.5rem;
          }

          .topic-grid,
          .schedule-options {
            grid-template-columns: 1fr;
          }

          .delivery-options {
            flex-direction: column;
          }
        }
      `}</style>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="glass-card"
        >
          {/* Step Indicator */}
          {step !== "success" && (
            <div className="step-indicator">
              {["intro", "topics", "schedule", "delivery"].map((s, i) => (
                <div
                  key={s}
                  className={`step-dot ${
                    s === step
                      ? "active"
                      : ["intro", "topics", "schedule", "delivery"].indexOf(step) > i
                      ? "completed"
                      : ""
                  }`}
                />
              ))}
            </div>
          )}

          {/* Step: Intro */}
          {step === "intro" && (
            <>
              <h1>Daily Intelligence</h1>
              <p className="subtitle">
                Get a personalized morning briefing delivered to you.
                Curated by AI, tailored to your interests.
              </p>

              <div className="input-group">
                <label className="input-label">Your Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
            </>
          )}

          {/* Step: Topics */}
          {step === "topics" && (
            <>
              <h1>What interests you?</h1>
              <p className="subtitle">
                Select topics or add specific companies you want to track.
              </p>

              <div className="topic-grid">
                {PRESET_TOPICS.map((topic) => (
                  <div
                    key={topic.id}
                    className={`topic-chip ${
                      selectedTopics.includes(topic.id) ? "selected" : ""
                    }`}
                    onClick={() => toggleTopic(topic.id)}
                  >
                    <span className="topic-icon">{topic.icon}</span>
                    <span>{topic.label}</span>
                  </div>
                ))}
              </div>

              <div className="input-group">
                <label className="input-label">Specific Companies (optional)</label>
                <textarea
                  placeholder="OpenAI, Stripe, Notion..."
                  value={customCompanies}
                  onChange={(e) => setCustomCompanies(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Step: Schedule */}
          {step === "schedule" && (
            <>
              <h1>When do you wake up?</h1>
              <p className="subtitle">
                Your briefing will be ready when you are.
              </p>

              <div className="schedule-options">
                {SCHEDULE_OPTIONS.map((option) => (
                  <div
                    key={option.id}
                    className={`schedule-option ${
                      scheduleTime === option.time ? "selected" : ""
                    }`}
                    onClick={() => setScheduleTime(option.time)}
                  >
                    <div className="schedule-time">{option.label}</div>
                    <div className="schedule-sublabel">{option.sublabel}</div>
                  </div>
                ))}
              </div>

              {scheduleTime === "" && (
                <div className="input-group">
                  <label className="input-label">Custom Time</label>
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {/* Step: Delivery */}
          {step === "delivery" && (
            <>
              <h1>How should we reach you?</h1>
              <p className="subtitle">
                Choose your preferred delivery method.
              </p>

              <div className="delivery-options">
                <div
                  className={`delivery-option ${
                    deliveryMethod === "imessage" ? "selected" : ""
                  }`}
                  onClick={() => setDeliveryMethod("imessage")}
                >
                  <div className="delivery-icon">💬</div>
                  <div className="delivery-label">iMessage</div>
                </div>
                <div
                  className={`delivery-option ${
                    deliveryMethod === "sms" ? "selected" : ""
                  }`}
                  onClick={() => setDeliveryMethod("sms")}
                >
                  <div className="delivery-icon">📱</div>
                  <div className="delivery-label">SMS</div>
                </div>
                <div
                  className={`delivery-option ${
                    deliveryMethod === "email" ? "selected" : ""
                  }`}
                  onClick={() => setDeliveryMethod("email")}
                >
                  <div className="delivery-icon">📧</div>
                  <div className="delivery-label">Email</div>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">
                  {deliveryMethod === "email" ? "Email Address" : "Phone Number"}
                </label>
                <input
                  type={deliveryMethod === "email" ? "email" : "tel"}
                  placeholder={
                    deliveryMethod === "email"
                      ? "you@example.com"
                      : "+1 (555) 000-0000"
                  }
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <>
              <div className="success-icon">✓</div>
              <h1>You&apos;re all set, {name}!</h1>
              <p className="subtitle">
                Your personalized briefing is being prepared. Expect your first
                delivery tomorrow morning.
              </p>

              <div className="success-details">
                <div className="success-row">
                  <span className="success-label">Delivery</span>
                  <span className="success-value">
                    {deliveryMethod === "email" ? "Email" : "iMessage/SMS"}
                  </span>
                </div>
                <div className="success-row">
                  <span className="success-label">Time</span>
                  <span className="success-value">
                    {scheduleTime || customTime} (local)
                  </span>
                </div>
                <div className="success-row">
                  <span className="success-label">Topics</span>
                  <span className="success-value">
                    {selectedTopics.length} selected
                  </span>
                </div>
                <div className="success-row">
                  <span className="success-label">ID</span>
                  <span className="success-value">{subscriptionId}</span>
                </div>
              </div>
            </>
          )}

          {/* Navigation Buttons */}
          {step !== "success" && (
            <div className="button-group">
              {step !== "intro" && (
                <button className="btn btn-secondary" onClick={prevStep}>
                  Back
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={nextStep}
                disabled={!canProceed() || isSubmitting}
              >
                {isSubmitting
                  ? "Creating..."
                  : step === "delivery"
                  ? "Start Briefings"
                  : "Continue"}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="brand-mark">MINO</div>
    </div>
  );
}

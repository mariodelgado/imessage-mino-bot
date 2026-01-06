/**
 * Notification System for Snap Apps
 *
 * Supports:
 * - Push notifications (APNs for iOS)
 * - SMS/Text notifications (Twilio)
 * - Webhook callbacks
 *
 * Used for:
 * - Price change alerts
 * - Availability notifications
 * - Data refresh alerts
 */

import { kv } from "@vercel/kv";

// ============================================================================
// TYPES
// ============================================================================

export type NotificationChannel = "push" | "sms" | "webhook" | "imessage";

export interface NotificationPreferences {
  userId: string;
  channels: NotificationChannel[];
  apnsToken?: string; // iOS push token
  phoneNumber?: string; // For SMS
  webhookUrl?: string;
  imessageHandle?: string; // Phone or email for iMessage
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  snapAppId?: string;
  priority?: "high" | "normal" | "low";
}

export interface DiffAlert {
  id: string;
  snapAppId: string;
  field: string; // JSON path to monitor, e.g., "data.items[0].price"
  threshold?: number; // For numeric fields, % change to trigger
  condition?: "any_change" | "increase" | "decrease" | "threshold";
  lastValue: unknown;
  createdAt: string;
  lastTriggeredAt?: string;
}

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

export async function setNotificationPreferences(
  prefs: NotificationPreferences
): Promise<void> {
  await kv.set(`notif:prefs:${prefs.userId}`, prefs);
}

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  return kv.get<NotificationPreferences>(`notif:prefs:${userId}`);
}

// ============================================================================
// PUSH NOTIFICATIONS (APNs)
// ============================================================================

const APNS_KEY_ID = process.env.APNS_KEY_ID;
const APNS_TEAM_ID = process.env.APNS_TEAM_ID;
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || "com.minnow.mino";
const APNS_PRIVATE_KEY = process.env.APNS_PRIVATE_KEY;

async function sendPushNotification(
  deviceToken: string,
  payload: NotificationPayload
): Promise<boolean> {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    console.warn("APNs not configured, skipping push notification");
    return false;
  }

  try {
    // Generate JWT for APNs
    const jwt = await generateApnsJwt();

    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: "default",
        badge: 1,
        "mutable-content": 1,
      },
      snapAppId: payload.snapAppId,
      ...payload.data,
    };

    const isProduction = process.env.NODE_ENV === "production";
    const apnsHost = isProduction
      ? "api.push.apple.com"
      : "api.sandbox.push.apple.com";

    const response = await fetch(
      `https://${apnsHost}/3/device/${deviceToken}`,
      {
        method: "POST",
        headers: {
          Authorization: `bearer ${jwt}`,
          "apns-topic": APNS_BUNDLE_ID!,
          "apns-push-type": "alert",
          "apns-priority": payload.priority === "high" ? "10" : "5",
        },
        body: JSON.stringify(apnsPayload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("APNs error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Push notification failed:", error);
    return false;
  }
}

async function generateApnsJwt(): Promise<string> {
  // In production, use proper JWT library with ES256 signing
  // This is a placeholder - implement with jose or similar
  const header = btoa(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const now = Math.floor(Date.now() / 1000);
  const claims = btoa(
    JSON.stringify({ iss: APNS_TEAM_ID, iat: now })
  );

  // TODO: Sign with APNS_PRIVATE_KEY using ES256
  // For now, return placeholder
  return `${header}.${claims}.signature`;
}

// ============================================================================
// SMS NOTIFICATIONS (Twilio)
// ============================================================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

async function sendSmsNotification(
  phoneNumber: string,
  payload: NotificationPayload
): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn("Twilio not configured, skipping SMS notification");
    return false;
  }

  try {
    const message = `${payload.title}\n\n${payload.body}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: TWILIO_PHONE_NUMBER,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Twilio error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("SMS notification failed:", error);
    return false;
  }
}

// ============================================================================
// iMESSAGE NOTIFICATIONS (via bot)
// ============================================================================

const IMESSAGE_BOT_WEBHOOK = process.env.IMESSAGE_BOT_WEBHOOK;

async function sendIMessageNotification(
  handle: string,
  payload: NotificationPayload
): Promise<boolean> {
  if (!IMESSAGE_BOT_WEBHOOK) {
    console.warn("iMessage bot webhook not configured");
    return false;
  }

  try {
    const message = `🔔 ${payload.title}\n\n${payload.body}`;

    const response = await fetch(IMESSAGE_BOT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: handle,
        message,
        snapAppId: payload.snapAppId,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("iMessage notification failed:", error);
    return false;
  }
}

// ============================================================================
// WEBHOOK NOTIFICATIONS
// ============================================================================

async function sendWebhookNotification(
  webhookUrl: string,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Mino-Notification": "true",
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error("Webhook notification failed:", error);
    return false;
  }
}

// ============================================================================
// SEND NOTIFICATION (MULTI-CHANNEL)
// ============================================================================

export async function sendNotification(
  userId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; channels: NotificationChannel[] }> {
  const prefs = await getNotificationPreferences(userId);

  if (!prefs) {
    return { success: false, channels: [] };
  }

  const sentChannels: NotificationChannel[] = [];

  for (const channel of prefs.channels) {
    let sent = false;

    switch (channel) {
      case "push":
        if (prefs.apnsToken) {
          sent = await sendPushNotification(prefs.apnsToken, payload);
        }
        break;

      case "sms":
        if (prefs.phoneNumber) {
          sent = await sendSmsNotification(prefs.phoneNumber, payload);
        }
        break;

      case "imessage":
        if (prefs.imessageHandle) {
          sent = await sendIMessageNotification(prefs.imessageHandle, payload);
        }
        break;

      case "webhook":
        if (prefs.webhookUrl) {
          sent = await sendWebhookNotification(prefs.webhookUrl, payload);
        }
        break;
    }

    if (sent) {
      sentChannels.push(channel);
    }
  }

  return {
    success: sentChannels.length > 0,
    channels: sentChannels,
  };
}

// ============================================================================
// DIFF ALERTS
// ============================================================================

export async function createDiffAlert(
  alert: Omit<DiffAlert, "id" | "createdAt">
): Promise<DiffAlert> {
  const id = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const fullAlert: DiffAlert = {
    ...alert,
    id,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`alert:${id}`, fullAlert);
  await kv.sadd(`alerts:snapapp:${alert.snapAppId}`, id);

  return fullAlert;
}

export async function getDiffAlertsForSnapApp(
  snapAppId: string
): Promise<DiffAlert[]> {
  const alertIds = await kv.smembers(`alerts:snapapp:${snapAppId}`);
  const alerts = await Promise.all(
    alertIds.map((id) => kv.get<DiffAlert>(`alert:${id}`))
  );
  return alerts.filter((a): a is DiffAlert => a !== null);
}

export async function deleteDiffAlert(alertId: string): Promise<void> {
  const alert = await kv.get<DiffAlert>(`alert:${alertId}`);
  if (alert) {
    await kv.srem(`alerts:snapapp:${alert.snapAppId}`, alertId);
    await kv.del(`alert:${alertId}`);
  }
}

// ============================================================================
// DIFF DETECTION
// ============================================================================

/**
 * Get value at JSON path
 * Supports: "field", "field.nested", "field[0]", "field[0].nested"
 */
function getValueAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;

    const key = /^\d+$/.test(part) ? parseInt(part) : part;
    current = (current as Record<string, unknown>)[key as string];
  }

  return current;
}

/**
 * Check if a diff alert should trigger
 */
export function shouldTriggerAlert(
  alert: DiffAlert,
  newValue: unknown
): boolean {
  const { lastValue, condition, threshold } = alert;

  // Any change
  if (condition === "any_change") {
    return JSON.stringify(newValue) !== JSON.stringify(lastValue);
  }

  // Numeric comparisons
  if (typeof newValue === "number" && typeof lastValue === "number") {
    const percentChange = ((newValue - lastValue) / lastValue) * 100;

    switch (condition) {
      case "increase":
        return newValue > lastValue;

      case "decrease":
        return newValue < lastValue;

      case "threshold":
        return threshold !== undefined && Math.abs(percentChange) >= threshold;
    }
  }

  // Default: any change
  return JSON.stringify(newValue) !== JSON.stringify(lastValue);
}

/**
 * Process diff alerts for a Snap App after data update
 */
export async function processDiffAlerts(
  snapAppId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  userId?: string
): Promise<DiffAlert[]> {
  const alerts = await getDiffAlertsForSnapApp(snapAppId);
  const triggeredAlerts: DiffAlert[] = [];

  for (const alert of alerts) {
    const oldValue = getValueAtPath(oldData, alert.field);
    const newValue = getValueAtPath(newData, alert.field);

    if (shouldTriggerAlert({ ...alert, lastValue: oldValue }, newValue)) {
      triggeredAlerts.push(alert);

      // Update alert with new value and trigger time
      await kv.set(`alert:${alert.id}`, {
        ...alert,
        lastValue: newValue,
        lastTriggeredAt: new Date().toISOString(),
      });

      // Send notification if userId provided
      if (userId) {
        await sendNotification(userId, {
          title: "Price Change Alert",
          body: `${alert.field} changed from ${JSON.stringify(oldValue)} to ${JSON.stringify(newValue)}`,
          snapAppId,
          data: {
            alertId: alert.id,
            field: alert.field,
            oldValue,
            newValue,
          },
          priority: "high",
        });
      }
    }
  }

  return triggeredAlerts;
}

/**
 * Push Notification Service for Mino
 *
 * Handles:
 * - Push token registration
 * - Notification permissions
 * - Foreground/background notification handling
 * - Morning update scheduling
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushToken {
  token: string;
  platform: "ios" | "android";
}

/**
 * Request notification permissions and get push token
 */
export async function registerForPushNotifications(): Promise<PushToken | null> {
  // Must be a physical device for push notifications
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied");
    return null;
  }

  // Get the push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Configure Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00D4FF",
      });

      await Notifications.setNotificationChannelAsync("morning-updates", {
        name: "Morning Updates",
        description: "Daily morning briefing from Mino",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00D4FF",
      });
    }

    return {
      token: tokenData.data,
      platform: Platform.OS as "ios" | "android",
    };
  } catch (error) {
    console.error("Failed to get push token:", error);
    return null;
  }
}

/**
 * Schedule a local notification for morning updates
 */
export async function scheduleMorningUpdate(
  hour: number = 8,
  minute: number = 0
): Promise<string | null> {
  try {
    // Cancel existing morning update notifications
    await cancelMorningUpdates();

    // Schedule daily notification
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Good morning!",
        body: "Tap to get your daily briefing from Mino",
        data: { type: "morning-update" },
        sound: true,
        ...(Platform.OS === "android" && { channelId: "morning-updates" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    console.log(`Scheduled morning update at ${hour}:${minute}`);
    return identifier;
  } catch (error) {
    console.error("Failed to schedule morning update:", error);
    return null;
  }
}

/**
 * Cancel all morning update notifications
 */
export async function cancelMorningUpdates(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.type === "morning-update") {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
    }
  }
}

/**
 * Show a local notification immediately
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Show immediately
  });
}

/**
 * Get the number of badge count
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear all notifications and badge
 */
export async function clearNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await setBadgeCount(0);
}

/**
 * Add listener for received notifications (foreground)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notification responses (user tapped)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get last notification response (for handling app launch from notification)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

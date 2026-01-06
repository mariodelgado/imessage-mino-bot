/**
 * Local Mac Automation
 *
 * Uses Gemini to interpret natural language commands
 * Executes via AppleScript/osascript locally - no cloud dependency
 */

import { exec } from "child_process";
import { promisify } from "util";
import { GoogleGenerativeAI } from "@google/generative-ai";

const execAsync = promisify(exec);

// Only Mario can use Mac automation
const MAC_AUTOMATION_USER = "+14156836861";

// Gemini for command interpretation
let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

export function initLocalMac(apiKey: string) {
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  console.log("🖥️ Local Mac automation initialized");
}

export function isAuthorized(phone: string): boolean {
  return phone === MAC_AUTOMATION_USER;
}

export function isConfigured(): boolean {
  return model !== null;
}

// Action types we can execute
interface MacAction {
  type: "applescript" | "shell" | "open_app" | "system_preference";
  script?: string;
  command?: string;
  app?: string;
  description: string;
}

interface InterpretedCommand {
  understood: boolean;
  action?: MacAction;
  response: string;
  confidence: "high" | "medium" | "low";
}

// Common AppleScript templates
const SCRIPTS = {
  openApp: (app: string) => `tell application "${app}" to activate`,
  quitApp: (app: string) => `tell application "${app}" to quit`,

  // Music (works with Apple Music or Spotify)
  playMusic: `
    if application "Spotify" is running then
      tell application "Spotify" to play
    else if application "Music" is running then
      tell application "Music" to play
    else
      tell application "Spotify"
        activate
        delay 1
        play
      end tell
    end if
  `,
  pauseMusic: `
    if application "Spotify" is running then
      tell application "Spotify" to pause
    else if application "Music" is running then
      tell application "Music" to pause
    end if
  `,
  nextTrack: `
    if application "Spotify" is running then
      tell application "Spotify" to next track
    else if application "Music" is running then
      tell application "Music" to next track
    end if
  `,
  previousTrack: `
    if application "Spotify" is running then
      tell application "Spotify" to previous track
    else if application "Music" is running then
      tell application "Music" to previous track
    end if
  `,

  // System
  setVolume: (level: number) => `set volume output volume ${level}`,
  mute: `set volume output muted true`,
  unmute: `set volume output muted false`,
  getVolume: `output volume of (get volume settings)`,

  // Display
  setBrightness: (level: number) => {
    const normalized = level / 100;
    return `do shell script "brightness ${normalized}"`;
  },

  // Dark mode
  enableDarkMode: `
    tell application "System Events"
      tell appearance preferences
        set dark mode to true
      end tell
    end tell
  `,
  disableDarkMode: `
    tell application "System Events"
      tell appearance preferences
        set dark mode to false
      end tell
    end tell
  `,
  toggleDarkMode: `
    tell application "System Events"
      tell appearance preferences
        set dark mode to not dark mode
      end tell
    end tell
  `,

  // Do Not Disturb (macOS Monterey+)
  enableDND: `do shell script "shortcuts run 'Turn On Focus'"`,
  disableDND: `do shell script "shortcuts run 'Turn Off Focus'"`,

  // Screenshot
  screenshot: `do shell script "screencapture -i ~/Desktop/screenshot-$(date +%Y%m%d-%H%M%S).png"`,
  screenshotClipboard: `do shell script "screencapture -c"`,

  // Lock screen
  lockScreen: `tell application "System Events" to keystroke "q" using {command down, control down}`,

  // Empty trash
  emptyTrash: `tell application "Finder" to empty trash`,

  // Get current app
  getCurrentApp: `
    tell application "System Events"
      name of first application process whose frontmost is true
    end tell
  `,

  // Notification
  notify: (title: string, message: string) => `display notification "${message}" with title "${title}"`,
};

/**
 * Execute AppleScript
 */
async function runAppleScript(script: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
    return stdout.trim() || "Done";
  } catch (err: any) {
    console.error("AppleScript error:", err.message);
    throw new Error(`AppleScript failed: ${err.message}`);
  }
}

/**
 * Execute shell command
 */
async function runShell(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim() || "Done";
  } catch (err: any) {
    throw new Error(`Shell command failed: ${err.message}`);
  }
}

/**
 * Use Gemini to interpret natural language command
 */
async function interpretWithGemini(text: string): Promise<InterpretedCommand> {
  if (!model) {
    return { understood: false, response: "Mac automation not initialized", confidence: "low" };
  }

  const prompt = `You are a Mac automation assistant. Given a user command, determine what action to take.

Available actions:
- open_app: Open an application (app name)
- quit_app: Quit an application (app name)
- play_music: Start playing music (Spotify/Apple Music)
- pause_music: Pause music
- next_track: Skip to next track
- previous_track: Go to previous track
- set_volume: Set system volume (0-100)
- mute/unmute: Mute or unmute audio
- set_brightness: Set screen brightness (0-100)
- dark_mode_on/off/toggle: Control dark mode
- dnd_on/off: Do Not Disturb
- screenshot: Take a screenshot
- lock_screen: Lock the screen
- empty_trash: Empty the trash
- notify: Show a notification (title, message)
- shell: Run a shell command (provide command)
- none: Cannot help with this request

User command: "${text}"

Respond in JSON format:
{
  "action": "action_name",
  "params": { ... },  // any parameters needed
  "response": "Human-friendly response",
  "confidence": "high" | "medium" | "low"
}

If you can't understand or it's not a Mac command, use action "none".`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { understood: false, response: "Couldn't understand command", confidence: "low" };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.action === "none") {
      return { understood: false, response: parsed.response || "Not a Mac command", confidence: "low" };
    }

    // Map to our action system
    const action = mapToAction(parsed.action, parsed.params);

    return {
      understood: true,
      action,
      response: parsed.response,
      confidence: parsed.confidence || "medium",
    };
  } catch (err) {
    console.error("Gemini interpretation error:", err);
    return { understood: false, response: "Failed to interpret command", confidence: "low" };
  }
}

/**
 * Map Gemini output to executable action
 */
function mapToAction(actionName: string, params: any = {}): MacAction {
  switch (actionName) {
    case "open_app":
      return {
        type: "applescript",
        script: SCRIPTS.openApp(params.app || params.name || "Finder"),
        description: `Opening ${params.app || params.name}`,
      };
    case "quit_app":
      return {
        type: "applescript",
        script: SCRIPTS.quitApp(params.app || params.name),
        description: `Quitting ${params.app || params.name}`,
      };
    case "play_music":
      return {
        type: "applescript",
        script: SCRIPTS.playMusic,
        description: "Playing music",
      };
    case "pause_music":
      return {
        type: "applescript",
        script: SCRIPTS.pauseMusic,
        description: "Pausing music",
      };
    case "next_track":
      return {
        type: "applescript",
        script: SCRIPTS.nextTrack,
        description: "Skipping to next track",
      };
    case "previous_track":
      return {
        type: "applescript",
        script: SCRIPTS.previousTrack,
        description: "Going to previous track",
      };
    case "set_volume":
      const vol = Math.min(100, Math.max(0, parseInt(params.level || params.volume || "50")));
      return {
        type: "applescript",
        script: SCRIPTS.setVolume(vol),
        description: `Setting volume to ${vol}%`,
      };
    case "mute":
      return {
        type: "applescript",
        script: SCRIPTS.mute,
        description: "Muting audio",
      };
    case "unmute":
      return {
        type: "applescript",
        script: SCRIPTS.unmute,
        description: "Unmuting audio",
      };
    case "set_brightness":
      const bright = Math.min(100, Math.max(0, parseInt(params.level || params.brightness || "50")));
      return {
        type: "shell",
        command: `brightness ${bright / 100}`,
        description: `Setting brightness to ${bright}%`,
      };
    case "dark_mode_on":
      return {
        type: "applescript",
        script: SCRIPTS.enableDarkMode,
        description: "Enabling dark mode",
      };
    case "dark_mode_off":
      return {
        type: "applescript",
        script: SCRIPTS.disableDarkMode,
        description: "Disabling dark mode",
      };
    case "dark_mode_toggle":
      return {
        type: "applescript",
        script: SCRIPTS.toggleDarkMode,
        description: "Toggling dark mode",
      };
    case "dnd_on":
      return {
        type: "applescript",
        script: SCRIPTS.enableDND,
        description: "Enabling Do Not Disturb",
      };
    case "dnd_off":
      return {
        type: "applescript",
        script: SCRIPTS.disableDND,
        description: "Disabling Do Not Disturb",
      };
    case "screenshot":
      return {
        type: "applescript",
        script: SCRIPTS.screenshot,
        description: "Taking screenshot",
      };
    case "lock_screen":
      return {
        type: "applescript",
        script: SCRIPTS.lockScreen,
        description: "Locking screen",
      };
    case "empty_trash":
      return {
        type: "applescript",
        script: SCRIPTS.emptyTrash,
        description: "Emptying trash",
      };
    case "notify":
      return {
        type: "applescript",
        script: SCRIPTS.notify(params.title || "Mino", params.message || "Notification"),
        description: "Showing notification",
      };
    case "shell":
      return {
        type: "shell",
        command: params.command,
        description: `Running: ${params.command}`,
      };
    default:
      return {
        type: "applescript",
        script: `display notification "Unknown action: ${actionName}" with title "Mino"`,
        description: "Unknown action",
      };
  }
}

/**
 * Execute a Mac action
 */
async function executeAction(action: MacAction): Promise<string> {
  console.log(`🖥️ Executing: ${action.description}`);

  try {
    if (action.type === "applescript" && action.script) {
      return await runAppleScript(action.script);
    } else if (action.type === "shell" && action.command) {
      return await runShell(action.command);
    } else {
      throw new Error("Invalid action configuration");
    }
  } catch (err: any) {
    console.error(`Action failed: ${err.message}`);
    throw err;
  }
}

/**
 * Main entry point - interpret and execute a command
 */
export async function runCommand(text: string): Promise<{ success: boolean; message: string }> {
  // First try pattern matching for common commands (faster, no API call)
  const quickAction = quickMatch(text);
  if (quickAction) {
    try {
      const result = await executeAction(quickAction);
      return { success: true, message: `✅ ${quickAction.description}\n${result !== "Done" ? result : ""}`.trim() };
    } catch (err: any) {
      return { success: false, message: `❌ ${err.message}` };
    }
  }

  // Fall back to Gemini interpretation
  const interpreted = await interpretWithGemini(text);

  if (!interpreted.understood || !interpreted.action) {
    return { success: false, message: interpreted.response };
  }

  try {
    const result = await executeAction(interpreted.action);
    return {
      success: true,
      message: `✅ ${interpreted.response}\n${result !== "Done" ? result : ""}`.trim()
    };
  } catch (err: any) {
    return { success: false, message: `❌ ${interpreted.response} failed: ${err.message}` };
  }
}

/**
 * Quick pattern matching for common commands (no API call needed)
 */
function quickMatch(text: string): MacAction | null {
  const t = text.toLowerCase().trim();

  // Open app
  let match = t.match(/^(?:open|launch|start)\s+(.+)$/i);
  if (match) {
    const app = capitalizeApp(match[1]);
    return { type: "applescript", script: SCRIPTS.openApp(app), description: `Opening ${app}` };
  }

  // Quit app
  match = t.match(/^(?:quit|close|exit)\s+(.+)$/i);
  if (match) {
    const app = capitalizeApp(match[1]);
    return { type: "applescript", script: SCRIPTS.quitApp(app), description: `Quitting ${app}` };
  }

  // Music controls
  if (/^play\s*(some\s*)?(music)?$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.playMusic, description: "Playing music" };
  }
  if (/^pause\s*(the\s*)?(music)?$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.pauseMusic, description: "Pausing music" };
  }
  if (/^(next\s*track|skip)$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.nextTrack, description: "Next track" };
  }
  if (/^(previous\s*track|prev|back)$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.previousTrack, description: "Previous track" };
  }

  // Volume
  match = t.match(/^(?:set\s+)?volume\s+(?:to\s+)?(\d+)/i);
  if (match) {
    const level = parseInt(match[1]);
    return { type: "applescript", script: SCRIPTS.setVolume(level), description: `Volume ${level}%` };
  }
  if (/^mute$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.mute, description: "Muting" };
  }
  if (/^unmute$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.unmute, description: "Unmuting" };
  }

  // Brightness
  match = t.match(/^(?:set\s+)?brightness\s+(?:to\s+)?(\d+)/i);
  if (match) {
    const level = parseInt(match[1]);
    return { type: "shell", command: `brightness ${level / 100}`, description: `Brightness ${level}%` };
  }

  // Dark mode
  if (/^(?:turn\s+on|enable)\s+dark\s*mode$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.enableDarkMode, description: "Enabling dark mode" };
  }
  if (/^(?:turn\s+off|disable)\s+dark\s*mode$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.disableDarkMode, description: "Disabling dark mode" };
  }
  if (/^(?:toggle)\s+dark\s*mode$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.toggleDarkMode, description: "Toggling dark mode" };
  }

  // Screenshot
  if (/^(?:take\s+a?\s*)?screenshot$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.screenshot, description: "Taking screenshot" };
  }

  // Lock
  if (/^lock\s*(the\s*)?(screen|computer|mac)?$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.lockScreen, description: "Locking screen" };
  }

  // Empty trash
  if (/^empty\s*(the\s*)?trash$/i.test(t)) {
    return { type: "applescript", script: SCRIPTS.emptyTrash, description: "Emptying trash" };
  }

  return null;
}

/**
 * Capitalize app name properly
 */
function capitalizeApp(name: string): string {
  const appMappings: Record<string, string> = {
    "spotify": "Spotify",
    "chrome": "Google Chrome",
    "safari": "Safari",
    "finder": "Finder",
    "terminal": "Terminal",
    "iterm": "iTerm",
    "vscode": "Visual Studio Code",
    "code": "Visual Studio Code",
    "slack": "Slack",
    "discord": "Discord",
    "messages": "Messages",
    "imessage": "Messages",
    "mail": "Mail",
    "calendar": "Calendar",
    "notes": "Notes",
    "reminders": "Reminders",
    "music": "Music",
    "photos": "Photos",
    "preview": "Preview",
    "pages": "Pages",
    "numbers": "Numbers",
    "keynote": "Keynote",
    "xcode": "Xcode",
    "figma": "Figma",
    "notion": "Notion",
    "arc": "Arc",
    "raycast": "Raycast",
    "1password": "1Password",
    "zoom": "zoom.us",
    "teams": "Microsoft Teams",
    "word": "Microsoft Word",
    "excel": "Microsoft Excel",
    "powerpoint": "Microsoft PowerPoint",
  };

  const normalized = name.toLowerCase().trim();
  return appMappings[normalized] || name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default {
  initLocalMac,
  isAuthorized,
  isConfigured,
  runCommand,
};

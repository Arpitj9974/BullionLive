# Guide: Keeping Your App Awake 24/7 (High Performance)

Because your application is hosted on Render's free tier, the server "goes to sleep" after 15 minutes of inactivity. This causes the **8-10 second delay** when a user first opens the site after a long break.

To fix this completely and get **1-second load times** 24/7, follow these instructions to "ping" your server automatically.

## Option 1: Using Cron-job.org (Recommended Free Service)

1.  **Sign Up**: Create a free account at [Cron-job.org](https://cron-job.org/).
2.  **Create a New Job**:
    *   **Title**: `AR-Market-Tracker-Pinger`
    *   **URL**: `https://your-render-app-url.com/api/market-prices` (Replace with your actual Render URL).
    *   **Schedule**: Select **"Every 15 minutes"**.
3.  **Save**: Click "Create".
4.  **Result**: This service will now "talk" to your server every 15 minutes, preventing it from ever falling asleep. Every user will now experience an instant load.

## Option 2: Using UptimeRobot (Free Status Monitor)

1.  **Sign Up**: Create a free account at [UptimeRobot.com](https://uptimerobot.com/).
2.  **Add New Monitor**:
    *   **Monitor Type**: `HTTP(s)`
    *   **Friendly Name**: `Market Tracker Warm-up`
    *   **URL**: `https://your-render-app-url.com/` (Your main URL).
    *   **Monitoring Interval**: Set to **"Every 15 minutes"**.
3.  **Result**: UptimeRobot will check your site every 15 minutes. This check is enough to keep Render's free server awake forever.

---

### Why this works:
Render's sleep timer is only triggered if **no one** visits for 15 minutes. By having an automated service "visit" your site every 15 minutes, Render thinks someone is always there, so it **never sleeps**.

> [!TIP]
> **Combine this with my code changes**: My code improvements make the server respond faster during the initial "warm-up," but the instructions above are the only way to eliminate the "Container Wake-up" delay entirely on the free tier.

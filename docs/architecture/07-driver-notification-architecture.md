# 🔔 RideNow — Driver Notification & Background Architecture

> How the system reliably notifies drivers of new ride requests — even when they're outside the app.

---

## 1. The Challenge

A driver is **ONLINE** but currently using Google Maps, WhatsApp, YouTube, or their phone is screen-off. A rider requests a ride. The driver **must** be notified immediately with an actionable notification.

**Constraints:**
- Android and iOS have strict background execution limits
- Cannot pop up arbitrary UI over other apps (restricted since Android 10+)
- iOS cannot force-bring an app to foreground
- Battery optimization can kill background processes
- Must work reliably in production for Play Store / App Store approval

---

## 2. Dual-Channel Strategy

Every critical notification is sent through **two channels simultaneously**:

```
Ride Request Available
        │
        ├──► Channel 1: WebSocket (if connected)
        │    • Instant, in-app overlay
        │    • Best UX when app is open
        │
        └──► Channel 2: FCM Push Notification (always)
             • Works when app is backgrounded/killed
             • OS-level delivery guarantee
             • Action buttons (Accept/Reject)
```

The app deduplicates: if WebSocket delivers first, the push notification updates but doesn't show again.

---

## 3. Android Implementation

### 3.1 Foreground Service (REQUIRED when driver is ONLINE)

```kotlin
// DriverOnlineService.kt — Runs as a Foreground Service
class DriverOnlineService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createPersistentNotification()
        startForeground(NOTIFICATION_ID, notification)
        
        // Start location updates
        startLocationUpdates()
        
        // Maintain WebSocket connection
        connectWebSocket()
        
        // Start heartbeat timer
        startHeartbeat()
        
        return START_STICKY // Restart if killed
    }

    private fun createPersistentNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ONLINE_STATUS)
            .setContentTitle("RideNow Driver")
            .setContentText("You're online — waiting for ride requests")
            .setSmallIcon(R.drawable.ic_online)
            .setOngoing(true) // Cannot be dismissed
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }
}
```

**Permissions required in AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

### 3.2 FCM Data Message Handling

```kotlin
// RideNotificationService.kt
class RideNotificationService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        
        when (data["type"]) {
            "NEW_RIDE_REQUEST" -> showRideRequestNotification(data)
            "RIDE_CANCELLED" -> showCancellationNotification(data)
            "SCHEDULED_RIDE_REMINDER" -> showReminderNotification(data)
        }
    }

    private fun showRideRequestNotification(data: Map<String, String>) {
        val rideId = data["ride_id"]
        val pickup = data["pickup_address"]
        val drop = data["drop_address"]
        val earnings = data["estimated_earnings"]
        val expiresAt = data["expires_at"]

        // Create high-priority notification channel
        createRideRequestChannel()

        // Build notification with action buttons
        val acceptIntent = createAcceptPendingIntent(rideId)
        val rejectIntent = createRejectPendingIntent(rideId)
        
        val notification = NotificationCompat.Builder(this, CHANNEL_RIDE_REQUEST)
            .setContentTitle("🚗 New Ride Request!")
            .setContentText("$pickup → $drop")
            .setSubText("Earn ₹$earnings")
            .setSmallIcon(R.drawable.ic_ride_request)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL) // Heads-up style
            .setAutoCancel(true)
            .setTimeoutAfter(30000) // Auto-dismiss after 30s
            .setVibrate(longArrayOf(0, 500, 200, 500, 200, 500))
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
            .setFullScreenIntent(createFullScreenIntent(rideId), true) // Android 10-13
            .addAction(R.drawable.ic_accept, "ACCEPT", acceptIntent)
            .addAction(R.drawable.ic_reject, "REJECT", rejectIntent)
            .build()

        notificationManager.notify(RIDE_REQUEST_NOTIFICATION_ID, notification)
    }

    private fun createRideRequestChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_RIDE_REQUEST,
                "Ride Requests",
                NotificationManager.IMPORTANCE_HIGH // Heads-up notification
            ).apply {
                description = "Incoming ride request notifications"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                setBypassDnd(false) // Respect DND settings
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }
    }
}
```

### 3.3 Android Version-Specific Behavior

| Android Version | Full-Screen Intent | Heads-Up | Foreground Service | Background Location |
|----------------|-------------------|----------|-------------------|-------------------|
| Android 8-9 | ✅ Unrestricted | ✅ | ✅ | ✅ |
| Android 10 (Q) | ✅ | ✅ | ✅ | Requires `ACCESS_BACKGROUND_LOCATION` |
| Android 11 (R) | ✅ | ✅ | ✅ | Separate permission request |
| Android 12 (S) | ✅ | ✅ | Requires exact type declaration | ✅ |
| Android 13 (T) | ✅ | Requires `POST_NOTIFICATIONS` | ✅ | ✅ |
| Android 14 (U) | ❌ Restricted* | ✅ | Requires `FOREGROUND_SERVICE_LOCATION` | ✅ |
| Android 15+ | ❌ Restricted* | ✅ | ✅ | ✅ |

*\*Android 14+: `FULL_SCREEN_INTENT` requires `USE_FULL_SCREEN_INTENT` permission, which Google Play restricts to phone/alarm apps. **Mitigation: Use `IMPORTANCE_HIGH` notification channel for heads-up display instead.***

### 3.4 Battery Optimization Handling

```dart
// In Flutter driver app — request user to disable battery optimization
Future<void> requestBatteryOptimizationExemption() async {
  if (Platform.isAndroid) {
    final isIgnoring = await Permission.ignoreBatteryOptimizations.isGranted;
    if (!isIgnoring) {
      // Show dialog explaining why
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: Text("Battery Optimization"),
          content: Text(
            "To receive ride requests reliably, please disable "
            "battery optimization for RideNow Driver."
          ),
          actions: [
            TextButton(
              onPressed: () => Permission.ignoreBatteryOptimizations.request(),
              child: Text("ALLOW"),
            ),
          ],
        ),
      );
    }
  }
}
```

---

## 4. iOS Implementation

### 4.1 Background Location Mode

In `Info.plist`:
```xml
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>remote-notification</string>
    <string>fetch</string>
</array>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>RideNow needs your location to match you with nearby riders and provide accurate navigation during trips.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>RideNow needs your location to show your position on the map and match you with nearby riders.</string>
```

### 4.2 APNs Notification with Actions

The backend sends via FCM (which routes to APNs automatically):

```json
{
  "message": {
    "token": "<driver_fcm_token>",
    "data": {
      "type": "NEW_RIDE_REQUEST",
      "ride_id": "uuid",
      "pickup_address": "T. Nagar, Chennai",
      "drop_address": "Adyar, Chennai",
      "estimated_earnings": "160.00"
    },
    "apns": {
      "headers": {
        "apns-priority": "10",
        "apns-push-type": "alert"
      },
      "payload": {
        "aps": {
          "alert": {
            "title": "🚗 New Ride Request!",
            "body": "T. Nagar → Adyar · Earn ₹160"
          },
          "sound": "ride_request.caf",
          "badge": 1,
          "category": "RIDE_REQUEST_CATEGORY",
          "interruption-level": "time-sensitive",
          "mutable-content": 1
        }
      }
    }
  }
}
```

### 4.3 iOS Notification Actions

```swift
// AppDelegate.swift — Register notification categories
let acceptAction = UNNotificationAction(
    identifier: "ACCEPT_RIDE",
    title: "Accept",
    options: [.foreground]  // Opens app
)
let rejectAction = UNNotificationAction(
    identifier: "REJECT_RIDE", 
    title: "Reject",
    options: [.destructive]  // Can be handled in background
)

let rideCategory = UNNotificationCategory(
    identifier: "RIDE_REQUEST_CATEGORY",
    actions: [acceptAction, rejectAction],
    intentIdentifiers: [],
    options: [.customDismissAction]
)

UNUserNotificationCenter.current().setNotificationCategories([rideCategory])
```

### 4.4 iOS Limitations (IMPORTANT)

| Feature | Status | Notes |
|---------|--------|-------|
| Full-screen overlay | ❌ **Not possible** | iOS does not allow apps to display UI over other apps |
| VoIP push for ride alerts | ❌ **Prohibited** | Apple rejects apps using VoIP push for non-VoIP purposes |
| Custom notification sound | ✅ Max 30 seconds | Use `.caf` format |
| Notification actions | ✅ Accept/Reject buttons | Tapping Accept opens app |
| Time Sensitive alerts | ✅ iOS 15+ | Can break through Focus mode (with user permission) |
| Background app refresh | ⚠️ Unreliable | iOS throttles based on usage patterns |
| Background location | ✅ With "Always" permission | Shows blue status bar indicator |
| Force bring app to foreground | ❌ **Not possible** | User must tap notification |

---

## 5. Backend FCM Sending

```java
@Service
public class PushNotificationService {

    private final FirebaseMessaging firebaseMessaging;

    public void sendRideRequest(Driver driver, Ride ride, RideRequest request) {
        if (driver.getFcmToken() == null) {
            log.warn("Driver {} has no FCM token", driver.getId());
            return;
        }

        Message message = Message.builder()
            .setToken(driver.getFcmToken())
            .putData("type", "NEW_RIDE_REQUEST")
            .putData("ride_id", ride.getId().toString())
            .putData("pickup_address", ride.getPickupAddress())
            .putData("drop_address", ride.getDropAddress())
            .putData("estimated_earnings", request.getEstimatedEarnings().toString())
            .putData("estimated_distance", ride.getEstimatedDistanceKm().toString())
            .putData("ride_type", ride.getRideType().name())
            .putData("vehicle_category", ride.getVehicleCategory().getDisplayName())
            .putData("expires_at", request.getExpiresAt().toString())
            .setAndroidConfig(AndroidConfig.builder()
                .setPriority(AndroidConfig.Priority.HIGH)
                .setTtl(Duration.ofSeconds(30).toMillis())
                .build())
            .setApnsConfig(ApnsConfig.builder()
                .setAps(Aps.builder()
                    .setAlert(ApsAlert.builder()
                        .setTitle("🚗 New Ride Request!")
                        .setBody(ride.getPickupAddress() + " → " + ride.getDropAddress())
                        .build())
                    .setSound("ride_request.caf")
                    .setCategory("RIDE_REQUEST_CATEGORY")
                    .putCustomData("interruption-level", "time-sensitive")
                    .build())
                .putHeader("apns-priority", "10")
                .build())
            .build();

        try {
            String messageId = firebaseMessaging.send(message);
            log.info("FCM sent to driver {}: {}", driver.getId(), messageId);
        } catch (FirebaseMessagingException e) {
            log.error("FCM send failed for driver {}", driver.getId(), e);
            // Don't throw — notification failure must not block ride matching
            // Retry will be handled by NotificationRetryHandler
        }
    }
}
```

---

## 6. Heartbeat & Presence Detection

```
Driver App (when ONLINE)
    │
    ├──► Every 60s: POST /api/v1/drivers/heartbeat
    │    { latitude, longitude, batteryLevel, appVersion }
    │
    ▼
Backend
    ├──► Update Redis: SET driver:heartbeat:{id} {timestamp} EX 120
    ├──► Update Redis: GEOADD driver:locations {lng} {lat} {id}
    └──► Update DB: driver_availability.last_heartbeat = NOW()

Heartbeat Monitor (Spring @Scheduled, every 2 minutes)
    │
    ├──► Find: drivers WHERE is_online = TRUE AND last_heartbeat < NOW() - 2 min
    │
    └──► For each stale driver:
         ├──► IF has active ride → DON'T mark offline (keep ride alive)
         │    └──► Log warning: "Driver {id} heartbeat stale during active ride"
         │
         └──► IF no active ride → Mark offline
              ├──► driver.is_online = FALSE
              ├──► ZREM driver:locations {id}
              ├──► Log: "Driver {id} auto-offlined: heartbeat timeout"
              └──► Record: driver_availability.offline_reason = 'HEARTBEAT_TIMEOUT'
```

---

## 7. Decision Matrix: What Happens In Each Scenario

| Driver State | App State | Ride Request Arrives | What Driver Sees |
|-------------|-----------|---------------------|------------------|
| Online | App in foreground | WebSocket delivers + FCM arrives | In-app overlay dialog with countdown, sound, vibration |
| Online | App in background | FCM data message triggers notification | Heads-up notification (Android) / Banner (iOS) with Accept/Reject |
| Online | App killed, foreground service running | FCM delivers, foreground service shows notification | Same as background |
| Online | App killed, no foreground service | FCM delivers to OS | Standard notification, tapping opens app to ride request |
| Online | Screen off | FCM wakes device, shows on lock screen | Lock screen notification with actions |
| Online | In Google Maps | Foreground service running, FCM delivers | Heads-up notification overlaid on Maps |
| Online | On phone call | FCM delivers | Notification appears, sound may be muted |
| Online | DND mode | FCM high-priority may bypass | Depends on user DND settings |
| Offline | Any | No request sent | Nothing — driver not in matching pool |
| Online | Airplane mode | Heartbeat timeout → auto-offline in 2 min | Nothing after timeout |

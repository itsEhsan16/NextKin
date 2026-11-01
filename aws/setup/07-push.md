# Turning push on

Push is built and sends through Amazon SNS mobile push, as V2 §9.12 says. It's off until the pieces
below exist. Nothing here can be tested from a laptop: SNS has no local twin, so `PUSH_ADAPTER=log`
only records that a push would have left.

## What you need first

| Piece | Who | Where |
|---|---|---|
| A Firebase project, with an Android app for `com.nextkin.app` | Client | Firebase console |
| Its `google-services.json` | Client | Firebase console, then an EAS file secret |
| A Firebase service-account key (FCM v1) | Client | Firebase console, Project settings, Service accounts |
| An Apple push key (`.p8`), its key ID and the team ID | Client | Apple Developer account, once filed |

## Steps

1. **Give EAS the Firebase file.** Add `google-services.json` as an EAS file secret named
   `GOOGLE_SERVICES_JSON`. `app.config.ts` reads it, and only a build uses it.
2. **Create two SNS platform applications** in the AWS console or CLI, in the region the worker runs in:
   - Android: platform `GCM`, with the Firebase service-account JSON as the credential.
   - iOS: platform `APNS` for release builds, or `APNS_SANDBOX` for development builds, with the
     `.p8` key.
3. **Allow the worker to use them.** Only the worker's task role needs this, because the web process
   never talks to SNS:
   - `sns:CreatePlatformEndpoint` and `sns:GetPlatformApplicationAttributes` on the two application ARNs.
   - `sns:Publish`, `sns:DeleteEndpoint` and `sns:GetEndpointAttributes` on
     `arn:aws:sns:<region>:<account>:endpoint/*`.
4. **Set the worker's configuration:**
   - `PUSH_ADAPTER=sns`
   - `PUSH_SNS_ANDROID_ARN=<the Android application ARN>`
   - `PUSH_SNS_IOS_ARN=<the iOS application ARN>`

   Staging and production refuse to start with `sns` and a missing ARN.
5. **Make a development build** (`eas build --profile development`). Expo Go can't receive a push.
6. **Check it on a phone.** Sign in, allow notifications, finish a run, and put the app in the
   background. The push should arrive within two minutes, and a tap should open the run.

## What to check after the first real send

- `push_messages.outcome` for the row reads `sent`. `no_device` means no phone was registered, and
  `failed` means all three attempts failed; the worker log has the error's name.
- A tap opens the right screen on both platforms. The tap's destination travels in the message's
  `data` on Android and at the top level on iOS (`src/push/push.ts`, `src/lib/pushDevice.ts`).
- The privacy policy names Amazon SNS, Google and Apple as carriers of the push text, which can include
  an employer's name.

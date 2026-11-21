# Turning push on with Claude in Chrome

The steps in [07-push.md](07-push.md), split into prompts you can paste into Claude in Chrome. Run
them in order, signed in to your own Google and AWS accounts. Android only for now; iOS waits for the
Apple Developer account.

Two files come out of step 1, and both are secrets: `google-services.json` (goes to EAS) and the
Firebase service-account key (goes to AWS SNS). Neither is ever pasted into a chat. Delete the
service-account key from Downloads once step 3 is done.

## Step 1 · Firebase (Claude in Chrome)

```text
Set up Firebase Cloud Messaging for my Android app. Work in a new tab and use my Google account as it
is already signed in. Do not sign out or change any account settings.

1. Open https://console.firebase.google.com.
2. If a project named "NextKin" already exists, open it. Otherwise create a project named "NextKin".
   When asked about Google Analytics, turn it off. If Firebase asks me to accept its terms, stop and
   let me tick the box myself, then continue.
3. In the project, add an Android app:
   - Android package name: com.nextkin.app (exactly this)
   - App nickname: NextKin Android
   - Leave the SHA-1 field empty.
   Register the app, download google-services.json when offered, and skip the remaining SDK steps
   ("Next" / "Continue to console"). Do not open the file or show its contents.
4. Open Project settings (the gear) → Cloud Messaging. Make sure "Firebase Cloud Messaging API (V1)"
   shows as Enabled. If it says Disabled, use its menu to open it in Google Cloud and enable it, then
   come back.
5. Open Project settings → Service accounts → "Generate new private key" → confirm. A JSON key file
   downloads. Do not open it or show its contents; it is a secret.
6. Tell me: the Firebase project ID, and the exact names of the two files that were downloaded.
```

## Step 2 · Give the Firebase file to EAS (your terminal)

From `apps/mobile`, signed in to EAS (`npx eas-cli login` if needed), with the path to the downloaded
`google-services.json`:

```bash
npx eas-cli env:create --name GOOGLE_SERVICES_JSON --type file --visibility secret --environment production --environment preview --value "C:\Users\<you>\Downloads\google-services.json"
```

`app.config.ts` reads it as `GOOGLE_SERVICES_JSON` in an EAS build. Expo Go never uses it.

## Step 3 · The SNS platform application (Claude in Chrome)

```text
Create an Amazon SNS platform application for Android push. Use my AWS console session as it is
already signed in. Do not sign out, and change nothing other than what is listed here.

1. Open https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/mobile/push-notifications
   Check that the account in the top-right menu is 962942593570 and the region is US East (N. Virginia).
   If either is different, stop and tell me.
2. If a platform application named "NextKinAndroid" already exists, open it and skip to step 4.
3. Choose "Create platform application":
   - Application name: NextKinAndroid
   - Push notification platform: Firebase Cloud Messaging (FCM)
   - Authentication: token / service account (FCM HTTP v1), and upload the Firebase service-account
     JSON key file from my Downloads folder (the one Firebase generated under "Service accounts",
     not google-services.json). Do not open it or show its contents.
   - Leave delivery status logging and the event topics off.
   Create it.
4. Tell me the platform application's ARN (it starts arn:aws:sns:us-east-1:962942593570:app/GCM/).
   The ARN is not a secret.

Do not edit IAM roles, ECS task definitions or environment variables: the deployment code sets
those from the ARN.
```

## Step 4 · Switch it on (Claude Code)

Give Claude Code the ARN. It goes into `aws/infra/cdk.json` as `"pushAndroidArn"`; a `cdk deploy`
then gives the worker `PUSH_ADAPTER=sns`, the ARN, and the SNS permissions it needs
(`aws/infra/src/services.ts`). Nothing else changes.

## Step 5 · Check it on a phone

A push needs a build from EAS made after step 2 (`preview` or `production`); Expo Go can't receive
one. Install it, sign in, allow notifications, finish a run, and put the app in the background. The
push should arrive within two minutes with the NextKin mark in the status bar, and a tap opens the
run. If it doesn't, `push_messages.outcome` and the worker log say why (see 07-push.md).

Then delete the service-account key from Downloads.

# The Luvin – urgent email security fix

## 1. Revoke the leaked Gmail App Password FIRST

The old Gmail App Password was committed to the public repository. Removing it from the latest code does **not** invalidate the leaked credential.

Google Account → Security → 2-Step Verification → App passwords → revoke/delete the old app password.

Then create a **new** App Password only after the code below is deployed.

## 2. Replace the files in this ZIP

Copy these paths into the repository, preserving the folder structure:

- `api/send-email.js`
- `services/emailService.ts`
- `.gitignore`
- `.env.example`

Do not copy any real secret into `.env.example`.

## 3. Add Vercel Environment Variables

Vercel → Project → Settings → Environment Variables.

Required:

- `EMAIL_USER`
- `EMAIL_APP_PASSWORD`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

`FIREBASE_SERVICE_ACCOUNT_JSON` should contain the full Firebase Admin service-account JSON on one line.

Alternative: instead of the JSON variable, set all three:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Optional:

- `ALLOWED_EMAIL_ORIGINS` for extra preview/custom frontend origins.

Redeploy after saving the variables.

## 4. What this patch changes

- Removes the Gmail address/App Password from source code.
- The public endpoint can no longer choose an arbitrary recipient.
- Confirmation email recipient + content are loaded from the Firestore order on the server.
- A confirmation email can only be dispatched shortly after the order was created.
- Each order/type is claimed in a Firestore transaction to prevent repeated sends.
- Thank-you/cancellation emails require a valid Firebase staff/admin ID token.
- Basic per-IP throttling is added as another abuse barrier.
- HTML fields are escaped before rendering into the email.

## 5. Important Git history cleanup

The old App Password remains visible in Git history until history is rewritten. This is less urgent once the old App Password has been revoked, but the repository should still be cleaned afterward.

At minimum, keep the old credential revoked forever. Never reuse it.

## 6. Test after deployment

1. Place one real test order with your own email.
2. Confirm exactly one order-confirmation email arrives.
3. Refresh/revisit the confirmation page and verify it does not send duplicates.
4. From Admin, use the thank-you email action and confirm it works only while logged in.
5. Check Vercel Function Logs for `/api/send-email` and make sure there are no Firebase credential/config errors.

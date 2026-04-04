# Firebase Rules Setup

## Files

- Rules file: [`database.rules.json`](C:\Users\moong\Desktop\harin\web\database.rules.json)
- Firebase config file: [`firebase.json`](C:\Users\moong\Desktop\harin\web\firebase.json)

## Where to paste/apply

### Option 1: Firebase Console

1. Firebase Console
2. Realtime Database
3. `Rules` tab
4. Replace existing rules with the contents of `database.rules.json`
5. Publish

### Option 2: Firebase CLI

At the project root:

```powershell
firebase login
firebase use --add
firebase deploy --only database
```

`firebase.json` is already prepared to point at `database.rules.json`.

## Important

These rules are intentionally strict and assume:

- Firebase Authentication is enabled
- your app ultimately writes user-owned data under `auth.uid`

Without Firebase Auth, these rules will block most dangerous writes, which is safer than leaving the database open.

## Recommended next step

Enable at least:

- Authentication: `Anonymous`

Then later, if wanted:

- Google login
- GitHub login

Anonymous auth is enough to stop “anyone can forge any userId” style abuse, because rules can key off `auth.uid`.

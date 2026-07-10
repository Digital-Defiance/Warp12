# Privacy Policy

**Last updated:** June 28, 2026

Warp 12 ("the app," "we," "us") is operated by **Digital Defiance**. This policy describes how information is handled when you use the Warp 12 website, native apps (Tauri on macOS, iOS, and Android), and related Firebase-hosted URLs at [https://warp.iwdf.org](https://warp.iwdf.org).

---

## Summary

- **Local simulation** runs entirely on your device. We do not receive gameplay data from local-only sessions.
- **Online fleet** uses Google Firebase for anonymous sign-in and real-time multiplayer sync.
- We do **not** sell personal information, run advertising, or use third-party analytics SDKs in the app.
- You choose a **display name** for online play; we do not collect email, phone, or payment information.

---

## Information we collect

### Local play (no account)

When you use **Local simulation**, game state stays in your browser or app. We do not transmit your hand, moves, or scores to our servers.

### Online fleet (Firebase)

When you use **Online fleet**, the app uses **Firebase Authentication** to create an **anonymous account** (a random user ID). We do not ask for your name, email, or password.

For multiplayer sessions we store and sync:

| Data | Purpose |
| --- | --- |
| Anonymous user ID | Identify your captain seat and enforce game security rules |
| Display name you enter | Show your name to other players in the sector lobby and at the table |
| Public game state | Table layout, scores, turn order, lobby settings, and other shared sector data |
| Your private hand | Stored in Firestore so only you (and briefly, other captains during round-end scoring) can read it |
| Coach / presence signals | Optional tactical-advisor requests visible to sector captains during active play |
| Timestamps | When sectors and hands were created or updated |

Game documents remain in Firestore until the host deletes the sector, resets the lobby, or data is removed through normal gameplay. We do not guarantee indefinite retention.

### Device storage

The app may store small preferences in your browser or app **local storage**, including:

- Sound mute preference
- Optional tile order in your hand (online or local)

This data never leaves your device unless you clear site data.

---

## How we use information

We use the information above only to:

- Operate online multiplayer (matchmaking by sector code, move sync, scoring)
- Enforce Firestore security rules and prevent unauthorized changes
- Improve stability and fix bugs when investigating reported issues

We do **not** use your data for advertising, profiling, or marketing.

---

## Third-party services

Online play relies on **Google Firebase** (Authentication, Cloud Firestore, Hosting), operated by Google LLC. Firebase processes data on our behalf according to [Google's privacy policy](https://policies.google.com/privacy) and [Firebase terms](https://firebase.google.com/terms).

When you use online fleet, your data is stored in Firebase infrastructure. We do not share game data with other third parties.

---

## What we do not collect

- Email addresses, phone numbers, or social login profiles
- Precise location or contacts
- Payment or billing information (the app is free)
- Analytics or crash-reporting SDK data (we do not initialize Firebase Analytics or Crashlytics in the client)

Standard web hosting and Firebase may log technical metadata (such as IP address, user agent, and request timestamps) for security and operations. We do not use those logs to identify individual players for marketing.

---

## Children's privacy

Warp 12 is a casual domino game intended for general audiences. We do not knowingly collect personal information from children under 13. If you believe a child has provided personal information through online play, contact us (see below) and we will take reasonable steps to delete associated sector data where feasible.

---

## Your choices

- **Local only:** Play without signing in to avoid server-side storage of gameplay.
- **Display name:** Choose any non-identifying name for online play.
- **Leave a sector:** Captains can leave a lobby; hosts can reset or delete a sector.
- **Clear device data:** Remove local preferences by clearing site or app storage in your browser or device settings.

Anonymous Firebase accounts cannot be recovered if you clear app data or use a different device; you will receive a new anonymous ID.

---

## Security

We use Firebase security rules so captains can only read and write data appropriate to their role. Private hands are restricted to the owning captain except during brief round-end scoring windows defined by the game rules.

No method of transmission or storage is completely secure. Use online fleet at your own discretion.

---

## International users

Firebase may process and store data in the United States or other countries where Google operates infrastructure. By using online fleet, you consent to this processing for the purpose of providing the service.

---

## Changes to this policy

We may update this policy from time to time. The **Last updated** date at the top will change when we do. Continued use of the app after changes constitutes acceptance of the revised policy.

---

## Contact

Questions about this privacy policy or a data request:

- Open an issue on [GitHub — Digital-Defiance/Warp12](https://github.com/Digital-Defiance/Warp12/issues)
- Or contact the maintainer through the Digital Defiance project channels listed on that repository

---

## App store note

This page is available at **https://warp.iwdf.org/privacy** for Google Play, Apple App Store, and other distribution listings that require a privacy policy URL.

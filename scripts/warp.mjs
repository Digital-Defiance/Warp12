#!/usr/bin/env node
/**
 * Warp ops CLI — quick Admin SDK commands against project warp-12.
 *
 * Usage:
 *   yarn warp ban [<uid>] --reason "…" [--ipv4 A.B.C.D] [--ipv6 …] [--days N] [--notes "…"] [--keep-auth]
 *   yarn warp unban <uid|banId> [--keep-disabled]
 *   yarn warp ban-status <uid|banId> | --ipv4 … | --ipv6 …
 *   yarn warp ban-list [--all] [--limit N]
 *   yarn warp roles <uid> [--set admin,moderator,match_official | --clear]
 *   yarn warp help
 *
 * One ban record = one subject. Pass uid and/or ipv4 and/or ipv6 together so
 * dual-stack addresses stay on the same idiot.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'functions/package.json'));
const admin = require('firebase-admin');

const PROJECT_ID = 'warp-12';
const BANS = 'bans';
const OPS_AUDIT = 'opsAudit';
const ACTOR = { uid: 'cli:warp', label: 'cli:warp' };

function usage(exitCode = 0) {
  console.log(`warp — Warp ops CLI (project ${PROJECT_ID})

Commands:
  warp ban [<uid>] --reason <text> [--ipv4 A.B.C.D] [--ipv6 addr] [--days N] [--notes <text>] [--keep-auth]
  warp unban <uid|banId> [--keep-disabled]
  warp ban-status <uid|banId>
  warp ban-status --ipv4 A.B.C.D
  warp ban-status --ipv6 addr
  warp ban-list [--all] [--limit N]
  warp roles <uid>                 Show Auth custom claims
  warp roles <uid> --set admin[,moderator][,match_official]
  warp roles <uid> --clear         Remove all roles claims
  warp help

Examples:
  yarn warp ban abc123 --reason "abuse"
  yarn warp ban abc123 --reason "abuse" --ipv4 1.2.3.4 --ipv6 2001:db8::1
  yarn warp ban --reason "vpn hop" --ipv4 1.2.3.4 --ipv6 2001:db8::1
  yarn warp unban abc123
  yarn warp ban-list
  yarn warp roles abc123 --set admin
  yarn warp roles abc123 --clear
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = [...argv];
  const flags = {};
  const positional = [];
  while (args.length) {
    const a = args.shift();
    if (a === '--reason' || a === '-r') {
      flags.reason = args.shift();
    } else if (a === '--days') {
      flags.days = Number(args.shift());
    } else if (a === '--notes') {
      flags.notes = args.shift();
    } else if (a === '--ipv4') {
      flags.ipv4 = args.shift();
    } else if (a === '--ipv6') {
      flags.ipv6 = args.shift();
    } else if (a === '--keep-auth') {
      flags.keepAuth = true;
    } else if (a === '--keep-disabled') {
      flags.keepDisabled = true;
    } else if (a === '--all') {
      flags.all = true;
    } else if (a === '--limit') {
      flags.limit = Number(args.shift());
    } else if (a === '--set') {
      flags.set = args.shift();
    } else if (a === '--clear') {
      flags.clear = true;
    } else if (a === '--help' || a === '-h') {
      flags.help = true;
    } else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      usage(1);
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function init() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  return admin.firestore();
}

function normalizeIpv4(raw) {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (isIP(s) !== 4) throw new Error(`Invalid IPv4: ${s}`);
  return s.split('.').map((o) => String(Number(o))).join('.');
}

function normalizeIpv6(raw) {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const bare = s.split('%')[0] ?? s;
  if (isIP(bare) !== 6) throw new Error(`Invalid IPv6: ${bare}`);
  return bare.toLowerCase();
}

function buildIpKeys(ipv4, ipv6) {
  const keys = [];
  if (ipv4) keys.push(`v4:${ipv4}`);
  if (ipv6) keys.push(`v6:${ipv6}`);
  return keys;
}

function ipOnlyBanId(ipv4, ipv6) {
  const parts = [];
  if (ipv4) parts.push(`v4_${ipv4.replace(/\./g, '_')}`);
  if (ipv6) parts.push(`v6_${ipv6.replace(/:/g, '_')}`);
  if (!parts.length) throw new Error('IP-only ban needs ipv4 and/or ipv6');
  return `ip:${parts.join('+')}`;
}

async function resolveUser(uid) {
  if (!uid) {
    return {
      email: null,
      displayName: null,
      providers: [],
      anonymous: true,
      exists: false,
    };
  }
  try {
    const user = await admin.auth().getUser(uid);
    const providers = user.providerData.map((p) => p.providerId);
    return {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      providers,
      anonymous: providers.length === 0,
      exists: true,
    };
  } catch {
    return {
      email: null,
      displayName: null,
      providers: [],
      anonymous: true,
      exists: false,
    };
  }
}

async function writeAudit(db, entry) {
  await db.collection(OPS_AUDIT).add({
    ...entry,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function cmdBan(uidArg, flags) {
  const reason = (flags.reason ?? '').trim();
  const uid = (uidArg ?? '').trim();
  const ipv4 = normalizeIpv4(flags.ipv4);
  const ipv6 = normalizeIpv6(flags.ipv6);
  if (!reason || (!uid && !ipv4 && !ipv6)) {
    console.error('ban requires --reason and at least one of <uid>, --ipv4, --ipv6');
    usage(1);
  }
  const db = init();
  const banId = uid || ipOnlyBanId(ipv4, ipv6);
  const snap = await resolveUser(uid);
  const disableAuth = Boolean(uid) && !flags.keepAuth && snap.exists;
  if (disableAuth) {
    await admin.auth().updateUser(uid, { disabled: true });
  }

  let expiresAt = null;
  if (flags.days != null && Number.isFinite(flags.days) && flags.days > 0) {
    expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + flags.days * 24 * 60 * 60 * 1000
    );
  }

  const existing = await db.collection(BANS).doc(banId).get();
  const prev = existing.exists ? existing.data() : null;
  const mergedIpv4 = ipv4 ?? prev?.ipv4 ?? null;
  const mergedIpv6 = ipv6 ?? prev?.ipv6 ?? null;

  const doc = {
    uid: uid || prev?.uid || '',
    banId,
    active: true,
    reason,
    bannedAt: admin.firestore.FieldValue.serverTimestamp(),
    bannedBy: ACTOR.uid,
    bannedByLabel: ACTOR.label,
    expiresAt,
    email: snap.email ?? prev?.email ?? null,
    displayName: snap.displayName ?? prev?.displayName ?? null,
    providers: snap.exists ? snap.providers : (prev?.providers ?? []),
    anonymous: snap.exists ? snap.anonymous : (prev?.anonymous ?? true),
    authDisabled: disableAuth || prev?.authDisabled === true,
    notes: flags.notes?.trim() || prev?.notes || null,
    ipv4: mergedIpv4,
    ipv6: mergedIpv6,
    ipKeys: buildIpKeys(mergedIpv4, mergedIpv6),
  };
  await db.collection(BANS).doc(banId).set(doc, { merge: true });
  await writeAudit(db, {
    action: 'ban',
    actorUid: ACTOR.uid,
    actorLabel: ACTOR.label,
    targetUid: uid || null,
    targetBanId: banId,
    detail: {
      reason,
      days: flags.days ?? null,
      authDisabled: disableAuth,
      ipv4: mergedIpv4,
      ipv6: mergedIpv6,
    },
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'ban',
        banId,
        uid: uid || null,
        ipv4: mergedIpv4,
        ipv6: mergedIpv6,
        reason,
        authDisabled: disableAuth,
      },
      null,
      2
    )
  );
}

async function cmdUnban(banId, flags) {
  if (!banId) {
    console.error('unban requires <uid|banId>');
    usage(1);
  }
  const db = init();
  const existing = await db.collection(BANS).doc(banId).get();
  const data = existing.exists ? existing.data() : null;
  const wasDisabled = data?.authDisabled === true;
  const uid = data?.uid || '';

  await db.collection(BANS).doc(banId).set(
    {
      active: false,
      unbannedAt: admin.firestore.FieldValue.serverTimestamp(),
      unbannedBy: ACTOR.uid,
      unbannedByLabel: ACTOR.label,
    },
    { merge: true }
  );

  let reenabledAuth = false;
  if (!flags.keepDisabled && wasDisabled && uid) {
    try {
      await admin.auth().updateUser(uid, { disabled: false });
      reenabledAuth = true;
    } catch (err) {
      console.error('warn: could not re-enable Auth user:', err.message);
    }
  }

  await writeAudit(db, {
    action: 'unban',
    actorUid: ACTOR.uid,
    actorLabel: ACTOR.label,
    targetUid: uid || null,
    targetBanId: banId,
    detail: { reenabledAuth },
  });

  console.log(
    JSON.stringify({ ok: true, action: 'unban', banId, reenabledAuth }, null, 2)
  );
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const ms =
    typeof expiresAt.toMillis === 'function'
      ? expiresAt.toMillis()
      : expiresAt._seconds != null
        ? expiresAt._seconds * 1000
        : null;
  return ms != null && ms <= Date.now();
}

async function cmdBanStatus(arg, flags) {
  const db = init();
  let ban = null;
  if (arg) {
    const snap = await db.collection(BANS).doc(arg).get();
    ban = snap.exists ? snap.data() : null;
  } else {
    const ipv4 = normalizeIpv4(flags.ipv4);
    const ipv6 = normalizeIpv6(flags.ipv6);
    const key = ipv4 ? `v4:${ipv4}` : ipv6 ? `v6:${ipv6}` : null;
    if (!key) {
      console.error('ban-status requires <uid|banId> or --ipv4 / --ipv6');
      usage(1);
    }
    const snap = await db
      .collection(BANS)
      .where('ipKeys', 'array-contains', key)
      .limit(1)
      .get();
    ban = snap.empty ? null : snap.docs[0].data();
  }
  const banned = Boolean(ban?.active && !isExpired(ban.expiresAt));
  console.log(JSON.stringify({ ok: true, banned, ban }, null, 2));
}

async function cmdBanList(flags) {
  const db = init();
  const limit = Math.min(Math.max(flags.limit ?? 100, 1), 500);
  const col = db.collection(BANS);
  const snap = flags.all
    ? await col.limit(limit).get()
    : await col.where('active', '==', true).limit(limit).get();
  const bans = snap.docs.map((d) => d.data());
  console.log(
    JSON.stringify(
      { ok: true, count: bans.length, activeOnly: !flags.all, bans },
      null,
      2
    )
  );
}

const ALLOWED_ROLES = new Set(['admin', 'moderator', 'match_official']);

async function cmdRoles(uid, flags) {
  if (!uid) {
    console.error('roles requires <uid>');
    usage(1);
  }
  init();
  const user = await admin.auth().getUser(uid);
  const current = user.customClaims?.roles ?? [];

  if (flags.clear) {
    await admin.auth().setCustomUserClaims(uid, { roles: [] });
    await dbAuditRoles(uid, [], 'clear');
    console.log(JSON.stringify({ ok: true, uid, roles: [] }, null, 2));
    return;
  }

  if (flags.set != null) {
    const roles = String(flags.set)
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    for (const role of roles) {
      if (!ALLOWED_ROLES.has(role)) {
        console.error(`Invalid role: ${role} (allowed: admin, moderator, match_official)`);
        process.exit(1);
      }
    }
    await admin.auth().setCustomUserClaims(uid, { roles });
    await dbAuditRoles(uid, roles, 'set');
    console.log(JSON.stringify({ ok: true, uid, roles }, null, 2));
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        uid,
        email: user.email ?? null,
        roles: current,
        claims: user.customClaims ?? null,
      },
      null,
      2
    )
  );
}

async function dbAuditRoles(uid, roles, mode) {
  const db = admin.firestore();
  await db.collection(OPS_AUDIT).add({
    action: 'roles_set',
    actorUid: ACTOR.uid,
    actorLabel: ACTOR.label,
    targetUid: uid,
    targetBanId: null,
    detail: { roles, mode },
    at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

const { flags, positional } = parseArgs(process.argv.slice(2));
const [cmd, arg1] = positional;

if (flags.help || !cmd || cmd === 'help') {
  usage(0);
}

try {
  if (cmd === 'ban') {
    await cmdBan(arg1, flags);
  } else if (cmd === 'unban') {
    await cmdUnban(arg1, flags);
  } else if (cmd === 'ban-status') {
    await cmdBanStatus(arg1, flags);
  } else if (cmd === 'ban-list') {
    await cmdBanList(flags);
  } else if (cmd === 'roles') {
    await cmdRoles(arg1, flags);
  } else {
    console.error(`Unknown command: ${cmd}`);
    usage(1);
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}

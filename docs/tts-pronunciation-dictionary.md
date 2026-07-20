# Fleet pronunciation dictionary (ElevenLabs)

Ops-managed PLS lexicon for AI officer / fleet call signs that keep their
**visible** spelling but need a TTS pronunciation. Per-sector **Spoken as**
aliases (humans + AI officers in the lobby) are separate and applied in the
client name map before `formatCommentatorLine`.

## Create / upload

1. Edit [`tools/tts/warp-fleet.pls`](../tools/tts/warp-fleet.pls) (alias tags; PLS is case-sensitive).
2. Ensure `ELEVENLABS_API_KEY` is set in `functions/.env`.
3. Run:

```bash
yarn tts:pronunciation-dictionary
```

When `ELEVENLABS_PRONUNCIATION_DICTIONARY_ID` is already set, the script
**updates that dictionary in place** (`rules.set` → new `versionId`, same id).
It only creates a new dictionary when the id is unset, or when you force it:

```bash
TTS_DICTIONARY_FORCE_CREATE=1 yarn tts:pronunciation-dictionary
```

Old dictionaries are **not** auto-purged — archive unused ones in ElevenLabs
(Studio or `PATCH` `archived: true`). Storage is not billed per dictionary;
TTS character credits are.

4. Paste the printed ids into `functions/.env` (keep the same dictionary id;
   bump the version id after each lexicon sync):

```bash
ELEVENLABS_PRONUNCIATION_DICTIONARY_ID=…
ELEVENLABS_PRONUNCIATION_DICTIONARY_VERSION_ID=…
```

5. `yarn deploy:functions`

The TTS Storage cache key includes voice, model, dictionary id, **version id**,
and speech text — so a lexicon bump does not reuse stale MP3s.

Phoneme/IPA tags need `eleven_v3` (our default) or `eleven_flash_v2`. Prefer **alias** tags when unsure.

## Where captains edit spoken-as

| Who | Where |
|-----|--------|
| Humans | Profile → **Spoken as** (snapshotted on create/join) |
| AI officers | Online lobby → **AI officers** → **Spoken as (TTS)** (host, lobby only) |
| Match disable | Lobby checkbox **Spoken-as for commentary** |
| Fleet IPA/alias | This dictionary (Ops) |

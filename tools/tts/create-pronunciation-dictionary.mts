/**
 * Sync tools/tts/warp-fleet.pls to ElevenLabs.
 *
 * Prefer update-in-place when ELEVENLABS_PRONUNCIATION_DICTIONARY_ID is set
 * (rules.set → new versionId, same dictionary id). Creates only when unset
 * or TTS_DICTIONARY_FORCE_CREATE=1.
 *
 * Requires ELEVENLABS_API_KEY in functions/.env (or the environment).
 *
 *   yarn tts:pronunciation-dictionary
 *
 * Then paste the printed ids into functions/.env and redeploy functions.
 *
 * @see https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries
 */
import { createRequire } from 'node:module';
import { createReadStream, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const requireFromRoot = createRequire(resolve(root, 'package.json'));

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(root, 'functions/.env'));
loadEnvFile(resolve(root, '.env'));

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
if (!apiKey) {
  console.error(
    'ELEVENLABS_API_KEY is required (set it in functions/.env).'
  );
  process.exit(1);
}

type AliasRule = {
  type: 'alias';
  stringToReplace: string;
  alias: string;
  caseSensitive: boolean;
  wordBoundaries: boolean;
};

type PhonemeRule = {
  type: 'phoneme';
  stringToReplace: string;
  phoneme: string;
  alphabet: string;
  caseSensitive: boolean;
  wordBoundaries: boolean;
};

type DictRule = AliasRule | PhonemeRule;

/** Minimal PLS → ElevenLabs rules (alias / phoneme lexemes). */
function rulesFromPls(plsXml: string): DictRule[] {
  const alphabetMatch = plsXml.match(/\balphabet\s*=\s*["']([^"']+)["']/i);
  const defaultAlphabet = alphabetMatch?.[1]?.trim() || 'ipa';

  const rules: DictRule[] = [];
  const lexemeRe = /<lexeme\b[^>]*>([\s\S]*?)<\/lexeme>/gi;
  for (const lexemeMatch of plsXml.matchAll(lexemeRe)) {
    const body = lexemeMatch[1] ?? '';
    const grapheme = body
      .match(/<grapheme\b[^>]*>([\s\S]*?)<\/grapheme>/i)?.[1]
      ?.replace(/<[^>]+>/g, '')
      .trim();
    if (!grapheme) {
      continue;
    }
    const alias = body
      .match(/<alias\b[^>]*>([\s\S]*?)<\/alias>/i)?.[1]
      ?.replace(/<[^>]+>/g, '')
      .trim();
    if (alias) {
      rules.push({
        type: 'alias',
        stringToReplace: grapheme,
        alias,
        caseSensitive: true,
        wordBoundaries: true,
      });
      continue;
    }
    const phoneme = body
      .match(/<phoneme\b[^>]*>([\s\S]*?)<\/phoneme>/i)?.[1]
      ?.replace(/<[^>]+>/g, '')
      .trim();
    if (phoneme) {
      rules.push({
        type: 'phoneme',
        stringToReplace: grapheme,
        phoneme,
        alphabet: defaultAlphabet,
        caseSensitive: true,
        wordBoundaries: true,
      });
    }
  }
  return rules;
}

const { ElevenLabsClient } = requireFromRoot(
  '@elevenlabs/elevenlabs-js'
) as typeof import('@elevenlabs/elevenlabs-js');

const plsPath = resolve(root, 'tools/tts/warp-fleet.pls');
const plsXml = readFileSync(plsPath, 'utf8');
const rules = rulesFromPls(plsXml);
if (rules.length === 0) {
  console.error(`No lexeme rules found in ${plsPath}`);
  process.exit(1);
}

const elevenlabs = new ElevenLabsClient({ apiKey });

const existingId = process.env.ELEVENLABS_PRONUNCIATION_DICTIONARY_ID?.trim();
const forceCreate = process.env.TTS_DICTIONARY_FORCE_CREATE === '1';

let dictionaryId: string;
let versionId: string;
let versionRulesNum: number;
let action: 'created' | 'updated';

if (existingId && !forceCreate) {
  const updated = await elevenlabs.pronunciationDictionaries.rules.set(
    existingId,
    { rules }
  );
  dictionaryId = updated.id;
  versionId = updated.versionId;
  versionRulesNum = updated.versionRulesNum;
  action = 'updated';
} else {
  const created = await elevenlabs.pronunciationDictionaries.createFromFile({
    name: 'warp-fleet',
    file: createReadStream(plsPath),
  });
  dictionaryId = created.id;
  versionId = created.versionId;
  versionRulesNum = created.versionRulesNum;
  action = 'created';
}

console.log(
  `${action === 'updated' ? 'Updated' : 'Created'} pronunciation dictionary: warp-fleet (${versionRulesNum} rules)`
);
if (forceCreate && existingId) {
  console.log(
    `(TTS_DICTIONARY_FORCE_CREATE=1 — old id ${existingId} was left in place; archive it in ElevenLabs if unused.)`
  );
}
console.log('');
console.log('Add these to functions/.env, then yarn deploy:functions:');
console.log('');
console.log(`ELEVENLABS_PRONUNCIATION_DICTIONARY_ID=${dictionaryId}`);
console.log(
  `ELEVENLABS_PRONUNCIATION_DICTIONARY_VERSION_ID=${versionId}`
);
console.log('');

const voiceId =
  process.env.ELEVENLABS_VOICE_ID?.trim() || 'aD6riP1btT197c6dACmy';
const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_v3';
const sample = 'Captain Nguyen and Captain Müller take the marks.';

if (process.env.TTS_DICTIONARY_SMOKE !== '0') {
  console.log(`Smoke synthesize (${modelId})…`);
  const without = await elevenlabs.textToSpeech.convert(voiceId, {
    modelId,
    text: `Without dictionary: ${sample}`,
    outputFormat: 'mp3_44100_128',
  });
  const withDict = await elevenlabs.textToSpeech.convert(voiceId, {
    modelId,
    text: `With dictionary: ${sample}`,
    outputFormat: 'mp3_44100_128',
    pronunciationDictionaryLocators: [
      {
        pronunciationDictionaryId: dictionaryId,
        versionId,
      },
    ],
  });
  for await (const _chunk of without) {
    void _chunk;
  }
  for await (const _chunk of withDict) {
    void _chunk;
  }
  console.log('Smoke synthesize ok (with + without dictionary).');
}

// 新しいスプレッドシートの列ヘッダーを詳しく確認
// 実行方法: node check_headers2.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || !trimmed) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const SA = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const KEY = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
const SSID = '1NUne0nh08Khm6uBEpEap3wDIME-O_cgqMUmbL9rhNKM';

function b64(buf) { return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }

async function getToken() {
  const now = Math.floor(Date.now()/1000);
  const h = JSON.stringify({alg:'RS256',typ:'JWT'});
  const p = JSON.stringify({iss:SA,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',exp:now+3600,iat:now});
  const u = `${b64(Buffer.from(h))}.${b64(Buffer.from(p))}`;
  const s = crypto.createSign('RSA-SHA256'); s.update(u);
  const jwt = `${u}.${b64(s.sign(crypto.createPrivateKey(KEY)))}`;
  const r = await (await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`})).json();
  if (!r.access_token) throw new Error(JSON.stringify(r));
  return r.access_token;
}

async function getRow(token, sheet, row='1') {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SSID}/values/${encodeURIComponent(sheet)}!A${row}:Z${row}`;
  const r = await (await fetch(url,{headers:{Authorization:`Bearer ${token}`}})).json();
  if (r.error) return {error: r.error.message};
  return r.values?.[0] || [];
}

async function main() {
  const token = await getToken();
  console.log('AUTH OK\n');

  const sheets = ['ユニット管理','ユニットマスタ','ユニット別光熱費','食数計算','還元金明細','繰越金'];
  for (const s of sheets) {
    const h = await getRow(token, s);
    if (h.error) { console.log(`[${s}] ERROR: ${h.error}`); continue; }
    console.log(`<<<シート: ${s} (${h.length}列)>>>`);
    h.forEach((col, i) => console.log(`  列${String(i+1).padStart(2,'0')}: ${col}`));
    console.log();
  }
}

main().catch(e => console.error(e.message));

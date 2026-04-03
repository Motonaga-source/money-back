// ES Module for fetching Google Sheets API data
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
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  env[key] = val;
}

const PUBLIC_SPREADSHEET_ID = env.SPREADSHEET_ID || '1NUne0nh08Khm6uBEpEap3wDIME-O_cgqMUmbL9rhNKM'; 
// Use env or fallback to the new test sheet.
// ユーザの設定は env.SPREADSHEET_ID を見ているはず。
const SPREADSHEET_ID = env.SPREADSHEET_ID;

const GOOGLE_SERVICE_ACCOUNT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = JSON.stringify({ alg: 'RS256', typ: 'JWT' });
  const payload = JSON.stringify({
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  });

  const unsignedToken = `${base64url(Buffer.from(header))}.${base64url(Buffer.from(payload))}`;
  const privateKey = crypto.createPrivateKey(GOOGLE_PRIVATE_KEY);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(privateKey);
  const jwt = `${unsignedToken}.${base64url(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

function parseNumber(value, fieldName) {
  if (!value || value === '') return 0;
  let cleanValue = String(value).trim().replace(/,/g, '').replace(/¥/g, '').replace(/円/g, '').replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

async function main() {
  try {
    const token = await getAccessToken();

    const fetchSheet = async (range) => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      return data.values || [];
    };

    console.log('Fetching sheets...');
    const utilityData = await fetchSheet('ユニット別光熱費!A:G');
    const unitData = await fetchSheet('ユニットマスタ!A:C');
    
    console.log('\\n--- ユニット別光熱費 ---');
    console.log(utilityData.slice(0, 5));

    console.log('\\n--- ユニットマスタ ---');
    console.log(unitData.slice(0, 5));

    // Also let's check parsing sum of Uribayashi-Nishi
    if (utilityData.length > 1) {
       const uH = {};
       utilityData[0].forEach((v, i) => { uH[v.trim()] = i; });
       const uParsed = utilityData.slice(1).map(r => ({
          年月: r[uH['年月'] ?? 0],
          ユニット名: r[uH['ユニット名'] ?? 1],
          合計: parseNumber(r[uH['合計'] ?? 6])
       }));
       const uNishi = uParsed.filter(u => u.ユニット名 && u.ユニット名.includes('瓜破西'));
       console.log('\\n--- 瓜破西 光熱費 合計 ---');
       console.log(uNishi);
    }
    
    // Also fetch UnitManagement to see the user count
    const unitMgmtData = await fetchSheet('ユニット管理!A:T');
    if(unitMgmtData.length > 1) {
       const headers = unitMgmtData[0];
       const h = {};
       headers.forEach((v, i) => h[v.trim()] = i);
       // h['所属ユニット'], h['ステータス']
       const unitCol = h['所属ユニット'] ?? h['ユニット名'] ?? 3;
       const parsed = unitMgmtData.slice(1).map(r => ({
          年月: r[h['年月'] ?? 0], 
          ユニット: r[unitCol],
          ステータス: r[h['ステータス'] ?? 18] || ''
       }));
       
       const group = {};
       parsed.forEach(p => {
          if (!p.ユニット || !p.年月) return;
          const status = p.ステータス.replace(/[\\s\\u3000]/g, '');
          const key = `${p.年月}_${p.ユニット}`;
          if (!group[key]) group[key] = { count: 0, raw: [] };
          group[key].raw.push(p.ステータス);
          if (!status.includes('退去')) {
             group[key].count++;
          }
       });
       
       console.log('\\n--- ユニット人数 (退去除く) ---');
       Object.entries(group).forEach(([k, v]) => {
           if (k.includes('瓜破西')) {
               console.log(k, '人数:', v.count, '内訳:', v.raw);
           }
       });
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

main();

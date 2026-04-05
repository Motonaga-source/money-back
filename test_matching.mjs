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
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  env[key] = val;
}
const SPREADSHEET_ID = env.SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const jwt = `${base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))}.${base64url(Buffer.from(JSON.stringify({ iss: GOOGLE_SERVICE_ACCOUNT_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })))}`;
  const sign = crypto.createSign('RSA-SHA256'); sign.update(jwt);
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}.${base64url(sign.sign(crypto.createPrivateKey(GOOGLE_PRIVATE_KEY)))}`,
  });
  return (await tokenRes.json()).access_token;
}

async function main() {
  try {
    const token = await getAccessToken();
    const fetchSheet = async (range) => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
      return (await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).json()).values || [];
    };
    const cData = await fetchSheet('繰越金!A:E');
    // For refund data since we don't know if it's there, let's also fetch UnitManagement since that is the source of user list
    const rData = await fetchSheet('ユニット管理!A:H'); 
    
    // Parse Carryover
    const carryovers = [];
    if(cData.length > 1) {
      const h = {}; cData[0].forEach((v, i) => h[v.trim()] = i);
      cData.slice(1).forEach(r => {
        carryovers.push({ id: r[h['利用者ID'] ?? 0], name: r[h['氏名'] ?? 1], p_c: r[h['前年度繰越金'] ?? 3] });
      });
    }
    
    // Parse Refund/Mgmt
    const users = [];
    if(rData.length > 1) {
      const h = {}; rData[0].forEach((v, i) => h[v.trim()] = i);
      rData.slice(1).forEach(r => {
        // IDs are usually around column 1, Names column 2
        users.push({ id: r[h['利用者ID'] ?? 1], name: r[h['氏名'] ?? 2] });
      });
    }
    
    let failureCount = 0;
    // Just verify the first 50 users uniquely
    const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values()).slice(0, 50);
    console.log(`Checking ${uniqueUsers.length} unique users from management against carryovers...`);
    
    uniqueUsers.forEach(ref => {
      let match = carryovers.find(c => String(c.id).trim() === String(ref.id).trim());
      if(!match) {
         match = carryovers.find(c => String(c.name).trim() === String(ref.name).trim());
         if(match) {
             console.log(`Matched by name ONLY. MgmtID="${ref.id}" CarID="${match.id}", Name="${ref.name}"`);
         } else {
             // Fallback: trim all spaces
             const normalizeName = (s) => String(s).replace(/\s|　/g, '');
             match = carryovers.find(c => normalizeName(c.name) === normalizeName(ref.name));
             if (match) {
                 console.log(`Matched by name w/ stripped spaces. MgmtName="${ref.name}" CarName="${match.name}"`);
             } else {
                 console.log(`Failed totally: MgmtID="${ref.id}", Name="${ref.name}"`);
                 failureCount++;
             }
         }
      }
    });
    console.log("Total failures:", failureCount);
    
  } catch(e) { console.error(e); }
}
main();

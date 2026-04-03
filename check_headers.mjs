// 新しいスプレッドシートの列ヘッダーを確認するスクリプト
// 実行方法: node check_headers.mjs

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

const GOOGLE_SERVICE_ACCOUNT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
const NEW_SPREADSHEET_ID = '1NUne0nh08Khm6uBEpEap3wDIME-O_cgqMUmbL9rhNKM';

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
  const unsigned = `${base64url(Buffer.from(header))}.${base64url(Buffer.from(payload))}`;
  const key = crypto.createPrivateKey(GOOGLE_PRIVATE_KEY);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const jwt = `${unsigned}.${base64url(sign.sign(key))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(JSON.stringify(data));
  return data.access_token;
}

async function readFirstRow(token, sheetName, range = 'A1:Z1') {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!${range}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (data.error) return { error: data.error.message };
  return data.values?.[0] || [];
}

const EXPECTED_HEADERS = {
  'ユニット管理': ['年月', '利用者ID', '氏名', '所属ユニット', '月額預り金', '家賃', '家賃補助', '日用品費', '修繕積立金', '朝食費', '昼食費', '夕食費', '行事食', '共益費', '金銭管理費', '火災保険', '食材費', 'ステータス', '備考'],
  'ユニットマスタ': ['ユニット名', '家賃', '光熱費按分率'],
  'ユニット別光熱費': ['年月', 'ユニット名', '電気代', 'ガス代', '水道代', 'サブ', '合計'],
  '食数計算': ['月', '利用者ID', '氏名', 'ユニット名', '朝食', '昼食', '夕食', '行事食', '備考'],
  '還元金明細': ['年月', '利用者ID', '氏名', '所属ユニット', '月額預り金', '家賃', '家賃補助', '共益費', '日用品', '修繕積立', '食費合計', '光熱費', '金銭管理費', '火災保険', '食材費', '繰越金', '当月還元金合計'],
  '繰越金': ['利用者ID', '氏名', '前年度繰越金', '繰越金'],
};

async function main() {
  const token = await getAccessToken();
  console.log('✅ 認証成功\n');

  for (const [sheetName, expected] of Object.entries(EXPECTED_HEADERS)) {
    const actual = await readFirstRow(token, sheetName);
    if (actual.error) {
      console.log(`❌ ${sheetName}: エラー - ${actual.error}`);
      continue;
    }
    console.log(`\n📋 シート: ${sheetName}`);
    console.log(`   実際のヘッダー: [${actual.map(h => `"${h}"`).join(', ')}]`);
    
    const mismatches = [];
    for (let i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        mismatches.push(`  列${i+1}: 期待="${expected[i]}" / 実際="${actual[i] || '(なし)'}"`);
      }
    }
    if (actual.length > expected.length) {
      mismatches.push(`  列数: 期待=${expected.length}, 実際=${actual.length} (追加列あり: ${actual.slice(expected.length).map(h => `"${h}"`).join(', ')})`);
    }
    if (mismatches.length === 0) {
      console.log(`   ✅ ヘッダー一致`);
    } else {
      console.log(`   ⚠️  ヘッダー不一致:`);
      mismatches.forEach(m => console.log(m));
    }
  }
}

main().catch(err => console.error('❌ エラー:', err.message));

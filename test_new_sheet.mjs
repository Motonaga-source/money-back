// 新しいスプレッドシートの接続テスト (ESM形式)
// 実行方法: node test_new_sheet.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .envを読む
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

const GOOGLE_SERVICE_ACCOUNT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
const NEW_SPREADSHEET_ID = '1NUne0nh08Khm6uBEpEap3wDIME-O_cgqMUmbL9rhNKM';

console.log('📧 Service Account:', GOOGLE_SERVICE_ACCOUNT_EMAIL);
console.log('📊 Testing Spreadsheet ID:', NEW_SPREADSHEET_ID);

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

async function main() {
  try {
    console.log('\n🔑 アクセストークン取得中...');
    const token = await getAccessToken();
    console.log('✅ アクセストークン取得成功');

    // スプレッドシートのメタデータ（シート一覧）を取得
    console.log('\n📋 スプレッドシートのシート一覧を取得中...');
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${NEW_SPREADSHEET_ID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const meta = await metaRes.json();

    if (meta.error) {
      console.error('\n❌ エラー:', JSON.stringify(meta.error, null, 2));
      console.log('\n🔴 考えられる原因:');
      console.log(`  1. サービスアカウント (${GOOGLE_SERVICE_ACCOUNT_EMAIL}) にこのスプレッドシートへのアクセス権限がありません`);
      console.log('     → スプレッドシートを開き、「共有」ボタンから上記メールアドレスに閲覧/編集権限を付与してください');
      console.log('  2. スプレッドシートIDが間違っている可能性があります');
      return;
    }

    console.log('✅ スプレッドシートタイトル:', meta.properties?.title);
    console.log('\n📑 存在するシート一覧:');
    const sheets = meta.sheets || [];
    sheets.forEach((s, i) => {
      console.log(`  ${i + 1}. "${s.properties?.title}"`);
    });

    // 期待するシート名と照合
    const expectedSheets = ['ユニット管理', 'ユニットマスタ', 'ユニット別光熱費', '食数計算', '還元金明細', '繰越金'];
    console.log('\n🔍 期待するシート名との照合結果:');
    let allFound = true;
    for (const expected of expectedSheets) {
      const found = sheets.find(s => s.properties?.title === expected);
      if (found) {
        console.log(`  ✅ "${expected}" → OK`);
      } else {
        console.log(`  ❌ "${expected}" → 存在しません！`);
        allFound = false;
      }
    }

    if (!allFound) {
      console.log('\n⚠️  シート名が一致しないものがあります。');
      console.log('上記の「存在するシート一覧」と比較して、schemas.ts の SHEET_CONFIGS を修正する必要があります。');
    } else {
      console.log('\n✅ すべてのシートが存在します！');
    }

  } catch (err) {
    console.error('❌ 予期しないエラー:', err.message);
  }
}

main();

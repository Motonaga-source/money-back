
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
// These keys would normally come from .env in a real app
const SERVICE_ACCOUNT_EMAIL = 'hiroaki@vihara21.iam.gserviceaccount.com';
const PRIVATE_KEY_RAW = process.env.GOOGLE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCJNeIGTS2RPXgs
jbLfwF2x1PmifEygY4fyVeq76NRG30o2ITTTYe8tIUMqVaWT8GBCdoXOwaiQifm/
A2qeb3sDz50ZEX1Dij0Vfvfw/Jle2Gyr03G+3QlN2b6wC8zaLGXTGVn/sU/l3428
GMZhR0dhn43jTZee41ZB5KO3Q2tSWXupgnm2HbTJdBtvv0VS+BIiitoY57LWivNL
smwczFoTAGfJcBTe6Lq7kbCPAPgubnjChDp60ELRCzPGjCeXWRvJgQInSt2pH/p3
bJ+mBl5Y6tvaVy4H2139G7A0dITc5IlkmGxuyxMG3gUD1I2QSa6Wa9KLlnTIbL/f
AWaQOJcbAgMBAAECggEAA5lsFZyRApuEBgMs5eK0HStIOyNwl8/Ulp5QsIo3MKlr
LHKq4eqn7V1PLOf0lntlQwkR5y5m/2z8e1lvGBCLlQ+CqvrYTYfC+h02YCt4KH1G
kyv88rP1/6/5E8F+J7D8y3tW7uFWBmKFY3bw6Udcj3/cfHx3auhtcFVmQrNG4vDt
Jf3mglZQ/qo0geOuIkBQ0eOHfpD2ZzRZzge6AVaq1aa7Tc5e4aZYD+EdH7AEGEAm
wYqGSxSAjQK7Cs9mLqcatWTLxwVnrYiN5imQjT2jMVdSTxbwGcgzq4QXM+O8cgFr
ahIw9EEoSS625VmRay7VPriCKv7mGLAxG1dG9IpcjQKBgQC9cQHA7akeVG1vLSc5
rLstxlRNqkBvxmy1kskM6v4A0FMn4uof9sigfGtFdTRhUVSZmY0Sy6EJ3KX3S21P
jtZE8oHnh+PuT3QNmoj4lag1tP7N9ZX5kDy6LQolwdZB4x1rSh8F4hJlGvvlm61e
GlulCGr/xYJM3FkghYpoyOBRDwKBgQC5awzexOhXEv03YIWHFKMIg8VeukfqNrKN
rfZMABgh3k1PG8HXBcZA+r/rKucnBJM1AJ5uAOqhVpWGTyBiPPvZRbW9mzrzxu+9
GupYsS/CMaHM9R9vrPVpW7TpVKv2ByzI9BbrCZcRyftG1VvPRwkZlEtLah4FFthc
u4OawZ1BNQKBgAm60iI8kqESKQS6xvb5Xiu9sfrDMcgL4u14eocFUsJr8LltuCSo
IinL+h55JJWS/ctdzZcXik/dW1DWOOkLJwongnCH1DcbMZS5SSurVBZeE3A0mt1U
gSn2wjyqNfzwU0R9bBZ7RAKZXjKuyjq5E9foFMbKOCUGdDVtZmx3VL4VAoGBAJpW
2We1UBDq5Yvq9Dr0mqDDzs6DEMmMriPw4ktw6KWIfaGT4U4yqEv+bTI7jB2WWVKN
KVM3wBZ8FAqwYqxjRuAcfqNNS00QEw6+EMOy+aYT2jLY90nmFoGUrIpsyJcKceT0
CP+sA+vyzQ6xGrL21kRMhEBKHKLv2TmXfHydHWDhAoGBAKt+SB7QZHgaZT4GTRdX
44cr1iwCodQgGNURY2Mzf/foHJIVJo+Hil2GmC3CF6gSsDBNPBYN2p31y5tgD8vv
V2f1Nkx8y0Z629Qjq0hcGOSPskhfoAI5jvyxuj6qc+S2Q0bp78Osxq4pvIlUr4K9
rWQo8MaQpcPxobiXD4JNrgKL
-----END PRIVATE KEY-----`;
const SPREADSHEET_ID = '1ivn7v7axdZsj8LwpzWHcUl0xeaOutYCzkpykDTsrtgY';

// --- Authentication Logic ---
async function getAccessToken() {
    const pem = PRIVATE_KEY_RAW.replace(/\\n/g, '\n');

    // Create JWT Header and Payload
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: SERVICE_ACCOUNT_EMAIL,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    };

    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const unsignedToken = `${encode(header)}.${encode(payload)}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedToken);
    const signature = signer.sign(pem, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const jwt = `${unsignedToken}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    if (!res.ok) throw new Error(await res.text());
    return (await res.json()).access_token;
}

async function readSheet(token, range) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()).values;
}

// --- Data Fetching & Calculation ---

function parseUserMaster(rows) {
    // Expecting headers on row 0
    if (!rows || rows.length < 2) return [];
    // A: 利用者ID, B: 氏名, C: 月額預り金, D: 家賃補助, ...
    // Check indexes based on columns A-M
    // 0: ID, 1: Name, 2: Deposit, 3: RentSubsidy?
    return rows.slice(1).map(r => ({
        利用者ID: r[0],
        氏名: r[1],
        月額預り金: Number(r[2] || 0),
        家賃補助: Number(r[3] || 0),
        日用品費: Number(r[4] || 0),
        修繕積立金: Number(r[5] || 0),
        朝食費: Number(r[6] || 0),
        昼食費: Number(r[7] || 0),
        夕食費: Number(r[8] || 0),
        行事食: Number(r[9] || 0),
        金銭管理費: Number(r[10] || 0),
        火災保険: Number(r[11] || 0),
        備考: r[12]
    }));
}

function parseUnitMaster(rows) {
    if (!rows || rows.length < 2) return [];
    return rows.slice(1).map(r => ({
        ユニット名: r[0],
        家賃: Number(r[1] || 0),
        光熱費按分率: Number(r[2] || 0)
    }));
}

function parseUnitManagement(rows) {
    if (!rows || rows.length < 2) return [];
    return rows.slice(1).map(r => ({
        年月: r[0],
        利用者ID: r[1],
        氏名: r[2],
        所属ユニット: r[3],
        ステータス: r[4]
    }));
}

async function main() {
    try {
        console.log('Fetching access token...');
        const token = await getAccessToken();
        console.log('Token received.');

        console.log('Reading sheets...');
        const [userMasterRaw, unitMasterRaw, unitMgmtRaw] = await Promise.all([
            readSheet(token, '利用者マスタ!A:M'),
            readSheet(token, 'ユニットマスタ!A:C'),
            readSheet(token, 'ユニット管理!A:E')
        ]);

        const users = parseUserMaster(userMasterRaw);
        const units = parseUnitMaster(unitMasterRaw);
        const mgmt = parseUnitManagement(unitMgmtRaw);

        console.log(`Loaded ${users.length} users, ${units.length} units, ${mgmt.length} management records.`);

        // Debug First User
        const firstUser = users[0];
        if (firstUser) {
            console.log('\n--- FIRST USER DATA ---');
            console.log(firstUser);
        }

        // Debug First Unit
        const firstUnit = units[0];
        if (firstUnit) {
            console.log('\n--- FIRST UNIT DATA ---');
            console.log(firstUnit);
        }

        // Find a record to simulate calculation
        // Let's pick the last management record as it's likely recent
        const targetMgmt = mgmt[mgmt.length - 1];
        if (!targetMgmt) {
            console.log('No management records found.');
            return;
        }

        console.log('\n--- SAMPLE CALCULATION ---');
        console.log(`Target: ${targetMgmt.年月} - ${targetMgmt.氏名} (${targetMgmt.所属ユニット})`);

        const user = users.find(u => u.利用者ID === targetMgmt.利用者ID);
        const unit = units.find(u => u.ユニット名 === targetMgmt.所属ユニット);

        if (!user || !unit) {
            console.log('Missing user or unit data for simulation.');
            return;
        }

        console.log('User Data:', user);
        console.log('Unit Data:', unit);

        // Current Logic in RefundCalculator.tsx:
        // const 当月還元金合計 = 月額預り金 - 家賃補助 - 日用品 - 修繕積立 - 食費合計 - 光熱費 - 金銭管理費 - 火災保険;
        // Uses user.家賃補助 as expense.

        const deposit = user.月額預り金;
        const currentRentExpense = user.家賃補助; // This is the suspicious part
        const unitRent = unit.家賃;

        console.log(`\nValues:`);
        console.log(`Deposit (月額預り金): ${deposit}`);
        console.log(`User.RentSubsidy (家賃補助) [Used as Expense currently]: ${currentRentExpense}`);
        console.log(`Unit.Rent (家賃) [Not used]: ${unitRent}`);

        const currentRefundBeforeOtherExpenses = deposit - currentRentExpense;
        console.log(`Partial Refund (Deposit - User.RentSubsidy): ${currentRefundBeforeOtherExpenses}`);

        const hypothetialRefundWithUnitRent = deposit - unitRent;
        console.log(`Hypothetical Partial Refund (Deposit - Unit.Rent): ${hypothetialRefundWithUnitRent}`);

        const hypothetialRefundWithSubsidyLogic = deposit - (unitRent - user.家賃補助);
        console.log(`Hypothetical Partial Refund (Deposit - (Unit.Rent - User.RentSubsidy)): ${hypothetialRefundWithSubsidyLogic}`);

    } catch (e) {
        console.error('Error:', e);
    }
}

main();

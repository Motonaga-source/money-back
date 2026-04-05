import {
  UnitManagement,
  UnitMaster,
  UnitUtilityCost,
  MealCount,
  RefundDetail,
  CarryoverBalance,
  SHEET_CONFIGS,
} from '../types/schemas';

// Cloudflare Pages Functions endpoint
const API_URL = '/api/sheets';

function parseNumber(value: string | undefined, fieldName?: string): number {
  if (!value || value === '') {
    return 0;
  }

  let cleanValue = String(value).trim();
  
  // 全角数字を半角数字に変換
  cleanValue = cleanValue.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

  // 数字、ピリオド、マイナス以外のすべての文字（¥, \, ￥, 円, カンマ, スペースなど）を削除
  cleanValue = cleanValue.replace(/[^0-9.-]/g, '');

  if (cleanValue === '' || cleanValue === '-') {
    return 0;
  }

  const parsed = parseFloat(cleanValue);

  if (isNaN(parsed)) {
    if (fieldName && value) {
      console.warn(`Failed to parse number for ${fieldName}: "${value}" -> NaN`);
    }
    return 0;
  }

  return parsed;
}

function parseString(value: string | undefined): string {
  return value ? String(value).trim() : '';
}

export async function fetchSheetData(
  _spreadsheetId: string, // Not used - configured in Cloudflare environment
  sheetName: string,
  range: string
): Promise<string[][]> {
  const timestamp = Date.now();
  const url = `${API_URL}?sheetName=${encodeURIComponent(sheetName)}&range=${encodeURIComponent(
    range
  )}&spreadsheetId=${encodeURIComponent(_spreadsheetId)}&t=${timestamp}`;

  console.log(`📖 Fetching sheet: ${sheetName}, URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable browser caching
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (contentType?.includes('application/json')) {
        const error = await response.json();
        console.error(`❌ Error fetching ${sheetName}:`, error);
        errorMessage = error.error || error.message || errorMessage;
      } else {
        const text = await response.text();
        console.error(`❌ Non-JSON error response for ${sheetName}:`, text.substring(0, 200));
        errorMessage = `Server returned HTML instead of JSON. This usually means the API endpoint is not configured correctly.`;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log(`✅ Data received for ${sheetName}:`, result.data?.length, 'rows');
    return result.data;
  } catch (error) {
    console.error(`❌ Failed to fetch ${sheetName}:`, error);
    throw error;
  }
}

export async function fetchUnitManagement(spreadsheetId: string): Promise<UnitManagement[]> {
  const config = SHEET_CONFIGS.unitManagement;
  const rows = await fetchSheetData(spreadsheetId, config.name, config.range);

  if (rows.length <= 1) return [];

  console.log('Raw UnitManagement headers:', rows[0]);

  // Build a header-to-index map for robustness
  const headers = rows[0];
  const h: Record<string, number> = {};
  headers.forEach((v, i) => { h[v.trim()] = i; });

  // Support both 所属ユニット (old) and ユニット名 (new) for unit column
  const unitCol = h['所属ユニット'] ?? h['ユニット名'] ?? 3;

  const data = rows.slice(1).map((row, index) => {
    const parsed: UnitManagement = {
      年月: parseString(row[h['年月'] ?? 0]),
      利用者ID: parseString(row[h['利用者ID'] ?? 1]),
      氏名: parseString(row[h['氏名'] ?? 2]),
      所属ユニット: parseString(row[unitCol]),
      月額預り金: parseNumber(row[h['月額預り金'] ?? 4], '月額預り金'),
      家賃: parseNumber(row[h['家賃'] ?? 5], '家賃'),
      家賃補助: parseNumber(row[h['家賃補助'] ?? 6], '家賃補助'),
      日用品費: parseNumber(row[h['日用品費'] ?? 7], '日用品費'),
      修繕積立金: parseNumber(row[h['修繕積立金'] ?? 8], '修繕積立金'),
      朝食費: parseNumber(row[h['朝食費'] ?? 9], '朝食費'),
      昼食費: parseNumber(row[h['昼食費'] ?? 10], '昼食費'),
      夕食費: parseNumber(row[h['夕食費'] ?? 11], '夕食費'),
      行事食: parseNumber(row[h['行事食'] ?? 12], '行事食'),
      共益費: parseNumber(row[h['共益費'] ?? 13], '共益費'),
      金銭管理費: parseNumber(row[h['金銭管理費'] ?? 14], '金銭管理費'),
      火災保険: parseNumber(row[h['火災保険'] ?? 15], '火災保険'),
      食材費: parseNumber(row[h['食材費'] ?? 16], '食材費'),
      // Handle swapped 備考/ステータス order between old/new sheets
      備考: parseString(row[h['備考'] ?? 17]),
      ステータス: parseString(row[h['ステータス'] ?? 18]),
    };

    if (index === 0) {
      console.log('First UnitManagement parsed:', parsed);
    }
    return parsed;
  });

  console.log('Parsed UnitManagement data:', data.length, 'records');
  return data;
}

export async function fetchUnitMaster(spreadsheetId: string): Promise<UnitMaster[]> {
  const config = SHEET_CONFIGS.unitMaster;
  const rows = await fetchSheetData(spreadsheetId, config.name, config.range);

  if (rows.length <= 1) return [];

  console.log('Raw UnitMaster rows (first 2):', rows.slice(0, 2));

  const headers = rows[0];
  const h: Record<string, number> = {};
  headers.forEach((v, i) => { h[v.trim()] = i; });

  const data = rows.slice(1).map((row, index) => {
    const parsed = {
      ユニット名: parseString(row[h['ユニット名'] ?? 0]),
      家賃: parseNumber(row[h['家賃'] ?? 1], '家賃'),
      光熱費按分率: parseNumber(row[h['光熱費按分率'] ?? 2], '光熱費按分率'),
    };

    if (index === 0) {
      console.log('First unit parsed:', parsed);
    }

    return parsed;
  });

  console.log('Parsed UnitMaster data:', data.length, 'units');
  return data;
}

export async function fetchUnitUtilityCost(spreadsheetId: string): Promise<UnitUtilityCost[]> {
  const config = SHEET_CONFIGS.unitUtilityCost;
  const rows = await fetchSheetData(spreadsheetId, config.name, config.range);

  if (rows.length <= 1) return [];

  console.log('Raw UnitUtilityCost rows (first 2):', rows.slice(0, 2));

  const headers = rows[0];
  const h: Record<string, number> = {};
  headers.forEach((v, i) => { h[v.trim()] = i; });

  const data = rows.slice(1).map((row, index) => {
    const parsed = {
      年月: parseString(row[h['年月'] ?? 0]),
      ユニット名: parseString(row[h['ユニット名'] ?? 1]),
      電気代: parseNumber(row[h['電気代'] ?? 2], '電気代'),
      ガス代: parseNumber(row[h['ガス代'] ?? 3], 'ガス代'),
      水道代: parseNumber(row[h['水道代'] ?? 4], '水道代'),
      サブ: parseNumber(row[h['サブ'] ?? 5], 'サブ'),
      合計: parseNumber(row[h['合計'] ?? 6], '合計'),
    };

    if (index === 0) {
      console.log('First utility cost parsed:', parsed);
    }

    return parsed;
  });

  console.log('Parsed UnitUtilityCost data:', data.length, 'records');
  return data;
}

export async function fetchMealCount(spreadsheetId: string): Promise<MealCount[]> {
  const config = SHEET_CONFIGS.mealCount;
  const rows = await fetchSheetData(spreadsheetId, config.name, config.range);

  if (rows.length <= 1) return [];

  console.log('Raw MealCount headers:', rows[0]);

  // Build header-to-index map to support both old (月) and new (年月) column names
  const mealHeaders = rows[0];
  const h: Record<string, number> = {};
  mealHeaders.forEach((v, i) => { h[v.trim()] = i; });

  const data = rows.slice(1).map((row, index) => {
    const rawId = parseString(row[h['利用者ID'] ?? 1]);
    const rawName = parseString(row[h['氏名'] ?? 2]);
    const monthCol = h['月'] ?? h['年月'] ?? 0;

    const parsed: MealCount = {
      月: parseString(row[monthCol]),
      利用者ID: rawId,
      氏名: rawName,
      ユニット名: parseString(row[h['ユニット名'] ?? 3]),
      朝食: parseNumber(row[h['朝食'] ?? 4], '朝食'),
      昼食: parseNumber(row[h['昼食'] ?? 5], '昼食'),
      夕食: parseNumber(row[h['夕食'] ?? 6], '夕食'),
      行事食: parseNumber(row[h['行事食'] ?? 7], '行事食'),
      備考: parseString(row[h['備考'] ?? 8]),
    };

    if (index === 0) {
      console.log('First meal count parsed:', parsed);
    }
    return parsed;
  });

  console.log('Parsed MealCount data:', data.length, 'records');
  return data;
}

export async function fetchRefundDetail(spreadsheetId: string): Promise<RefundDetail[]> {
  const config = SHEET_CONFIGS.refundDetail;
  const rows = await fetchSheetData(spreadsheetId, config.name, config.range);

  if (rows.length <= 1) return [];

  console.log('Raw RefundDetail headers:', rows[0]);

  // Build header-to-index map to support both old (17-col) and new (14-col) formats
  const headers = rows[0];
  const h: Record<string, number> = {};
  headers.forEach((v, i) => { h[v.trim()] = i; });

  // 光熱費 or 光熱費実費 both accepted
  const lightCol = h['光熱費'] ?? h['光熱費実費'] ?? -1;
  // 修繕積立 or 修繕積立金 both accepted
  const repairCol = h['修繕積立'] ?? h['修繕積立金'] ?? -1;

  const data = rows.slice(1).map((row, index) => {
    const parsed: RefundDetail = {
      年月: parseString(row[h['年月'] ?? 0]),
      利用者ID: parseString(row[h['利用者ID'] ?? 1]),
      氏名: parseString(row[h['氏名'] ?? 2]),
      所属ユニット: parseString(row[h['所属ユニット'] ?? 3]),
      月額預り金: parseNumber(row[h['月額預り金'] ?? 4], '月額預り金'),
      家賃: parseNumber(row[h['家賃'] ?? 5], '家賃'),
      家賃補助: parseNumber(h['家賃補助'] !== undefined ? row[h['家賃補助']] : undefined, '家賃補助'),
      共益費: parseNumber(h['共益費'] !== undefined ? row[h['共益費']] : undefined, '共益費'),
      日用品: parseNumber(row[h['日用品'] ?? h['日用品費'] ?? -1], '日用品'),
      修繕積立: parseNumber(repairCol >= 0 ? row[repairCol] : undefined, '修繕積立'),
      食費合計: parseNumber(row[h['食費合計'] ?? -1], '食費合計'),
      光熱費: parseNumber(lightCol >= 0 ? row[lightCol] : undefined, '光熱費'),
      金銭管理費: parseNumber(row[h['金銭管理費'] ?? -1], '金銭管理費'),
      火災保険: parseNumber(row[h['火災保険'] ?? -1], '火災保険'),
      食材費: parseNumber(h['食材費'] !== undefined ? row[h['食材費']] : undefined, '食材費'),
      繰越金: parseNumber(row[h['繰越金'] ?? -1], '繰越金'),
      当月還元金合計: parseNumber(row[h['当月還元金合計'] ?? -1], '当月還元金合計'),
    };

    if (index === 0) {
      console.log('First refund detail parsed:', parsed);
    }
    return parsed;
  });

  console.log('Parsed RefundDetail data:', data.length, 'records');
  return data;
}

export async function fetchCarryoverBalances(spreadsheetId: string): Promise<CarryoverBalance[]> {
  const config = SHEET_CONFIGS.carryoverBalance;
  const rows = await fetchSheetData(spreadsheetId, config.name, config.range);

  if (rows.length <= 1) return [];

  console.log('Raw CarryoverBalance headers:', rows[0]);

  // Build header-to-index map to support both old (4-col) and new (5-col with ユニット名) formats
  const headers = rows[0];
  const h: Record<string, number> = {};
  headers.forEach((v, i) => { h[v.trim()] = i; });

  const data = rows.slice(1).map((row, index) => {
    const parsed: CarryoverBalance = {
      利用者ID: parseString(row[h['利用者ID'] ?? 0]),
      氏名: parseString(row[h['氏名'] ?? 1]),
      前年度繰越金: parseNumber(row[h['前年度繰越金'] ?? 3], '前年度繰越金'),
      繰越金: parseNumber(row[h['繰越金'] ?? 4], '繰越金'),
    };

    if (index === 0) {
      console.log('First carryover balance parsed:', parsed);
    }
    return parsed;
  });

  console.log('Parsed CarryoverBalance data:', data.length, 'records');
  return data;
}

export async function writeRefundDetail(
  _spreadsheetId: string, // Not used - configured in Cloudflare environment
  refunds: RefundDetail[]
): Promise<{ success: boolean; updatedRows: number }> {
  const config = SHEET_CONFIGS.refundDetail;

  console.log(`📝 Writing ${refunds.length} refund records to ${config.name}...`);

  const data = refunds.map((refund) => [
    refund.年月,
    refund.利用者ID,
    refund.氏名,
    refund.所属ユニット,
    refund.月額預り金,
    refund.家賃,
    refund.家賃補助,
    refund.共益費,
    refund.日用品,
    refund.修繕積立,
    refund.食費合計,
    refund.光熱費,
    refund.金銭管理費,
    refund.火災保険,
    refund.食材費,
    refund.繰越金,
    refund.当月還元金合計,
  ]);

  console.log('First row to write:', data[0]);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheetName: config.name,
        spreadsheetId: _spreadsheetId,
        data,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (contentType?.includes('application/json')) {
        const error = await response.json();
        console.error(`❌ Error writing to ${config.name}:`, error);
        errorMessage = error.error || error.message || errorMessage;
      } else {
        const text = await response.text();
        console.error(`❌ Non-JSON error response for ${config.name}:`, text.substring(0, 200));
        errorMessage = `Server returned HTML instead of JSON. This usually means the API endpoint is not configured correctly.`;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log(`✅ Successfully wrote ${result.updatedRows} rows to ${config.name}`);

    return {
      success: result.success,
      updatedRows: result.updatedRows,
    };
  } catch (error) {
    console.error(`❌ Failed to write to ${config.name}:`, error);
    throw error;
  }
}

export async function writeMealCount(
  _spreadsheetId: string, // Not used - configured in Cloudflare environment
  meals: MealCount[]
): Promise<{ success: boolean; updatedRows: number }> {
  const config = SHEET_CONFIGS.mealCount;

  console.log(`📝 Writing ${meals.length} meal records to ${config.name}...`);

  const data = meals.map((meal) => [
    meal.月,
    meal.利用者ID,
    meal.氏名,
    meal.ユニット名,
    meal.朝食,
    meal.昼食,
    meal.夕食,
    meal.行事食,
    meal.備考,
  ]);

  console.log('First row to write:', data[0]);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheetName: config.name,
        spreadsheetId: _spreadsheetId,
        data,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (contentType?.includes('application/json')) {
        const error = await response.json();
        console.error(`❌ Error writing to ${config.name}:`, error);
        errorMessage = error.error || error.message || errorMessage;
      } else {
        const text = await response.text();
        console.error(`❌ Non-JSON error response for ${config.name}:`, text.substring(0, 200));
        errorMessage = `Server returned HTML instead of JSON. This usually means the API endpoint is not configured correctly.`;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log(`✅ Successfully wrote ${result.updatedRows} rows to ${config.name}`);

    return {
      success: result.success,
      updatedRows: result.updatedRows,
    };
  } catch (error) {
    console.error(`❌ Failed to write to ${config.name}:`, error);
    throw error;
  }
}
export async function writeUnitManagement(
  _spreadsheetId: string, // Not used - configured in Cloudflare environment
  data: UnitManagement[]
): Promise<{ success: boolean; updatedRows: number }> {
  const config = SHEET_CONFIGS.unitManagement;

  console.log(`📝 Writing ${data.length} unit management records to ${config.name}...`);

  const rows = data.map((item) => [
    item.年月,
    item.利用者ID,
    item.氏名,
    item.所属ユニット,
    item.月額預り金,
    item.家賃,
    item.家賃補助,
    item.日用品費,
    item.修繕積立金,
    item.朝食費,
    item.昼食費,
    item.夕食費,
    item.行事食,
    item.共益費,
    item.金銭管理費,
    item.火災保険,
    item.食材費,
    item.備考,       // R列
    item.ステータス, // S列
  ]);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheetName: config.name,
        spreadsheetId: _spreadsheetId,
        data: rows,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (contentType?.includes('application/json')) {
        const error = await response.json();
        console.error(`❌ Error writing to ${config.name}:`, error);
        errorMessage = error.error || error.message || errorMessage;
      } else {
        const text = await response.text();
        console.error(`❌ Non-JSON error response for ${config.name}:`, text.substring(0, 200));
        errorMessage = `Server returned HTML instead of JSON. This usually means the API endpoint is not configured correctly.`;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log(`✅ Successfully wrote ${result.updatedRows} rows to ${config.name}`);

    return {
      success: result.success,
      updatedRows: result.updatedRows,
    };
  } catch (error) {
    console.error(`❌ Failed to write to ${config.name}:`, error);
    throw error;
  }
}

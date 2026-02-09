import {
  UnitManagement,
  UnitMaster,
  UnitUtilityCost,
  MealCount,
  RefundDetail,
  SHEET_CONFIGS,
} from '../types/schemas';

// Cloudflare Pages Functions endpoint
const API_URL = '/api/sheets';

function parseNumber(value: string | undefined, fieldName?: string): number {
  if (!value || value === '') {
    return 0;
  }

  let cleanValue = String(value).trim();
  cleanValue = cleanValue.replace(/,/g, '');
  cleanValue = cleanValue.replace(/¥/g, '');
  cleanValue = cleanValue.replace(/円/g, '');
  cleanValue = cleanValue.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

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
  const url = `${API_URL}?sheetName=${encodeURIComponent(sheetName)}&range=${encodeURIComponent(
    range
  )}`;

  console.log(`📖 Fetching sheet: ${sheetName}, URL: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
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

  console.log('Raw UnitManagement rows (first 2):', rows.slice(0, 2));

  const data = rows.slice(1).map((row, index) => {
    const rawId = parseString(row[1]);
    const rawName = parseString(row[2]);

    // Validation warning for potential column swap
    if (index < 5 && rawId.length > rawName.length && !rawId.match(/^[A-Za-z0-9]+$/)) {
      console.warn(`⚠️ Potential Column Swap Detected in UnitManagement row ${index + 2}: ID="${rawId}", Name="${rawName}". ID usually is shorter and alphanumeric.`);
    }

    const parsed = {
      年月: parseString(row[0]),
      利用者ID: rawId,
      氏名: rawName,
      所属ユニット: parseString(row[3]),
      月額預り金: parseNumber(row[4], '月額預り金'),
      家賃: parseNumber(row[5], '家賃'),
      家賃補助: parseNumber(row[6], '家賃補助'),
      日用品費: parseNumber(row[7], '日用品費'),
      修繕積立金: parseNumber(row[8], '修繕積立金'),
      朝食費: parseNumber(row[9], '朝食費'),
      昼食費: parseNumber(row[10], '昼食費'),
      夕食費: parseNumber(row[11], '夕食費'),
      行事食: parseNumber(row[12], '行事食'),
      共益費: parseNumber(row[13], '共益費'),
      金銭管理費: parseNumber(row[14], '金銭管理費'),
      火災保険: parseNumber(row[15], '火災保険'),
      食材費: parseNumber(row[16], '食材費'),
      ステータス: parseString(row[17]),
      備考: parseString(row[18]),
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

  const data = rows.slice(1).map((row, index) => {
    const parsed = {
      ユニット名: parseString(row[0]),
      家賃: parseNumber(row[1], '家賃'),
      光熱費按分率: parseNumber(row[2], '光熱費按分率'),
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

  const data = rows.slice(1).map((row, index) => {
    const parsed = {
      年月: parseString(row[0]),
      ユニット名: parseString(row[1]),
      電気代: parseNumber(row[2], '電気代'),
      ガス代: parseNumber(row[3], 'ガス代'),
      水道代: parseNumber(row[4], '水道代'),
      サブ: parseNumber(row[5], 'サブ'),
      合計: parseNumber(row[6], '合計'),
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

  console.log('Raw MealCount rows (first 2):', rows.slice(0, 2));

  const data = rows.slice(1).map((row, index) => {
    const rawId = parseString(row[1]);
    const rawName = parseString(row[2]);

    // Validation warning for potential column swap
    if (index < 5 && rawId.length > rawName.length && !rawId.match(/^[A-Za-z0-9]+$/)) {
      console.warn(`⚠️ Potential Column Swap Detected in MealCount row ${index + 2}: ID="${rawId}", Name="${rawName}". ID usually is shorter and alphanumeric.`);
    }

    const parsed = {
      月: parseString(row[0]),
      利用者ID: rawId,
      氏名: rawName,
      ユニット名: parseString(row[3]),
      朝食: parseNumber(row[4], '朝食'),
      昼食: parseNumber(row[5], '昼食'),
      夕食: parseNumber(row[6], '夕食'),
      行事食: parseNumber(row[7], '行事食'),
      備考: parseString(row[8]),
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

  console.log('Raw RefundDetail rows (first 2):', rows.slice(0, 2));

  const data = rows.slice(1).map((row, index) => {
    const parsed = {
      年月: parseString(row[0]),
      利用者ID: parseString(row[1]),
      氏名: parseString(row[2]),
      所属ユニット: parseString(row[3]),
      月額預り金: parseNumber(row[4], '月額預り金'),
      家賃: parseNumber(row[5], '家賃'),
      家賃補助: parseNumber(row[6], '家賃補助'),
      共益費: parseNumber(row[7], '共益費'),
      日用品: parseNumber(row[8], '日用品'),
      修繕積立: parseNumber(row[9], '修繕積立'),
      食費合計: parseNumber(row[10], '食費合計'),
      光熱費: parseNumber(row[11], '光熱費'),
      金銭管理費: parseNumber(row[12], '金銭管理費'),
      火災保険: parseNumber(row[13], '火災保険'),
      食材費: parseNumber(row[14], '食材費'),
      繰越金: parseNumber(row[15], '繰越金'),
      当月還元金合計: parseNumber(row[16], '当月還元金合計'),
    };

    if (index === 0) {
      console.log('First refund detail parsed:', parsed);
    }

    return parsed;
  });

  console.log('Parsed RefundDetail data:', data.length, 'records');
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
    item.ステータス,
    item.備考,
  ]);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheetName: config.name,
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

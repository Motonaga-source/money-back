import { useState, useEffect } from 'react';
import { FileSpreadsheet, Calculator, Download, Save, AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';
import {
  UnitManagement,
  UnitMaster,
  UnitUtilityCost,
  MealCount,
  RefundDetail,
} from '../types/schemas';
import {
  fetchUnitManagement,
  fetchUnitMaster,
  fetchUnitUtilityCost,
  fetchMealCount,
  fetchRefundDetail,
  writeRefundDetail,
  writeMealCount,
  writeUnitManagement,
} from '../services/sheetsService';

interface CalculationDetail {
  count: number;
  unitPrice: number;
  total: number;
}

interface CalculatedRefund extends RefundDetail {
  calculated: boolean;
  ユニット家賃?: number; // Kept for backward compatibility during transition if needed, but using RefundDetail.家賃 now
  朝食費: number;
  昼食費: number;
  夕食費: number;
  details?: {
    breakfast: CalculationDetail;
    lunch: CalculationDetail;
    dinner: CalculationDetail;
    event: CalculationDetail;
  };
}

interface UnitChange {
  利用者ID: string;
  氏名: string;
  変更履歴: {
    年月: string;
    変更前: string;
    変更後: string;
  }[];
}

interface ValidationWarning {
  type: 'missing_month' | 'missing_utility' | 'missing_meal';
  message: string;
  details?: string;
}

interface UserSummary {
  利用者ID: string;
  氏名: string;
  年間預り金合計: number;
  年間支出合計: number;
  年間還元金合計: number;
  月別データ: RefundDetail[];
}

export default function RefundCalculator() {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('unitManagement');

  const [unitManagement, setUnitManagement] = useState<UnitManagement[]>([]);
  const [unitMaster, setUnitMaster] = useState<UnitMaster[]>([]);
  const [unitUtilityCost, setUnitUtilityCost] = useState<UnitUtilityCost[]>([]);
  const [mealCount, setMealCount] = useState<MealCount[]>([]);
  const [refundDetail, setRefundDetail] = useState<CalculatedRefund[]>([]);
  const [unitChanges, setUnitChanges] = useState<UnitChange[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const detectUnitChanges = (data: UnitManagement[]): UnitChange[] => {
    const userUnitHistory: Record<string, { 年月: string; 所属ユニット: string; 氏名: string }[]> = {};

    data.forEach((record) => {
      if (!userUnitHistory[record.利用者ID]) {
        userUnitHistory[record.利用者ID] = [];
      }
      userUnitHistory[record.利用者ID].push({
        年月: record.年月,
        所属ユニット: record.所属ユニット,
        氏名: record.氏名,
      });
    });

    const changes: UnitChange[] = [];

    Object.entries(userUnitHistory).forEach(([利用者ID, history]) => {
      const sortedHistory = history.sort((a, b) => a.年月.localeCompare(b.年月));
      const 変更履歴: { 年月: string; 変更前: string; 変更後: string }[] = [];

      for (let i = 1; i < sortedHistory.length; i++) {
        if (sortedHistory[i].所属ユニット !== sortedHistory[i - 1].所属ユニット) {
          変更履歴.push({
            年月: sortedHistory[i].年月,
            変更前: sortedHistory[i - 1].所属ユニット,
            変更後: sortedHistory[i].所属ユニット,
          });
        }
      }

      if (変更履歴.length > 0) {
        changes.push({
          利用者ID,
          氏名: sortedHistory[0].氏名,
          変更履歴,
        });
      }
    });

    return changes;
  };

  const validateData = (
    unitMgmt: UnitManagement[],
    utilityCost: UnitUtilityCost[],
    meals: MealCount[]
  ): ValidationWarning[] => {
    const warnings: ValidationWarning[] = [];

    const userMonths: Record<string, Set<string>> = {};
    unitMgmt.forEach((record) => {
      if (!userMonths[record.利用者ID]) {
        userMonths[record.利用者ID] = new Set();
      }
      userMonths[record.利用者ID].add(record.年月);
    });

    Object.entries(userMonths).forEach(([利用者ID, months]) => {
      if (months.size < 12) {
        const user = unitMgmt.find((u) => u.利用者ID === 利用者ID);
        const missingCount = 12 - months.size;
        warnings.push({
          type: 'missing_month',
          message: `${user?.氏名} (${利用者ID}): ${missingCount}ヶ月分のデータが不足しています`,
          details: `登録月数: ${months.size}/12ヶ月`,
        });
      }
    });

    const utilityMap = new Map<string, Set<string>>();
    utilityCost.forEach((u) => {
      const key = u.年月;
      if (!utilityMap.has(key)) {
        utilityMap.set(key, new Set());
      }
      utilityMap.get(key)!.add(u.ユニット名);
    });

    unitMgmt.forEach((record) => {
      const unitSet = utilityMap.get(record.年月);
      if (!unitSet || !unitSet.has(record.所属ユニット)) {
        warnings.push({
          type: 'missing_utility',
          message: `${record.年月} ${record.所属ユニット}の光熱費データが見つかりません`,
          details: `利用者: ${record.氏名} (${record.利用者ID})`,
        });
      }
    });

    const mealMap = new Map<string, Set<string>>();
    meals.forEach((m) => {
      const key = m.月;
      if (!mealMap.has(key)) {
        mealMap.set(key, new Set());
      }
      mealMap.get(key)!.add(m.利用者ID);
    });

    unitMgmt.forEach((record) => {
      const userSet = mealMap.get(record.年月);
      if (!userSet || !userSet.has(record.利用者ID)) {
        warnings.push({
          type: 'missing_meal',
          message: `${record.年月} ${record.氏名}の食数データが見つかりません`,
          details: `利用者ID: ${record.利用者ID}`,
        });
      }
    });

    return warnings;
  };

  const sortByFiscalYear = (a: string, b: string): number => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);

    const fiscalYearA = monthA >= 4 ? yearA : yearA - 1;
    const fiscalYearB = monthB >= 4 ? yearB : yearB - 1;

    if (fiscalYearA !== fiscalYearB) {
      return fiscalYearA - fiscalYearB;
    }

    const fiscalMonthA = monthA >= 4 ? monthA - 4 : monthA + 8;
    const fiscalMonthB = monthB >= 4 ? monthB - 4 : monthB + 8;

    return fiscalMonthA - fiscalMonthB;
  };

  const generateUserSummaries = (refunds: CalculatedRefund[]): UserSummary[] => {
    const userMap: Record<string, UserSummary> = {};

    refunds.forEach((refund) => {
      if (!userMap[refund.利用者ID]) {
        userMap[refund.利用者ID] = {
          利用者ID: refund.利用者ID,
          氏名: refund.氏名,
          年間預り金合計: 0,
          年間支出合計: 0,
          年間還元金合計: 0,
          月別データ: [],
        };
      }

      const summary = userMap[refund.利用者ID];
      summary.年間預り金合計 += refund.月額預り金;
      // 実質的な支出 = 家賃(満額) + 家賃補助(マイナス) + その他
      summary.年間支出合計 += refund.家賃 + refund.家賃補助 + refund.日用品 + refund.修繕積立 +
        refund.食費合計 + refund.光熱費 + refund.金銭管理費 + refund.火災保険;
      summary.年間還元金合計 += refund.当月還元金合計;
      summary.月別データ.push(refund);
    });

    Object.values(userMap).forEach((summary) => {
      summary.月別データ.sort((a, b) => sortByFiscalYear(a.年月, b.年月));
    });

    return Object.values(userMap).sort((a, b) => a.氏名.localeCompare(b.氏名));
  };

  const loadAllData = async () => {
    if (!spreadsheetId.trim()) {
      setError('スプレッドシートIDを入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      console.log('Loading data from spreadsheet:', spreadsheetId);

      const [
        unitManagementData,
        unitMasterData,
        unitUtilityCostData,
        mealCountData,
        refundDetailData,
      ] = await Promise.all([
        fetchUnitManagement(spreadsheetId),
        fetchUnitMaster(spreadsheetId),
        fetchUnitUtilityCost(spreadsheetId),
        fetchMealCount(spreadsheetId),
        fetchRefundDetail(spreadsheetId),
      ]);

      console.log('Data loaded successfully:', {
        unitManagement: unitManagementData.length,
        unitMaster: unitMasterData.length,
        unitUtilityCost: unitUtilityCostData.length,
        mealCount: mealCountData.length,
        refundDetail: refundDetailData.length,
      });

      setUnitManagement(unitManagementData);
      setUnitMaster(unitMasterData);
      setUnitUtilityCost(unitUtilityCostData);
      setMealCount(mealCountData);
      // 型キャストして初期化
      setRefundDetail(refundDetailData.map((r: RefundDetail) => ({
        ...r,
        calculated: false,
        家賃補助: 0,
        ユニット家賃: 0,
        朝食費: 0,
        昼食費: 0,
        夕食費: 0
      } as CalculatedRefund)));

      const changes = detectUnitChanges(unitManagementData);
      setUnitChanges(changes);
      console.log('🔄 ユニット変更検出:', changes);

      const warnings = validateData(unitManagementData, unitUtilityCostData, mealCountData);
      setValidationWarnings(warnings);
      console.log('⚠️ データ検証:', warnings.length > 0 ? `${warnings.length}件の警告` : '問題なし');
    } catch (err) {
      console.error('Error loading data:', err);
      const errorMessage = err instanceof Error ? err.message : 'データの読み込みに失敗しました';
      setError(`エラー: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };
  const calculateRefunds = () => {
    let successCount = 0;
    let warningCount = 0;

    // ユニットごとの人数を月別に計算
    const unitMemberCount: Record<string, number> = {};
    unitManagement.forEach(um => {
      const key = `${um.年月}_${um.所属ユニット}`;
      unitMemberCount[key] = (unitMemberCount[key] || 0) + 1;
    });

    const calculated: CalculatedRefund[] = unitManagement.map((um: UnitManagement, index: number) => {
      const unit = unitMaster.find((u) => u.ユニット名 === um.所属ユニット);
      const utility = unitUtilityCost.find(
        (u) => u.ユニット名 === um.所属ユニット && u.年月 === um.年月
      );
      const meal = mealCount.find(
        (m) => m.利用者ID === um.利用者ID && m.月 === um.年月
      );

      const unitKey = `${um.年月}_${um.所属ユニット}`;
      const ユニット人数 = unitMemberCount[unitKey] || 1;

      const hasAllData = unit && utility && meal;
      if (hasAllData) {
        successCount++;
      } else {
        warningCount++;
      }

      if (!utility) {
        console.warn(`⚠️ [${index + 1}] ${um.氏名}: 光熱費データが見つかりません`, {
          検索条件: { ユニット名: um.所属ユニット, 年月: um.年月 },
          利用可能な光熱費データ: unitUtilityCost.map(u => ({ ユニット名: u.ユニット名, 年月: u.年月 })),
        });
      }

      if (!unit) {
        console.warn(`⚠️ [${index + 1}] ${um.氏名}: ユニットマスタが見つかりません`, {
          検索条件: { ユニット名: um.所属ユニット },
          利用可能なユニット: unitMaster.map(u => u.ユニット名),
        });
      }

      console.log(`[${index + 1}/${unitManagement.length}] ${um.氏名} (${um.利用者ID})`, {
        ユニットマスタ: unit ? '✓' : '✗',
        光熱費データ: utility ? '✓' : '✗',
        食数データ: meal ? '✓' : '✗',
        ユニット人数: `${ユニット人数}人`,
      });

      const 月額預り金 = um.月額預り金 || 0;
      const 家賃補助 = um.家賃補助 || 0;
      const ユニット家賃 = um.家賃 || 0;

      // 実質負担する家賃 = ユニット本来の家賃 + 家賃補助 (家賃補助がマイナス値のため足し算)
      const 実質家賃 = Math.max(0, ユニット家賃 + 家賃補助);

      const 日用品 = um.日用品費 || 0;
      const 修繕積立 = um.修繕積立金 || 0;

      const 朝食回数 = meal?.朝食 || 0;
      const 昼食回数 = meal?.昼食 || 0;
      const 夕食回数 = meal?.夕食 || 0;
      const 行事食回数 = meal?.行事食 || 0;

      const 朝食単価 = um.朝食費 || 0;
      const 昼食単価 = um.昼食費 || 0;
      const 夕食単価 = um.夕食費 || 0;
      const 行事食単価 = um.行事食 || 0;

      const 朝食費 = 朝食回数 * 朝食単価;
      const 昼食費 = 昼食回数 * 昼食単価;
      const 夕食費 = 夕食回数 * 夕食単価;
      const 行事食費 = 行事食回数 * 行事食単価;

      const 食費合計 = 朝食費 + 昼食費 + 夕食費 + 行事食費;

      const 光熱費総額 = utility?.合計 || 0;
      const 按分率 = unit?.光熱費按分率 || 0;
      const 光熱費 = (光熱費総額 * (按分率 / 100)) / ユニット人数;

      if (index < 3 || 光熱費 === 0) {
        console.log(`💡 [${index + 1}] ${um.氏名} - 光熱費計算:`, {
          光熱費総額: `${光熱費総額.toLocaleString()}円`,
          按分率: `${按分率}%`,
          ユニット人数: `${ユニット人数}人`,
          計算式: `${光熱費総額} × (${按分率} ÷ 100) ÷ ${ユニット人数}`,
          光熱費: `${光熱費.toLocaleString()}円`,
          utilityデータあり: !!utility,
          unitデータあり: !!unit,
        });
      }

      const 金銭管理費 = um.金銭管理費 || 0;
      const 火災保険 = um.火災保険 || 0;

      const 当月還元金合計 = 月額預り金 - 実質家賃 - 日用品 - 修繕積立 - 食費合計 - 光熱費 - 金銭管理費 - 火災保険;

      if (index === 0) {
        console.log(`📊 計算例 (${um.氏名}):`, {
          月額預り金: `${月額預り金.toLocaleString()}円`,
          ユニット家賃: `${ユニット家賃.toLocaleString()}円`,
          家賃補助: `${家賃補助.toLocaleString()}円`,
          実質家賃負担: `${実質家賃.toLocaleString()}円 (= ${ユニット家賃} + ${家賃補助})`,
          日用品: `${日用品.toLocaleString()}円`,
          修繕積立: `${修繕積立.toLocaleString()}円`,
          食費: `朝${朝食回数}回×${朝食単価}円 + 昼${昼食回数}回×${昼食単価}円 + 夕${夕食回数}回×${夕食単価}円 + 行事${行事食回数}回×${行事食単価}円 = ${食費合計.toLocaleString()}円`,
          光熱費: `${光熱費総額.toLocaleString()}円 × ${按分率}% ÷ ${ユニット人数}人 = ${光熱費.toLocaleString()}円`,
          金銭管理費: `${金銭管理費.toLocaleString()}円`,
          火災保険: `${火災保険.toLocaleString()}円`,
          計算式: `${月額預り金.toLocaleString()} - ${実質家賃.toLocaleString()} - ${日用品.toLocaleString()} - ${修繕積立.toLocaleString()} - ${食費合計.toLocaleString()} - ${Math.round(光熱費).toLocaleString()} - ${金銭管理費.toLocaleString()} - ${火災保険.toLocaleString()}`,
          還元金: `${当月還元金合計.toLocaleString()}円`,
        });
      }

      const result: CalculatedRefund = {
        年月: um.年月,
        利用者ID: um.利用者ID,
        氏名: um.氏名,
        所属ユニット: um.所属ユニット,
        月額預り金: Math.round(月額預り金),
        家賃: Math.round(ユニット家賃), // Store original unit rent (満額)
        家賃補助: Math.round(家賃補助),
        日用品: Math.round(日用品),
        修繕積立: Math.round(修繕積立),
        食費合計: Math.round(食費合計),
        朝食費: Math.round(朝食費),
        昼食費: Math.round(昼食費),
        夕食費: Math.round(夕食費 + 行事食費),
        光熱費: Math.round(光熱費),
        金銭管理費: Math.round(金銭管理費),
        火災保険: Math.round(火災保険),
        繰越金: 0,
        当月還元金合計: Math.round(当月還元金合計),
        calculated: true,
        details: {
          breakfast: { count: 朝食回数, unitPrice: 朝食単価, total: 朝食費 },
          lunch: { count: 昼食回数, unitPrice: 昼食単価, total: 昼食費 },
          dinner: { count: 夕食回数, unitPrice: 夕食単価, total: 夕食費 },
          event: { count: 行事食回数, unitPrice: 行事食単価, total: 行事食費 },
        }
      };

      return result;
    });

    const totalRefund = calculated.reduce((sum, r) => sum + r.当月還元金合計, 0);

    console.log(`✅ 計算完了: ${calculated.length}件 (成功: ${successCount}, 警告: ${warningCount})`);
    console.log('計算結果サマリー:', {
      総預り金: calculated.reduce((sum, r) => sum + r.月額預り金, 0).toLocaleString() + '円',
      総支出: calculated.reduce((sum, r) => sum + (r.家賃 + r.家賃補助 + r.日用品 + r.修繕積立 + r.食費合計 + r.光熱費 + r.金銭管理費 + r.火災保険), 0).toLocaleString() + '円',
      総還元金: totalRefund.toLocaleString() + '円',
    });

    setRefundDetail(calculated);

    const summaries = generateUserSummaries(calculated);
    setUserSummaries(summaries);
    console.log('📊 利用者別サマリー生成:', summaries.length, '名');

    // Auto-switch to refundDetail only if we were in unitManagement or unitUtilityCost
    // If we are in mealInput, we might want to stay there
    if (activeTab === 'unitManagement' || activeTab === 'unitUtilityCost') {
      setActiveTab('refundDetail');
    }

    if (warningCount > 0) {
      setError(`⚠️ 計算完了しましたが、${warningCount}件のデータに不足があります。コンソールで詳細を確認してください。`);
      setSuccessMessage(null);
    } else {
      setError(null);
      setSuccessMessage(`✅ ${calculated.length}名の還元金計算が完了しました！総還元金: ${totalRefund.toLocaleString()}円`);
    }
  };

  const writeToSheet = async () => {
    if (!refundDetail.length) {
      setError('計算結果がありません。先に「還元金計算」を実行してください。');
      return;
    }

    if (!spreadsheetId.trim()) {
      setError('スプレッドシートIDを入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      console.log(`📤 スプレッドシートに${refundDetail.length}件の還元金明細を書き込み中...`);

      const refundsToWrite: RefundDetail[] = refundDetail.map((r: CalculatedRefund) => ({
        年月: r.年月,
        利用者ID: r.利用者ID,
        氏名: r.氏名,
        所属ユニット: r.所属ユニット,
        月額預り金: r.月額預り金,
        家賃: r.家賃,
        日用品: r.日用品,
        修繕積立: r.修繕積立,
        食費合計: r.食費合計,
        光熱費: r.光熱費,
        金銭管理費: r.金銭管理費,
        火災保険: r.火災保険,
        繰越金: r.繰越金,
        当月還元金合計: r.当月還元金合計,
      }));

      const result = await writeRefundDetail(spreadsheetId, refundsToWrite);

      console.log(`✅ 書き込み完了: ${result.updatedRows}行`);
      setSuccessMessage(`✅ スプレッドシートに${result.updatedRows}行を書き込みました！`);
      setError(null);
    } catch (err: any) {
      console.error('書き込みエラー:', err);
      setError(`書き込みに失敗しました: ${err.message}`);
      setSuccessMessage(null);
    } finally {
      setLoading(false);
    }
  };

  // --- Meal Input Logic ---
  const [mealInputMonth, setMealInputMonth] = useState<string>('');
  const [pendingMealChanges, setPendingMealChanges] = useState<Record<string, MealCount>>({});

  // --- Unit Input Logic ---
  const [unitInputMonth, setUnitInputMonth] = useState<string>('');
  const [pendingUnitChanges, setPendingUnitChanges] = useState<Record<string, UnitManagement>>({});

  // Initialize months when data loads or tab changes
  useEffect(() => {
    if ((activeTab === 'mealInput' || activeTab === 'unitInput') && unitManagement.length > 0) {
      const months = Array.from(new Set(unitManagement.map(u => u.年月))).sort();
      if (months.length > 0) {
        const latestMonth = months[months.length - 1];
        if (activeTab === 'mealInput' && !mealInputMonth) {
          setMealInputMonth(latestMonth);
        } else if (activeTab === 'unitInput' && !unitInputMonth) {
          setUnitInputMonth(latestMonth);
        }
      }
    }
  }, [activeTab, unitManagement, mealInputMonth, unitInputMonth]);

  const handleUnitInputChange = (userId: string, field: keyof UnitManagement, value: number | string) => {
    setPendingUnitChanges(prev => {
      const currentUnit = prev[userId] || unitManagement.find(u => u.利用者ID === userId && u.年月 === unitInputMonth) || {
        年月: unitInputMonth,
        利用者ID: userId,
        氏名: unitManagement.find(u => u.利用者ID === userId)?.氏名 || '',
        所属ユニット: unitManagement.find(u => u.利用者ID === userId)?.所属ユニット || '',
        月額預り金: 0,
        家賃: 0,
        家賃補助: 0,
        日用品費: 0,
        修繕積立金: 0,
        朝食費: 0,
        昼食費: 0,
        夕食費: 0,
        行事食: 0,
        金銭管理費: 0,
        火災保険: 0,
        備考: '',
      };

      return {
        ...prev,
        [userId]: {
          ...currentUnit,
          [field]: value
        }
      };
    });
  };

  const getUnitValue = (userId: string): UnitManagement => {
    if (pendingUnitChanges[userId]) {
      return pendingUnitChanges[userId];
    }
    const existing = unitManagement.find(u => u.利用者ID === userId && u.年月 === unitInputMonth);
    if (existing) return existing;

    const user = unitManagement.find(u => u.利用者ID === userId);
    return {
      年月: unitInputMonth,
      利用者ID: userId,
      氏名: user?.氏名 || '',
      所属ユニット: user?.所属ユニット || '',
      月額預り金: 0,
      家賃: 0,
      家賃補助: 0,
      日用品費: 0,
      修繕積立金: 0,
      朝食費: 0,
      昼食費: 0,
      夕食費: 0,
      行事食: 0,
      金銭管理費: 0,
      火災保険: 0,
      備考: '',
    };
  };

  const saveUnitManagement = async () => {
    if (!unitInputMonth) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updates = Object.values(pendingUnitChanges).filter(u => u.年月 === unitInputMonth);

      if (updates.length === 0) {
        setLoading(false);
        return;
      }

      const unitMap = new Map<string, UnitManagement>(unitManagement.map(u => [`${u.年月}_${u.利用者ID}`, u]));

      updates.forEach((update: UnitManagement) => {
        unitMap.set(`${update.年月}_${update.利用者ID}`, update);
      });

      const finalUnitManagement: UnitManagement[] = Array.from(unitMap.values());

      const result = await writeUnitManagement(spreadsheetId, finalUnitManagement);

      setUnitManagement(finalUnitManagement);
      setPendingUnitChanges({});
      setSuccessMessage(`✅ ${unitInputMonth}分のユニット管理データを保存しました (${result.updatedRows}行)`);

    } catch (err: any) {
      console.error('Save unit management error:', err);
      setError(`保存に失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderUnitInput = () => {
    if (unitManagement.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">データが読み込まれていません。</p>
        </div>
      );
    }

    const availableMonths = Array.from(new Set(unitManagement.map(u => u.年月))).sort();
    const activeUsers = unitManagement
      .filter(u => u.年月 === unitInputMonth)
      .sort((a, b) => a.所属ユニット.localeCompare(b.所属ユニット) || a.氏名.localeCompare(b.氏名));

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">対象月:</label>
            <select
              value={unitInputMonth}
              onChange={(e) => {
                setUnitInputMonth(e.target.value);
                setPendingUnitChanges({});
              }}
              className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 ml-2">
              対象者: {activeUsers.length}名
            </span>
          </div>
          <button
            onClick={saveUnitManagement}
            disabled={Object.keys(pendingUnitChanges).length === 0 || loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            <Save className="w-4 h-4 mr-2" />
            保存する
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20">氏名 / ユニット</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">月額預り金</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">家賃</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">家賃補助</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">日用品費</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">修繕積立</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">朝食単価</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">昼食単価</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">夕食単価</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">行事単価</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">金銭管理</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">火災保険</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">備考</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeUsers.map((user) => {
                const unitData = getUnitValue(user.利用者ID);
                const hasChanges = !!pendingUnitChanges[user.利用者ID];

                return (
                  <tr key={user.利用者ID} className={hasChanges ? "bg-yellow-50" : "hover:bg-gray-50"}>
                    <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-inherit z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="text-sm font-medium text-gray-900">{user.氏名}</div>
                      <div className="text-sm text-gray-500">{user.所属ユニット}</div>
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-24 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.月額預り金}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '月額預り金', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-24 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.家賃}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '家賃', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-20 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.家賃補助}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '家賃補助', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-20 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.日用品費}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '日用品費', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-20 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.修繕積立金}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '修繕積立金', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-16 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.朝食費}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '朝食費', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-16 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.昼食費}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '昼食費', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-16 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.夕食費}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '夕食費', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-16 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.行事食}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '行事食', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-20 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.金銭管理費}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '金銭管理費', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-1 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        className="w-20 text-right border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.火災保険}
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '火災保険', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={unitData.備考 || ''}
                        placeholder="メモ"
                        onChange={(e) => handleUnitInputChange(user.利用者ID, '備考', e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleMealInputChange = (userId: string, field: keyof MealCount, value: number | string) => {
    setPendingMealChanges(prev => {
      const currentMeal = prev[userId] || mealCount.find(m => m.利用者ID === userId && m.月 === mealInputMonth) || {
        月: mealInputMonth,
        利用者ID: userId,
        氏名: unitManagement.find(u => u.利用者ID === userId)?.氏名 || '',
        ユニット名: unitManagement.find(u => u.利用者ID === userId)?.所属ユニット || '',
        朝食: 0,
        昼食: 0,
        夕食: 0,
        行事食: 0,
        備考: '',
      };

      return {
        ...prev,
        [userId]: {
          ...currentMeal,
          [field]: value
        }
      };
    });
  };

  const getMealValue = (userId: string): MealCount => {
    if (pendingMealChanges[userId]) {
      return pendingMealChanges[userId];
    }
    const existing = mealCount.find(m => m.利用者ID === userId && m.月 === mealInputMonth);
    if (existing) return existing;

    const user = unitManagement.find(u => u.利用者ID === userId && u.年月 === mealInputMonth);
    return {
      月: mealInputMonth,
      利用者ID: userId,
      氏名: user?.氏名 || '',
      ユニット名: user?.所属ユニット || '',
      朝食: 0,
      昼食: 0,
      夕食: 0,
      行事食: 0,
      備考: '',
    };
  };

  const saveMealCounts = async () => {
    if (!mealInputMonth) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1. Merge pending changes into complete mealCount list
      // existing records are replaced, new ones (for this month) are added
      // global mealCount needs to be updated with overrides from pendingMealChanges

      const newMealCounts = [...mealCount];

      // Filter out existing records for the current month that are being updated
      // checking logic: if we have a pending change for user X in month Y, 
      // we need to make sure we update the entry in the main list.

      const updates = Object.values(pendingMealChanges).filter(m => m.月 === mealInputMonth);

      if (updates.length === 0) {
        setLoading(false);
        return; // Nothing to save
      }

      // Create a map for easier access to existing records
      // Key: "Month_UserID"
      const mealMap = new Map<string, MealCount>(mealCount.map(m => [`${m.月}_${m.利用者ID}`, m]));

      // Apply updates
      updates.forEach((update: MealCount) => {
        mealMap.set(`${update.月}_${update.利用者ID}`, update);
      });

      const finalMealCounts: MealCount[] = Array.from(mealMap.values());

      // 2. Write to sheet
      const result = await writeMealCount(spreadsheetId, finalMealCounts);

      // 3. Update local state
      setMealCount(finalMealCounts);
      setPendingMealChanges({});
      setSuccessMessage(`✅ ${mealInputMonth}分の食数データを保存しました (${result.updatedRows}行)`);

    } catch (err: any) {
      console.error('Save meal error:', err);
      setError(`保存に失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderMealInput = () => {
    if (unitManagement.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">データが読み込まれていません。</p>
        </div>
      );
    }

    const availableMonths = Array.from(new Set(unitManagement.map(u => u.年月))).sort();

    // Filter users belonging to the selected month in UnitManagement
    // This ensures we only show active users for that month
    const activeUsers = unitManagement
      .filter(u => u.年月 === mealInputMonth)
      .sort((a, b) => a.所属ユニット.localeCompare(b.所属ユニット) || a.氏名.localeCompare(b.氏名));

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">対象月:</label>
            <select
              value={mealInputMonth}
              onChange={(e) => {
                setMealInputMonth(e.target.value);
                setPendingMealChanges({});
              }}
              className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 ml-2">
              対象者: {activeUsers.length}名
            </span>
          </div>
          <button
            onClick={saveMealCounts}
            disabled={Object.keys(pendingMealChanges).length === 0 || loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            <Save className="w-4 h-4 mr-2" />
            保存する
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名 / ユニット</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">朝食</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">昼食</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">夕食</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">行事食</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備考</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeUsers.map((user) => {
                const mealData = getMealValue(user.利用者ID);
                const hasChanges = !!pendingMealChanges[user.利用者ID];

                return (
                  <tr key={user.利用者ID} className={hasChanges ? "bg-yellow-50" : "hover:bg-gray-50"}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.氏名}</div>
                      <div className="text-sm text-gray-500">{user.所属ユニット}</div>
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-16 text-center border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={mealData.朝食}
                        onChange={(e) => handleMealInputChange(user.利用者ID, '朝食', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-16 text-center border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={mealData.昼食}
                        onChange={(e) => handleMealInputChange(user.利用者ID, '昼食', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-16 text-center border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={mealData.夕食}
                        onChange={(e) => handleMealInputChange(user.利用者ID, '夕食', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-16 text-center border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={mealData.行事食}
                        onChange={(e) => handleMealInputChange(user.利用者ID, '行事食', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-1"
                        value={mealData.備考 || ''}
                        placeholder="メモ"
                        onChange={(e) => handleMealInputChange(user.利用者ID, '備考', e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };


  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const tabs = [
    { id: 'mealInput', label: '食数入力', data: [] },
    { id: 'unitInput', label: 'ユニット入力', data: [] },
    { id: 'unitManagement', label: 'ユニット管理', data: unitManagement },
    { id: 'unitMaster', label: 'ユニットマスタ', data: unitMaster },
    { id: 'unitUtilityCost', label: 'ユニット別光熱費', data: unitUtilityCost },
    { id: 'mealCount', label: '食数計算(参照)', data: mealCount },
    { id: 'refundDetail', label: '還元金明細', data: refundDetail },
    { id: 'userSummary', label: '利用者別サマリー', data: userSummaries },
  ];

  const renderTable = () => {
    if (activeTab === 'mealInput') {
      return renderMealInput();
    }

    if (activeTab === 'unitInput') {
      return renderUnitInput();
    }

    const activeData = tabs.find((t) => t.id === activeTab)?.data || [];

    if (activeTab === 'userSummary') {
      if (userSummaries.length === 0) {
        return (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">データがありません</p>
            <p className="text-sm">「還元金計算」ボタンをクリックして計算を実行してください</p>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {userSummaries.map((summary) => {
            const isExpanded = expandedUsers.has(summary.利用者ID);
            return (
              <div key={summary.利用者ID} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleUserExpansion(summary.利用者ID)}
                  className="w-full px-6 py-4 bg-gradient-to-r from-slate-50 to-gray-50 hover:from-slate-100 hover:to-gray-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <Users className="w-5 h-5 text-blue-600" />
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{summary.氏名}</p>
                      <p className="text-xs text-gray-500">ID: {summary.利用者ID}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-gray-600">年間預り金</p>
                      <p className="text-sm font-bold text-blue-600">
                        {summary.年間預り金合計.toLocaleString()}円
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600">年間支出</p>
                      <p className="text-sm font-bold text-orange-600">
                        {summary.年間支出合計.toLocaleString()}円
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600">年間還元金</p>
                      <p className="text-lg font-bold text-green-600">
                        {summary.年間還元金合計.toLocaleString()}円
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="bg-white p-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">年月</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">ユニット</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">預り金</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">家賃</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">家賃補助</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">光熱費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 w-32">朝食費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 w-32">昼食費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 w-32">夕食費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">修繕積立金</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">日用品費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">金銭管理費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">火災保険</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">還元金</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {summary.月別データ.map((month, idx) => {
                            // Cast to CalculatedRefund to access new fields
                            const r = month as CalculatedRefund;
                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-900">{r.年月}</td>
                                <td className="px-4 py-2 text-gray-900">{r.所属ユニット}</td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.月額預り金.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.家賃.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.家賃補助.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.光熱費.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  <div className="font-medium">{r.朝食費.toLocaleString()}</div>
                                  {r.details && (
                                    <div className="text-[10px] text-gray-500">
                                      @{r.details.breakfast.unitPrice}×{r.details.breakfast.count}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  <div className="font-medium">{r.昼食費.toLocaleString()}</div>
                                  {r.details && (
                                    <div className="text-[10px] text-gray-500">
                                      @{r.details.lunch.unitPrice}×{r.details.lunch.count}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  <div className="font-medium">{r.夕食費.toLocaleString()}</div>
                                  {r.details && (
                                    <div className="text-[10px] text-gray-500">
                                      @{r.details.dinner.unitPrice}×{r.details.dinner.count}
                                      {r.details.event.total > 0 && ` +行事${r.details.event.total}`}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.修繕積立.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.日用品.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.金銭管理費.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.火災保険.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-green-600">
                                  {r.当月還元金合計.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'mealInput') {
      return renderMealInput();
    }

    if (activeData.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">データがありません</p>
          <p className="text-sm">
            {activeTab === 'refundDetail'
              ? '「還元金計算」ボタンをクリックして計算を実行してください'
              : 'スプレッドシートIDを入力して「データ読み込み」ボタンをクリックしてください'
            }
          </p>
        </div>
      );
    }

    const headers = Object.keys(activeData[0]).filter(key => key !== 'calculated' && key !== 'details');
    console.log('Rendering table with headers:', headers);
    console.log('First row data:', activeData[0]);

    const isRefundDetail = activeTab === 'refundDetail' && activeData.length > 0;
    const calculatedData = isRefundDetail ? activeData as CalculatedRefund[] : [];

    return (
      <>
        {isRefundDetail && calculatedData.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">計算結果サマリー</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-xs text-gray-600 mb-1">対象者数</p>
                <p className="text-2xl font-bold text-gray-900">{calculatedData.length}人</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-xs text-gray-600 mb-1">総預り金</p>
                <p className="text-2xl font-bold text-blue-600">
                  {calculatedData.reduce((sum, r) => sum + r.月額預り金, 0).toLocaleString()}円
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-xs text-gray-600 mb-1">総支出</p>
                <p className="text-2xl font-bold text-orange-600">
                  {calculatedData.reduce((sum, r) => sum + (r.家賃 + r.家賃補助 + r.日用品 + r.修繕積立 + r.食費合計 + r.光熱費 + r.金銭管理費 + r.火災保険), 0).toLocaleString()}円
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-xs text-gray-600 mb-1">総還元金</p>
                <p className="text-2xl font-bold text-green-600">
                  {calculatedData.reduce((sum, r) => sum + r.当月還元金合計, 0).toLocaleString()}円
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 md:grid-cols-7 gap-2">
              <div className="bg-white p-3 rounded shadow-sm">
                <p className="text-xs text-gray-600">家賃合計</p>
                <p className="text-sm font-semibold text-gray-900">
                  {calculatedData.reduce((sum, r) => sum + r.家賃, 0).toLocaleString()}円
                </p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm">
                <p className="text-xs text-gray-600">日用品合計</p>
                <p className="text-sm font-semibold text-gray-900">
                  {calculatedData.reduce((sum, r) => sum + r.日用品, 0).toLocaleString()}円
                </p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm">
                <p className="text-xs text-gray-600">修繕積立合計</p>
                <p className="text-sm font-semibold text-gray-900">
                  {calculatedData.reduce((sum, r) => sum + r.修繕積立, 0).toLocaleString()}円
                </p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm">
                <p className="text-xs text-gray-600">食費合計</p>
                <p className="text-sm font-semibold text-gray-900">
                  {calculatedData.reduce((sum, r) => sum + r.食費合計, 0).toLocaleString()}円
                </p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm">
                <p className="text-xs text-gray-600">光熱費合計</p>
                <p className="text-sm font-semibold text-gray-900">
                  {calculatedData.reduce((sum, r) => sum + r.光熱費, 0).toLocaleString()}円
                </p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm">
                <p className="text-xs text-gray-600">管理費合計</p>
                <p className="text-sm font-semibold text-gray-900">
                  {calculatedData.reduce((sum, r) => sum + r.金銭管理費, 0).toLocaleString()}円
                </p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm">
                <p className="text-xs text-gray-600">保険合計</p>
                <p className="text-sm font-semibold text-gray-900">
                  {calculatedData.reduce((sum, r) => sum + r.火災保険, 0).toLocaleString()}円
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeData.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {headers.map((header) => (
                    <td
                      key={header}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {typeof row[header] === 'number'
                        ? row[header].toLocaleString('ja-JP')
                        : row[header] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileSpreadsheet className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">還元金計算ツール</h1>
          </div>
          <p className="text-gray-600">
            Google スプレッドシートから利用者データを読み込み、還元金を自動計算します
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            スプレッドシートID
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="1X2Y3Z..."
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
            />
            <button
              onClick={loadAllData}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Download className="w-5 h-5" />
              )}
              データ読み込み
            </button>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
              {successMessage}
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <details className="text-sm text-gray-500 cursor-pointer p-2 border rounded hover:bg-gray-50">
            <summary>🔍 データインスペクター (最初のレコード)</summary>
            <div className="mt-2 space-y-4 p-2">
              {unitManagement.length > 0 && (
                <div>
                  <p className="font-bold text-xs uppercase text-gray-700">ユニット管理 (UnitManagement)</p>
                  <pre className="mt-1 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                    {JSON.stringify(unitManagement[0], null, 2)}
                  </pre>
                </div>
              )}
              {mealCount.length > 0 && (
                <div>
                  <p className="font-bold text-xs uppercase text-gray-700">食数データ (MealCount)</p>
                  <pre className="mt-1 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                    {JSON.stringify(mealCount[0], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        </div>

        {unitChanges.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-yellow-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              ユニット移動の検出
            </h3>
            <div className="space-y-4">
              {unitChanges.map((change, idx) => (
                <div key={idx} className="bg-white p-4 rounded border border-yellow-100">
                  <p className="font-bold text-gray-900">{change.氏名} ({change.利用者ID})</p>
                  <ul className="mt-2 space-y-1">
                    {change.変更履歴.map((hist, hIdx) => (
                      <li key={hIdx} className="text-sm text-gray-600 ml-4 list-disc">
                        {hist.年月}: {hist.変更前} → <span className="font-bold text-yellow-700">{hist.変更後}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {validationWarnings.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-orange-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              データ不足の警告
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {validationWarnings.map((warning, idx) => (
                <div key={idx} className="flex gap-2 text-sm text-orange-700">
                  <span className="font-bold min-w-[120px]">
                    {warning.type === 'missing_month' ? '月データ不足' :
                      warning.type === 'missing_utility' ? '光熱費未登録' : '食数未登録'}
                  </span>
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {unitManagement.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors
                      ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    `}
                  >
                    {tab.label}
                    {tab.data.length > 0 && (
                      <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {tab.data.length}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'refundDetail' && (
                <div className="mb-6 flex gap-4">
                  <button
                    onClick={calculateRefunds}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <Calculator className="w-5 h-5" />
                    還元金計算を実行
                  </button>
                  {refundDetail.length > 0 && (
                    <button
                      onClick={writeToSheet}
                      disabled={loading}
                      className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <Save className="w-5 h-5" />
                      )}
                      スプレッドシートへ書き込み
                    </button>
                  )}
                </div>
              )}

              {renderTable()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Calculator, Download, Save, AlertTriangle, ChevronDown, ChevronUp, Users, Printer } from 'lucide-react';
import {
  UnitManagement,
  UnitMaster,
  UnitUtilityCost,
  MealCount,
  RefundDetail,
  CarryoverBalance,
} from '../types/schemas';
import {
  fetchUnitManagement,
  fetchUnitMaster,
  fetchUnitUtilityCost,
  fetchMealCount,
  fetchRefundDetail,
  fetchCarryoverBalances,
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
  前年度繰越金: number;
  繰越金: number;
  最終還元金: number;
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
  const [carryoverBalances, setCarryoverBalances] = useState<CarryoverBalance[]>([]);
  const [unitChanges, setUnitChanges] = useState<UnitChange[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [printingUsers, setPrintingUsers] = useState<UserSummary[]>([]);
  const [summaryEndMonth, setSummaryEndMonth] = useState<string>('all');

  const normalizeStatus = (s: string) => (s || '').trim().replace(/[\s\u3000]/g, '');

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
    const utilityMap = new Map<string, Set<string>>();
    utilityCost.forEach((u) => {
      const key = u.年月;
      if (!utilityMap.has(key)) utilityMap.set(key, new Set());
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
      if (!mealMap.has(key)) mealMap.set(key, new Set());
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

  const toHalfWidth = (str: string) => {
    return str.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
  };

  const parseDateString = (dateString: any): { year: number; month: number } | null => {
    if (!dateString) return null;
    const strVal = String(dateString).trim();
    if (!strVal) return null;

    const num = Number(strVal);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    }

    const val = toHalfWidth(strVal);
    const matches = val.match(/\d+/g);
    if (!matches || matches.length < 2) return null;

    let year = Number(matches[0]);
    const month = Number(matches[1]);
    if (val.includes('R') || val.includes('令和') || (year < 100 && year > 0)) {
      if (year < 100) year += 2018;
    }
    return { year, month };
  };

  const sortByFiscalYear = (a: string, b: string): number => {
    const dateA = parseDateString(a);
    const dateB = parseDateString(b);
    if (!dateA || !dateB) return 0;
    const fiscalYearA = dateA.month >= 4 ? dateA.year : dateA.year - 1;
    const fiscalYearB = dateB.month >= 4 ? dateB.year : dateB.year - 1;
    if (fiscalYearA !== fiscalYearB) return fiscalYearA - fiscalYearB;
    const fiscalMonthA = dateA.month >= 4 ? dateA.month - 4 : dateA.month + 8;
    const fiscalMonthB = dateB.month >= 4 ? dateB.month - 4 : dateB.month + 8;
    return fiscalMonthA - fiscalMonthB;
  };

  const getFiscalYear = (dateString: string): number => {
    const date = parseDateString(dateString);
    if (!date) return 0;
    return date.month >= 4 ? date.year : date.year - 1;
  };

  const generateUserSummaries = (refunds: CalculatedRefund[]): UserSummary[] => {
    const userMap: Record<string, UserSummary> = {};
    refunds.forEach((refund) => {
      if (!userMap[refund.利用者ID]) {
        const targetId = String(refund.利用者ID).trim();
        let carryover = carryoverBalances.find(c => String(c.利用者ID).trim() === targetId);
        if (!carryover) {
          const normalize = (s: string) => (s || '').replace(/\s|　/g, '');
          carryover = carryoverBalances.find(c => normalize(c.氏名) === normalize(refund.氏名));
        }
        userMap[refund.利用者ID] = {
          利用者ID: refund.利用者ID,
          氏名: refund.氏名,
          年間預り金合計: 0,
          年間支出合計: 0,
          年間還元金合計: 0,
          前年度繰越金: carryover?.前年度繰越金 || 0,
          繰越金: carryover?.繰越金 || 0,
          最終還元金: 0,
          月別データ: [],
        };
      }
      const summary = userMap[refund.利用者ID];
      summary.年間預り金合計 += refund.月額預り金;
      summary.年間支出合計 += refund.家賃 + refund.家賃補助 + refund.共益費 + refund.日用品 + refund.修繕積立 +
        refund.食費合計 + refund.光熱費 + refund.金銭管理費 + refund.火災保険 + refund.食材費;
      summary.年間還元金合計 += refund.当月還元金合計;
      summary.月別データ.push(refund);
    });

    Object.values(userMap).forEach((summary) => {
      summary.月別データ.sort((a, b) => sortByFiscalYear(a.年月, b.年月));
      summary.最終還元金 = summary.年間還元金合計 + summary.前年度繰越金 - summary.繰越金;
    });
    return Object.values(userMap).sort((a, b) => a.利用者ID.localeCompare(b.利用者ID));
  };

  useEffect(() => {
    if (refundDetail.length > 0) {
      const summaries = generateUserSummaries(refundDetail);
      setUserSummaries(summaries);
    }
  }, [refundDetail, carryoverBalances]);

  const filteredSummaries = useMemo(() => {
    if (summaryEndMonth === 'all') return userSummaries;
    const allMonths = Array.from(new Set(userSummaries.flatMap(s => s.月別データ.map(m => m.年月)))).sort(sortByFiscalYear as any);
    const endIndex = allMonths.indexOf(summaryEndMonth);
    if (endIndex === -1) return userSummaries;
    const targetMonths = new Set(allMonths.slice(0, endIndex + 1));
    return userSummaries.map(user => {
      const filteredData = user.月別データ.filter(m => targetMonths.has(m.年月));
      let 年間預り金合計 = 0, 年間支出合計 = 0, 年間還元金合計 = 0;
      filteredData.forEach(r => {
        年間預り金合計 += r.月額預り金 || 0;
        年間支出合計 += (r.家賃 || 0) + (r.家賃補助 || 0) + (r.共益費 || 0) + (r.日用品 || 0) + (r.修繕積立 || 0) + (r.食費合計 || 0) + (r.光熱費 || 0) + (r.金銭管理費 || 0) + (r.火災保険 || 0) + (r.食材費 || 0);
        年間還元金合計 += r.当月還元金合計 || 0;
      });
      return { ...user, 年間預り金合計, 年間支出合計, 年間還元金合計, 最終還元金: 年間還元金合計 + user.前年度繰越金 - user.繰越金, 月別データ: filteredData };
    });
  }, [userSummaries, summaryEndMonth]);

  const loadAllData = async () => {
    if (!spreadsheetId.trim()) { setError('スプレッドシートIDを入力してください'); return; }
    setLoading(true); setError(null); setSuccessMessage(null);
    try {
      const [uMgmt, uMaster, uUtil, mCount, rDetail, cBal] = await Promise.all([
        fetchUnitManagement(spreadsheetId), fetchUnitMaster(spreadsheetId), fetchUnitUtilityCost(spreadsheetId),
        fetchMealCount(spreadsheetId), fetchRefundDetail(spreadsheetId), fetchCarryoverBalances(spreadsheetId),
      ]);
      setUnitManagement(uMgmt); setUnitMaster(uMaster); setUnitUtilityCost(uUtil); setMealCount(mCount); setCarryoverBalances(cBal);
      setRefundDetail(rDetail.map((r: RefundDetail) => ({ ...r, calculated: false, 朝食費: 0, 昼食費: 0, 夕食費: 0 } as CalculatedRefund)));
      setUnitChanges(detectUnitChanges(uMgmt));
      setValidationWarnings(validateData(uMgmt, uUtil, mCount));
    } catch (err: any) { setError(`エラー: ${err.message}`); } finally { setLoading(false); }
  };

  const calculateRefunds = () => {
    let successCount = 0, warningCount = 0;
    const unitMemberCount: Record<string, number> = {};
    unitManagement.forEach((um) => {
      if (!normalizeStatus(um.ステータス).includes('退去')) {
        const key = `${um.年月}_${um.所属ユニット}`;
        unitMemberCount[key] = (unitMemberCount[key] || 0) + 1;
      }
    });

    const calculated: CalculatedRefund[] = unitManagement.map((um) => {
      const unit = unitMaster.find((u) => u.ユニット名 === um.所属ユニット);
      const utility = unitUtilityCost.find((u) => u.ユニット名 === um.所属ユニット && u.年月 === um.年月);
      const meal = mealCount.find((m) => m.利用者ID === um.利用者ID && m.月 === um.年月);
      const ユニット人数 = unitMemberCount[`${um.年月}_${um.所属ユニット}`] || 1;
      if (unit && utility && meal) successCount++; else warningCount++;

      const 実質家賃 = Math.max(0, (um.家賃 || 0) + (um.家賃補助 || 0));
      const 食費合計 = (meal?.朝食 || 0) * (um.朝食費 || 0) + (meal?.昼食 || 0) * (um.昼食費 || 0) + (meal?.夕食 || 0) * (um.夕食費 || 0) + (meal?.行事食 || 0) * (um.行事食 || 0);
      const 光熱費 = normalizeStatus(um.ステータス).includes('退去') ? 0 : ((utility?.合計 || 0) * ((unit?.光熱費按分率 || 0) / 100)) / ユニット人数;
      const 当月還元金合計 = (um.月額預り金 || 0) - 実質家賃 - (um.共益費 || 0) - (um.日用品費 || 0) - (um.修繕積立金 || 0) - 食費合計 - 光熱費 - (um.金銭管理費 || 0) - (um.火災保険 || 0) - (um.食材費 || 0);

      return {
        年月: um.年月, 利用者ID: um.利用者ID, 氏名: um.氏名, 所属ユニット: um.所属ユニット, 月額預り金: Math.round(um.月額預り金 || 0),
        家賃: Math.round(um.家賃 || 0), 家賃補助: Math.round(um.家賃補助 || 0), 共益費: Math.round(um.共益費 || 0),
        日用品: Math.round(um.日用品費 || 0), 修繕積立: Math.round(um.修繕積立金 || 0), 食費合計: Math.round(食費合計),
        朝食費: Math.round((meal?.朝食 || 0) * (um.朝食費 || 0)), 昼食費: Math.round((meal?.昼食 || 0) * (um.昼食費 || 0)),
        夕食費: Math.round(((meal?.夕食 || 0) * (um.夕食費 || 0)) + ((meal?.行事食 || 0) * (um.行事食 || 0))),
        光熱費: Math.round(光熱費), 金銭管理費: Math.round(um.金銭管理費 || 0), 火災保険: Math.round(um.火災保険 || 0),
        食材費: Math.round(um.食材費 || 0), 繰越金: 0, 当月還元金合計: Math.round(当月還元金合計), calculated: true,
        details: {
          breakfast: { count: meal?.朝食 || 0, unitPrice: um.朝食費 || 0, total: (meal?.朝食 || 0) * (um.朝食費 || 0) },
          lunch: { count: meal?.昼食 || 0, unitPrice: um.昼食費 || 0, total: (meal?.昼食 || 0) * (um.昼食費 || 0) },
          dinner: { count: meal?.夕食 || 0, unitPrice: um.夕食費 || 0, total: (meal?.夕食 || 0) * (um.夕食費 || 0) },
          event: { count: meal?.行事食 || 0, unitPrice: um.行事食 || 0, total: (meal?.行事食 || 0) * (um.行事食 || 0) },
        }
      };
    });

    setRefundDetail(calculated);
    if (activeTab === 'unitManagement' || activeTab === 'unitUtilityCost') setActiveTab('refundDetail');
    if (warningCount > 0) setError(`⚠️ 計算完了しましたが、${warningCount}件のデータに不足があります。`);
    else setSuccessMessage(`✅ ${calculated.length}名の還元金計算が完了しました！`);
  };

  const writeToSheet = async () => {
    if (!refundDetail.length || !spreadsheetId.trim()) { setError('データ不足またはID未入力です'); return; }
    setLoading(true); setError(null); setSuccessMessage(null);
    try {
      await writeRefundDetail(spreadsheetId, refundDetail.map(r => ({
        年月: r.年月, 利用者ID: r.利用者ID, 氏名: r.氏名, 所属ユニット: r.所属ユニット, 月額預り金: r.月額預り金, 家賃: r.家賃, 家賃補助: r.家賃補助, 共益費: r.共益費,
        日用品: r.日用品, 修繕積立: r.修繕積立, 食費合計: r.食費合計, 光熱費: r.光熱費, 金銭管理費: r.金銭管理費, 火災保険: r.火災保険, 食材費: r.食材費, 繰越金: r.繰越金, 当月還元金合計: r.当月還元金合計,
      })));
      setSuccessMessage(`✅ スプレッドシートに書き込みました！`);
    } catch (err: any) { setError(`書き込み失敗: ${err.message}`); } finally { setLoading(false); }
  };

  // --- Meal & Unit Input Logic ---
  const [mealInputMonth, setMealInputMonth] = useState('');
  const [pendingMealChanges, setPendingMealChanges] = useState<Record<string, MealCount>>({});
  const [unitInputMonth, setUnitInputMonth] = useState('');
  const [pendingUnitChanges, setPendingUnitChanges] = useState<Record<string, UnitManagement>>({});

  useEffect(() => {
    if ((activeTab === 'mealInput' || activeTab === 'unitInput') && unitManagement.length > 0) {
      const months = Array.from(new Set(unitManagement.map(u => u.年月))).sort(sortByFiscalYear as any);
      if (months.length > 0) {
        const latest = months[months.length - 1];
        if (activeTab === 'mealInput' && !mealInputMonth) setMealInputMonth(latest);
        else if (activeTab === 'unitInput' && !unitInputMonth) setUnitInputMonth(latest);
      }
    }
  }, [activeTab, unitManagement]);

  const handleMealInputChange = (userId: string, field: keyof MealCount, value: any) => {
    setPendingMealChanges(prev => ({ ...prev, [userId]: { ...(prev[userId] || mealCount.find(m => m.利用者ID === userId && m.月 === mealInputMonth) || { 月: mealInputMonth, 利用者ID: userId, 氏名: unitManagement.find(u => u.利用者ID === userId)?.氏名 || '', ユニット名: unitManagement.find(u => u.利用者ID === userId)?.所属ユニット || '', 朝食: 0, 昼食: 0, 夕食: 0, 行事食: 0, 備考: '' }), [field]: value } }));
  };
  const getMealValue = (userId: string) => pendingMealChanges[userId] || mealCount.find(m => m.利用者ID === userId && m.月 === mealInputMonth) || { 月: mealInputMonth, 利用者ID: userId, 氏名: '', ユニット名: '', 朝食: 0, 昼食: 0, 夕食: 0, 行事食: 0, 備考: '' };

  const saveMealCounts = async () => {
    if (!mealInputMonth) return;
    setLoading(true); try {
      const updates = Object.values(pendingMealChanges).filter(m => m.月 === mealInputMonth);
      if (updates.length) {
        const mealMap = new Map(mealCount.map(m => [`${m.月}_${m.利用者ID}`, m]));
        updates.forEach(u => mealMap.set(`${u.月}_${u.利用者ID}`, u));
        const final = Array.from(mealMap.values());
        await writeMealCount(spreadsheetId, final);
        setMealCount(final); setPendingMealChanges({}); setSuccessMessage(`✅ 保存しました`);
      }
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleUnitInputChange = (userId: string, field: keyof UnitManagement, value: any) => {
    setPendingUnitChanges(prev => ({ ...prev, [userId]: { ...(prev[userId] || unitManagement.find(u => u.利用者ID === userId && u.年月 === unitInputMonth) || { 年月: unitInputMonth, 利用者ID: userId, 氏名: unitManagement.find(u => u.利用者ID === userId)?.氏名 || '', 所属ユニット: unitManagement.find(u => u.利用者ID === userId)?.所属ユニット || '', 月額預り金: 0, 家賃: 0, 家賃補助: 0, 日用品費: 0, 修繕積立金: 0, 朝食費: 0, 昼食費: 0, 夕食費: 0, 行事食: 0, 共益費: 0, 金銭管理費: 0, 火災保険: 0, 食材費: 0, ステータス: '通常', 備考: '' }), [field]: value } }));
  };
  const getUnitValue = (userId: string) => pendingUnitChanges[userId] || unitManagement.find(u => u.利用者ID === userId && u.年月 === unitInputMonth) || { 年月: unitInputMonth, 利用者ID: userId, 氏名: '', 所属ユニット: '', 月額預り金: 0, 家賃: 0, 家賃補助: 0, 日用品費: 0, 修繕積立金: 0, 朝食費: 0, 昼食費: 0, 夕食費: 0, 行事食: 0, 共益費: 0, 金銭管理費: 0, 火災保険: 0, 食材費: 0, ステータス: '通常', 備考: '' };

  const saveUnitManagement = async () => {
    if (!unitInputMonth) return;
    setLoading(true); try {
      const updates = Object.values(pendingUnitChanges).filter(u => u.年月 === unitInputMonth);
      if (updates.length) {
        const unitMap = new Map(unitManagement.map(u => [`${u.年月}_${u.利用者ID}`, u]));
        updates.forEach(u => unitMap.set(`${u.年月}_${u.利用者ID}`, u));
        const final = Array.from(unitMap.values());
        await writeUnitManagement(spreadsheetId, final);
        setUnitManagement(final); setPendingUnitChanges({}); setSuccessMessage(`✅ 保存しました`);
      }
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  // --- Rendering Functions ---
  const renderMealInput = () => {
    const activeUsers = unitManagement.filter(u => u.年月 === mealInputMonth).sort((a, b) => a.利用者ID.localeCompare(b.利用者ID));
    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select value={mealInputMonth} onChange={(e) => { setMealInputMonth(e.target.value); setPendingMealChanges({}); }} className="block w-40 rounded-md border-gray-300 shadow-sm p-2 border">
              {Array.from(new Set(unitManagement.map(u => u.年月))).sort(sortByFiscalYear as any).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button onClick={saveMealCounts} disabled={!Object.keys(pendingMealChanges).length || loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm disabled:bg-gray-400">保存する</button>
        </div>
        <div className="bg-white shadow border sm:rounded-lg overflow-x-auto"><table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium uppercase">氏名 / ユニット</th><th className="px-4 py-3 text-center">朝食</th><th className="px-4 py-3 text-center">昼食</th><th className="px-4 py-3 text-center">夕食</th><th className="px-4 py-3 text-center">行事食</th><th className="px-6 py-3">備考</th></tr></thead>
          <tbody className="bg-white divide-y divide-gray-200">{activeUsers.map(user => { const m = getMealValue(user.利用者ID); return (<tr key={user.利用者ID}><td className="px-6 py-4"><div>{user.氏名}</div><div className="text-xs text-gray-500">{user.所属ユニット}</div></td><td className="px-2 py-4 text-center"><input type="number" className="w-16 text-center border p-1" value={m.朝食} onChange={e => handleMealInputChange(user.利用者ID, '朝食', Number(e.target.value))} /></td><td className="px-2 py-4 text-center"><input type="number" className="w-16 text-center border p-1" value={m.昼食} onChange={e => handleMealInputChange(user.利用者ID, '昼食', Number(e.target.value))} /></td><td className="px-2 py-4 text-center"><input type="number" className="w-16 text-center border p-1" value={m.夕食} onChange={e => handleMealInputChange(user.利用者ID, '夕食', Number(e.target.value))} /></td><td className="px-2 py-4 text-center"><input type="number" className="w-16 text-center border p-1" value={m.行事食} onChange={e => handleMealInputChange(user.利用者ID, '行事食', Number(e.target.value))} /></td><td className="px-6 py-4"><input type="text" className="w-full border p-1" value={m.備考 || ''} onChange={e => handleMealInputChange(user.利用者ID, '備考', e.target.value)} /></td></tr>); })}</tbody>
        </table></div>
      </div>
    );
  };

  const renderUnitInput = () => {
    const activeUsers = unitManagement.filter(u => u.年月 === unitInputMonth).sort((a, b) => a.利用者ID.localeCompare(b.利用者ID));
    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center justify-between">
          <select value={unitInputMonth} onChange={(e) => { setUnitInputMonth(e.target.value); setPendingUnitChanges({}); }} className="block w-40 rounded-md border-gray-300 shadow-sm p-2 border">
            {Array.from(new Set(unitManagement.map(u => u.年月))).sort(sortByFiscalYear as any).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={saveUnitManagement} disabled={!Object.keys(pendingUnitChanges).length || loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm disabled:bg-gray-400">保存する</button>
        </div>
        <div className="bg-white shadow border sm:rounded-lg overflow-x-auto overflow-y-auto max-h-[70vh]"><table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10"><tr><th className="px-4 py-3 text-left text-xs sticky left-0 bg-gray-50 z-20">氏名 / ユニット</th><th className="px-2 py-3">預り金</th><th className="px-2 py-3">家賃</th><th className="px-2 py-3">賃補</th><th className="px-2 py-3">日用品</th><th className="px-2 py-3">修繕</th><th className="px-2 py-3">朝単</th><th className="px-2 py-3">昼単</th><th className="px-2 py-3">夕単</th><th className="px-2 py-3">行単</th><th className="px-2 py-3">共益</th><th className="px-2 py-3">管</th><th className="px-2 py-3">保</th><th className="px-2 py-3">食</th><th className="px-4 py-3">備考</th></tr></thead>
          <tbody className="bg-white divide-y divide-gray-200">{activeUsers.map(user => { const uData = getUnitValue(user.利用者ID); return (<tr key={user.利用者ID} className="hover:bg-gray-50"><td className="px-4 py-4 sticky left-0 bg-white z-10 border-r border-gray-100 shadow-sm"><div>{user.氏名}</div><div className="text-xs text-gray-500">{user.所属ユニット}</div></td>
            <td><input type="number" className="w-24 border p-1" value={uData.月額預り金} onChange={e => handleUnitInputChange(user.利用者ID, '月額預り金', Number(e.target.value))} /></td>
            <td><input type="number" className="w-24 border p-1" value={uData.家賃} onChange={e => handleUnitInputChange(user.利用者ID, '家賃', Number(e.target.value))} /></td>
            <td><input type="number" className="w-20 border p-1" value={uData.家賃補助} onChange={e => handleUnitInputChange(user.利用者ID, '家賃補助', Number(e.target.value))} /></td>
            <td><input type="number" className="w-20 border p-1" value={uData.日用品費} onChange={e => handleUnitInputChange(user.利用者ID, '日用品費', Number(e.target.value))} /></td>
            <td><input type="number" className="w-20 border p-1" value={uData.修繕積立金} onChange={e => handleUnitInputChange(user.利用者ID, '修繕積立金', Number(e.target.value))} /></td>
            <td><input type="number" className="w-16 border p-1" value={uData.朝食費} onChange={e => handleUnitInputChange(user.利用者ID, '朝食費', Number(e.target.value))} /></td>
            <td><input type="number" className="w-16 border p-1" value={uData.昼食費} onChange={e => handleUnitInputChange(user.利用者ID, '昼食費', Number(e.target.value))} /></td>
            <td><input type="number" className="w-16 border p-1" value={uData.夕食費} onChange={e => handleUnitInputChange(user.利用者ID, '夕食費', Number(e.target.value))} /></td>
            <td><input type="number" className="w-16 border p-1" value={uData.行事食} onChange={e => handleUnitInputChange(user.利用者ID, '行事食', Number(e.target.value))} /></td>
            <td><input type="number" className="w-16 border p-1" value={uData.共益費} onChange={e => handleUnitInputChange(user.利用者ID, '共益費', Number(e.target.value))} /></td>
            <td><input type="number" className="w-20 border p-1" value={uData.金銭管理費} onChange={e => handleUnitInputChange(user.利用者ID, '金銭管理費', Number(e.target.value))} /></td>
            <td><input type="number" className="w-20 border p-1" value={uData.火災保険} onChange={e => handleUnitInputChange(user.利用者ID, '火災保険', Number(e.target.value))} /></td>
            <td><input type="number" className="w-16 border p-1" value={uData.食材費} onChange={e => handleUnitInputChange(user.利用者ID, '食材費', Number(e.target.value))} /></td>
            <td><input type="text" className="w-full border p-1" value={uData.備考 || ''} onChange={e => handleUnitInputChange(user.利用者ID, '備考', e.target.value)} /></td></tr>); })}</tbody>
        </table></div>
      </div>
    );
  };

  const handlePrint = (summary: UserSummary) => { setPrintingUsers([summary]); setTimeout(() => window.print(), 100); };
  const handlePrintAll = (summaries: UserSummary[]) => { setPrintingUsers(summaries); setTimeout(() => window.print(), 100); };
  const toggleUserExpansion = (userId: string) => { const n = new Set(expandedUsers); if (n.has(userId)) n.delete(userId); else n.add(userId); setExpandedUsers(n); };

  const renderTable = () => {
    if (activeTab === 'mealInput') return renderMealInput();
    if (activeTab === 'unitInput') return renderUnitInput();
    const tabs = [
      { id: 'unitManagement', label: 'ユニット管理', data: unitManagement }, { id: 'unitMaster', label: 'ユニットマスタ', data: unitMaster },
      { id: 'unitUtilityCost', label: 'ユニット別光熱費', data: unitUtilityCost }, { id: 'mealCount', label: '食数計算(参照)', data: mealCount },
      { id: 'refundDetail', label: '還元金明細', data: refundDetail }, { id: 'userSummary', label: '利用者別サマリー', data: userSummaries },
    ];
    if (activeTab === 'userSummary') {
      const months = Array.from(new Set(userSummaries.flatMap(s => s.月別データ.map(m => m.年月)))).sort(sortByFiscalYear as any);
      const latestFY = months.length > 0 ? getFiscalYear(months[months.length - 1]) : 0;
      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 py-6 px-8 rounded-3xl shadow-xl text-white flex items-center justify-between">
            <div><h2 className="text-2xl font-black">{latestFY ? `令和${latestFY - 2018 === 1 ? '元' : latestFY - 2018}年度 還元金サマリー` : '利用者別サマリー'}</h2></div>
            <div className="flex items-center gap-4"><label className="text-xs font-bold uppercase opacity-80">対象期間</label>
              <select value={summaryEndMonth} onChange={(e) => setSummaryEndMonth(e.target.value)} className="bg-white text-slate-900 rounded-xl px-4 py-2 text-sm outline-none border-none">
                <option value="all">通年（すべて）</option>{months.map(m => <option key={m} value={m}>{m} まで</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end mb-4"><button onClick={() => handlePrintAll(filteredSummaries)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"><Printer className="w-5 h-5" />一括印刷</button></div>
          <div className="space-y-3">{filteredSummaries.map(s => {
            const exp = expandedUsers.has(s.利用者ID);
            return (
              <div key={s.利用者ID} className="bg-white/80 border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <button onClick={() => toggleUserExpansion(s.利用者ID)} className="w-full px-6 py-5 flex items-center justify-between group">
                  <div className="flex items-center gap-4"><Users className="w-5 h-5 text-blue-600" /><div><p className="font-bold text-lg">{s.氏名} 様</p><p className="text-[10px] text-slate-400">ID: {s.利用者ID}</p></div></div>
                  <div className="flex items-center gap-6"><button onClick={e => { e.stopPropagation(); handlePrint(s); }} className="p-3 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"><Printer className="w-5 h-5" /></button>
                  <div className="hidden lg:grid grid-cols-5 gap-4">
                    <div className="text-right border-r px-4"><p className="text-[9px] text-slate-400">預り金</p><p className="text-sm font-bold text-blue-600">{s.年間預り金合計.toLocaleString()}</p></div>
                    <div className="text-right border-r px-4"><p className="text-[9px] text-slate-400">支出</p><p className="text-sm font-bold text-orange-600">{s.年間支出合計.toLocaleString()}</p></div>
                    <div className="text-right border-r px-4"><p className="text-[9px] text-slate-400">前年度繰越</p><p className="text-sm font-bold text-purple-600">{s.前年度繰越金.toLocaleString()}</p></div>
                    <div className="text-right border-r px-4"><p className="text-[9px] text-slate-400">繰越金</p><p className="text-sm font-bold text-red-600">-{s.繰越金.toLocaleString()}</p></div>
                    <div className="text-right px-4"><p className="text-[9px] text-slate-400">還元金</p><p className="text-lg font-black text-emerald-600">{s.最終還元金.toLocaleString()}</p></div>
                  </div>{exp ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}</div>
                </button>
                {exp && <div className="p-6 bg-slate-50 border-t overflow-x-auto"><table className="min-w-full divide-y text-xs font-mono"><thead><tr><th>年月</th><th>預り金</th><th>家賃</th><th>賃補</th><th>光熱</th><th>朝食</th><th>昼食</th><th>夕食</th><th>修繕</th><th>日用</th><th>共益</th><th>管</th><th>保</th><th>食材</th><th>計</th></tr></thead><tbody className="divide-y">{s.月別データ.map((r: any, idx) => (<tr key={idx}><td>{r.年月}</td><td className="text-right">{r.月額預り金.toLocaleString()}</td><td className="text-right">{r.家賃.toLocaleString()}</td><td className="text-right">({r.家賃補助.toLocaleString()})</td><td className="text-right">{r.光熱費.toLocaleString()}</td><td className="text-right">{r.朝食費.toLocaleString()}</td><td className="text-right">{r.昼食費.toLocaleString()}</td><td className="text-right">{r.夕食費.toLocaleString()}</td><td className="text-right">{r.修繕積立.toLocaleString()}</td><td className="text-right">{r.日用品.toLocaleString()}</td><td className="text-right">{r.共益費.toLocaleString()}</td><td className="text-right">{r.金銭管理費.toLocaleString()}</td><td className="text-right">{r.火災保険.toLocaleString()}</td><td className="text-right">{r.食材費.toLocaleString()}</td><td className="text-right font-bold text-emerald-600">{r.当月還元金合計.toLocaleString()}</td></tr>))}</tbody></table></div>}
              </div>
            );
          })}</div>
        </div>
      );
    }
    const data = tabs.find(t => t.id === activeTab)?.data || [];
    const heads = data.length > 0 ? Object.keys(data[0]).filter(k => typeof (data[0] as any)[k] !== 'object' || (data[0] as any)[k] === null) : [];
    return (<div className="overflow-x-auto rounded-3xl border bg-white shadow-xl"><table className="min-w-full divide-y divide-slate-100"><thead><tr className="bg-slate-50">{heads.map(h => <th key={h} className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">{h}</th>)}</tr></thead><tbody className="divide-y font-mono">{data.map((row: any, i) => (<tr key={i} className="hover:bg-blue-50 transition-colors">{heads.map(h => <td key={h} className="px-6 py-4 text-sm text-slate-600">{typeof row[h] === 'number' ? row[h].toLocaleString() : row[h] || '-'}</td>)}</tr>))}</tbody></table></div>);
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-[1600px] mx-auto px-6 py-10 no-print">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
          <div><div className="flex items-center gap-4 mb-2"><div className="bg-blue-600 p-2 rounded-xl text-white"><FileSpreadsheet /></div><h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-800">還元金計算ツール v2.5</h1></div><p className="text-slate-400 font-bold ml-1">Elderly Care Unit Refund Management</p></div>
          <div className="bg-white/80 backdrop-blur rounded-3xl p-6 shadow-xl border flex gap-3 min-w-[400px]">
            <input type="text" value={spreadsheetId} onChange={e => setSpreadsheetId(e.target.value)} placeholder="Spreadsheet ID..." className="flex-1 rounded-2xl bg-slate-50 px-4 py-3 border text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100" />
            <button onClick={loadAllData} disabled={loading} className="bg-slate-900 text-white px-6 rounded-2xl font-black hover:bg-black transition-all">Load</button>
          </div>
        </header>
        {error && <div className="mb-8 bg-rose-50 border-2 border-rose-100 rounded-3xl p-6 flex items-center gap-4 text-rose-900 font-bold"><AlertTriangle />{error}</div>}
        {successMessage && <div className="mb-8 bg-emerald-50 border-2 border-emerald-100 rounded-3xl p-6 text-emerald-900 font-black">✓ {successMessage}</div>}
        <div className="bg-white/60 backdrop-blur rounded-[40px] shadow-2xl border overflow-hidden mb-12">
          <div className="px-8 border-b flex gap-2 overflow-x-auto no-scrollbar">{['unitManagement', 'mealInput', 'unitInput', 'unitMaster', 'unitUtilityCost', 'mealCount', 'refundDetail', 'userSummary'].map(id => (
            <button key={id} onClick={() => setActiveTab(id)} className={`py-6 px-6 font-black text-sm transition-all relative ${activeTab === id ? 'text-blue-600' : 'text-slate-400'}`}>
              {{ unitManagement: 'ユニット管理', mealInput: '食数入力', unitInput: 'ユニット入力', unitMaster: 'ユニットマスタ', unitUtilityCost: '光熱費', mealCount: '食数参照', refundDetail: '明細', userSummary: 'サマリー' }[id]}
              {activeTab === id && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-blue-500 rounded-t-full"></div>}
            </button>
          ))}</div>
          <div className="p-10">
            {activeTab === 'refundDetail' && <div className="mb-10 flex gap-4"><button onClick={calculateRefunds} className="bg-slate-900 text-white px-10 py-5 rounded-3xl flex items-center gap-3 font-black text-lg shadow-xl"><Calculator />計算実行</button><button onClick={writeToSheet} className="bg-emerald-600 text-white px-10 rounded-3xl flex items-center gap-3 font-black text-lg shadow-xl"><Save />保存</button></div>}
            {renderTable()}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 mb-20">
          {unitChanges.length > 0 && <div className="bg-amber-50 p-8 rounded-[40px] border"><h3>移動検出</h3>{unitChanges.map((c, i) => <div key={i} className="mt-2 text-sm">{c.氏名}: {c.変更履歴.map(h => `${h.年月} ${h.変更前}→${h.変更後}`).join(', ')}</div>)}</div>}
          {validationWarnings.length > 0 && <div className="bg-orange-50 p-8 rounded-[40px] border"><h3>データ品質警告</h3>{validationWarnings.map((w, i) => <div key={i} className="text-xs mt-1 text-slate-600">{w.message}</div>)}</div>}
        </div>
      </div>
      <div className="print-only">
        {printingUsers.length > 0 && printingUsers.map((user, uIdx) => (
          <div key={user.利用者ID} className={`print-page ${uIdx < printingUsers.length - 1 ? 'page-break' : ''}`}>
             <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-4">
                <div><h1 className="text-3xl font-black">還元金明細書</h1></div>
                <div className="text-right"><p className="text-[10px] text-slate-400 uppercase">作成日: {new Date().toLocaleDateString('ja-JP')}</p><h2 className="text-2xl font-black">{user.氏名} 様</h2></div>
             </div>
             <p className="text-xs mb-4 font-bold">対象期間: {user.月別データ[0]?.年月} 〜 {user.月別データ[user.月別データ.length - 1]?.年月}</p>
             <table className="w-full border-collapse border-black border-2 text-[9px]">
               <thead><tr className="bg-slate-100"><th className="border border-black p-1">年月</th><th className="border border-black p-1">預り金</th><th className="border border-black p-1">家賃</th><th className="border border-black p-1">賃補</th><th className="border border-black p-1">共益費</th><th className="border border-black p-1">光熱費</th><th className="border border-black p-1">食費計</th><th className="border border-black p-1">日用品</th><th className="border border-black p-1">修繕</th><th className="border border-black p-1">金管</th><th className="border border-black p-1">保険</th><th className="border border-black p-1">食材</th><th className="border border-black p-1 font-black">当月計</th></tr></thead>
               <tbody>{user.月別データ.map((r, i) => (<tr key={i}><td className="border border-black p-1 text-center">{r.年月}</td><td className="border border-black p-1 text-right">{r.月額預り金.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.家賃.toLocaleString()}</td><td className="border border-black p-1 text-right text-[8px]">({r.家賃補助.toLocaleString()})</td><td className="border border-black p-1 text-right">{r.共益費.toLocaleString()}</td><td className="border border-black p-1 text-right font-bold">{r.光熱費.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.食費合計.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.日用品.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.修繕積立.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.金銭管理費.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.火災保険.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.食材費.toLocaleString()}</td><td className="border border-black p-1 text-right font-black bg-slate-50">{r.当月還元金合計.toLocaleString()}</td></tr>))}</tbody>
               <tfoot><tr className="bg-slate-200 font-black"><td className="border border-black p-1 text-center">合計</td><td className="border border-black p-1 text-right">{user.年間預り金合計.toLocaleString()}</td><td className="border border-black p-1" colSpan={10}></td><td className="border border-black p-1 text-right">{user.年間還元金合計.toLocaleString()}</td></tr></tfoot>
             </table>
             <div className="mt-4 flex justify-between gap-10">
               <div className="w-1/2 border-2 border-black p-4 rounded-xl h-24 relative"><p className="text-[10px] text-slate-300 absolute top-1 left-2 uppercase">Notes</p></div>
               <div className="w-2/5 space-y-1 font-bold text-xs">
                 <div className="flex justify-between border-b py-0.5"><span>年間預り金</span><span>{user.年間預り金合計.toLocaleString()} 円</span></div>
                 <div className="flex justify-between border-b py-0.5"><span>年間支出計</span><span>{user.年間支出合計.toLocaleString()} 円</span></div>
                 <div className="flex justify-between border-b py-0.5"><span>年間還元計</span><span>{user.年間還元金合計.toLocaleString()} 円</span></div>
                 <div className="flex justify-between pt-1"><span>前年度繰越</span><span>{user.前年度繰越金.toLocaleString()} 円</span></div>
                 <div className="flex justify-between border-b-2 border-black text-rose-600"><span>繰越金</span><span>-{user.繰越金.toLocaleString()} 円</span></div>
                 <div className="flex justify-between text-lg font-black pt-2 border-b-4 border-double border-black uppercase"><span>還元金　合計</span><span>{user.最終還元金.toLocaleString()} 円</span></div>
               </div>
             </div>
             <div className="mt-2 text-right">
               <p className="text-[10px] font-bold">発行元：特定非営利活動法人ビハーラ２１</p>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

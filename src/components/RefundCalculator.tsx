import { useState } from 'react';
import { FileSpreadsheet, Calculator, Download, Save, AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';
import {
  UserMaster,
  UnitManagement,
  UnitMaster,
  UnitUtilityCost,
  MealCount,
  RefundDetail,
} from '../types/schemas';
import {
  fetchUserMaster,
  fetchUnitManagement,
  fetchUnitMaster,
  fetchUnitUtilityCost,
  fetchMealCount,
  fetchRefundDetail,
  writeRefundDetail,
} from '../services/sheetsService';

interface CalculatedRefund extends RefundDetail {
  calculated: boolean;
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
  const [activeTab, setActiveTab] = useState<string>('userMaster');

  const [userMaster, setUserMaster] = useState<UserMaster[]>([]);
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
      summary.年間支出合計 += refund.家賃 + refund.日用品 + refund.修繕積立 +
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
        userMasterData,
        unitManagementData,
        unitMasterData,
        unitUtilityCostData,
        mealCountData,
        refundDetailData,
      ] = await Promise.all([
        fetchUserMaster(spreadsheetId),
        fetchUnitManagement(spreadsheetId),
        fetchUnitMaster(spreadsheetId),
        fetchUnitUtilityCost(spreadsheetId),
        fetchMealCount(spreadsheetId),
        fetchRefundDetail(spreadsheetId),
      ]);

      console.log('Data loaded successfully:', {
        userMaster: userMasterData.length,
        unitManagement: unitManagementData.length,
        unitMaster: unitMasterData.length,
        unitUtilityCost: unitUtilityCostData.length,
        mealCount: mealCountData.length,
        refundDetail: refundDetailData.length,
      });

      setUserMaster(userMasterData);
      setUnitManagement(unitManagementData);
      setUnitMaster(unitMasterData);
      setUnitUtilityCost(unitUtilityCostData);
      setMealCount(mealCountData);
      setRefundDetail(refundDetailData.map(r => ({ ...r, calculated: false })));

      const changes = detectUnitChanges(unitManagementData);
      setUnitChanges(changes);
      console.log('🔄 ユニット変更検出:', changes);

      const warnings = validateData(unitManagementData, unitUtilityCostData, mealCountData);
      setValidationWarnings(warnings);
      console.log('⚠️ データ検証:', warnings.length > 0 ? `${warnings.length}件の警告` : '問題なし');

      if (userMasterData.length === 0) {
        setError('警告: 利用者マスタにデータがありません。シート名とデータを確認してください。');
      }
    } catch (err) {
      console.error('Error loading data:', err);
      const errorMessage = err instanceof Error ? err.message : 'データの読み込みに失敗しました';
      setError(`エラー: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateRefunds = () => {
    if (!unitManagement.length || !userMaster.length) {
      setError('データを先に読み込んでください');
      return;
    }

    console.log('🔄 還元金計算を開始...');
    console.log('利用可能なデータ:', {
      unitManagement: unitManagement.length,
      userMaster: userMaster.length,
      unitMaster: unitMaster.length,
      unitUtilityCost: unitUtilityCost.length,
      mealCount: mealCount.length,
    });

    const unitMemberCount: Record<string, number> = {};
    unitManagement.forEach((um) => {
      const key = `${um.年月}_${um.所属ユニット}`;
      unitMemberCount[key] = (unitMemberCount[key] || 0) + 1;
    });

    console.log('📋 ユニット別人数:', unitMemberCount);

    let successCount = 0;
    let warningCount = 0;

    const calculated: CalculatedRefund[] = unitManagement.map((um, index) => {
      const user = userMaster.find((u) => u.利用者ID === um.利用者ID);
      const unit = unitMaster.find((u) => u.ユニット名 === um.所属ユニット);
      const utility = unitUtilityCost.find(
        (u) => u.ユニット名 === um.所属ユニット && u.年月 === um.年月
      );
      const meal = mealCount.find(
        (m) => m.利用者ID === um.利用者ID && m.月 === um.年月
      );

      const unitKey = `${um.年月}_${um.所属ユニット}`;
      const ユニット人数 = unitMemberCount[unitKey] || 1;

      const hasAllData = user && unit && utility && meal;
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
        利用者マスタ: user ? '✓' : '✗',
        ユニットマスタ: unit ? '✓' : '✗',
        光熱費データ: utility ? '✓' : '✗',
        食数データ: meal ? '✓' : '✗',
        ユニット人数: `${ユニット人数}人`,
      });

      const 月額預り金 = user?.月額預り金 || 0;
      const 家賃補助 = user?.家賃補助 || 0;
      const 日用品 = user?.日用品費 || 0;
      const 修繕積立 = user?.修繕積立金 || 0;

      const 朝食回数 = meal?.朝食 || 0;
      const 昼食回数 = meal?.昼食 || 0;
      const 夕食回数 = meal?.夕食 || 0;
      const 行事食回数 = meal?.行事食 || 0;

      const 朝食単価 = user?.朝食費 || 0;
      const 昼食単価 = user?.昼食費 || 0;
      const 夕食単価 = user?.夕食費 || 0;
      const 行事食単価 = user?.行事食 || 0;

      const 食費合計 =
        (朝食回数 * 朝食単価) +
        (昼食回数 * 昼食単価) +
        (夕食回数 * 夕食単価) +
        (行事食回数 * 行事食単価);

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

      const 金銭管理費 = user?.金銭管理費 || 0;
      const 火災保険 = user?.火災保険 || 0;

      const 当月還元金合計 = 月額預り金 - 家賃補助 - 日用品 - 修繕積立 - 食費合計 - 光熱費 - 金銭管理費 - 火災保険;

      if (index === 0) {
        console.log(`📊 計算例 (${um.氏名}):`, {
          月額預り金: `${月額預り金.toLocaleString()}円`,
          家賃補助: `${家賃補助.toLocaleString()}円`,
          日用品: `${日用品.toLocaleString()}円`,
          修繕積立: `${修繕積立.toLocaleString()}円`,
          食費: `朝${朝食回数}回×${朝食単価}円 + 昼${昼食回数}回×${昼食単価}円 + 夕${夕食回数}回×${夕食単価}円 + 行事${行事食回数}回×${行事食単価}円 = ${食費合計.toLocaleString()}円`,
          光熱費: `${光熱費総額.toLocaleString()}円 × ${按分率}% ÷ ${ユニット人数}人 = ${光熱費.toLocaleString()}円`,
          金銭管理費: `${金銭管理費.toLocaleString()}円`,
          火災保険: `${火災保険.toLocaleString()}円`,
          計算式: `${月額預り金.toLocaleString()} - ${家賃補助.toLocaleString()} - ${日用品.toLocaleString()} - ${修繕積立.toLocaleString()} - ${食費合計.toLocaleString()} - ${Math.round(光熱費).toLocaleString()} - ${金銭管理費.toLocaleString()} - ${火災保険.toLocaleString()}`,
          還元金: `${当月還元金合計.toLocaleString()}円`,
        });
      }

      const result = {
        年月: um.年月,
        利用者ID: um.利用者ID,
        氏名: um.氏名,
        所属ユニット: um.所属ユニット,
        月額預り金: Math.round(月額預り金),
        家賃: Math.round(家賃補助),
        日用品: Math.round(日用品),
        修繕積立: Math.round(修繕積立),
        食費合計: Math.round(食費合計),
        光熱費: Math.round(光熱費),
        金銭管理費: Math.round(金銭管理費),
        火災保険: Math.round(火災保険),
        繰越金: 0,
        当月還元金合計: Math.round(当月還元金合計),
        calculated: true,
      };

      return result;
    });

    const totalRefund = calculated.reduce((sum, r) => sum + r.当月還元金合計, 0);

    console.log(`✅ 計算完了: ${calculated.length}件 (成功: ${successCount}, 警告: ${warningCount})`);
    console.log('計算結果サマリー:', {
      総預り金: calculated.reduce((sum, r) => sum + r.月額預り金, 0).toLocaleString() + '円',
      総支出: calculated.reduce((sum, r) => sum + (r.家賃 + r.日用品 + r.修繕積立 + r.食費合計 + r.光熱費 + r.金銭管理費 + r.火災保険), 0).toLocaleString() + '円',
      総還元金: totalRefund.toLocaleString() + '円',
    });

    setRefundDetail(calculated);

    const summaries = generateUserSummaries(calculated);
    setUserSummaries(summaries);
    console.log('📊 利用者別サマリー生成:', summaries.length, '名');

    setActiveTab('refundDetail');

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

      const refundsToWrite: RefundDetail[] = refundDetail.map((r) => ({
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

  const tabs = [
    { id: 'userMaster', label: '利用者マスタ', data: userMaster },
    { id: 'unitManagement', label: 'ユニット管理', data: unitManagement },
    { id: 'unitMaster', label: 'ユニットマスタ', data: unitMaster },
    { id: 'unitUtilityCost', label: 'ユニット別光熱費', data: unitUtilityCost },
    { id: 'mealCount', label: '食数計算', data: mealCount },
    { id: 'refundDetail', label: '還元金明細', data: refundDetail },
    { id: 'userSummary', label: '利用者別サマリー', data: userSummaries },
  ];

  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const renderTable = () => {
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
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">年月</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">ユニット</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">預り金</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">家賃</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">光熱費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">食費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">その他</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">還元金</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {summary.月別データ.map((month, idx) => {
                            const その他 = month.日用品 + month.修繕積立 + month.金銭管理費 + month.火災保険;
                            const unitData = unitMaster.find(u => u.ユニット名 === month.所属ユニット);
                            const 実際の家賃 = unitData?.家賃 || 0;
                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-900">{month.年月}</td>
                                <td className="px-4 py-2 text-gray-900">{month.所属ユニット}</td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {month.月額預り金.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {実際の家賃.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {month.光熱費.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {month.食費合計.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-600">
                                  {その他.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-green-600">
                                  {month.当月還元金合計.toLocaleString()}
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

    const headers = Object.keys(activeData[0]).filter(key => key !== 'calculated');
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
                  {calculatedData.reduce((sum, r) => sum + (r.家賃 + r.日用品 + r.修繕積立 + r.食費合計 + r.光熱費 + r.金銭管理費 + r.火災保険), 0).toLocaleString()}円
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
            <thead className="bg-gray-50">
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
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="スプレッドシートのIDを入力"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={loadAllData}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              {loading ? '読み込み中...' : 'データ読み込み'}
            </button>
            <button
              onClick={calculateRefunds}
              disabled={loading || !userMaster.length}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Calculator className="w-4 h-4" />
              還元金計算
            </button>
            <button
              onClick={writeToSheet}
              disabled={loading || !refundDetail.length}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              {loading ? '書き込み中...' : 'シートに書き込み'}
            </button>
          </div>
          <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-100">
            <p className="font-medium mb-1">必要なシート名:</p>
            <div className="grid grid-cols-2 gap-1">
              <span>• 利用者マスタ</span>
              <span>• ユニット管理</span>
              <span>• ユニットマスタ</span>
              <span>• ユニット別光熱費</span>
              <span>• 食数計算</span>
              <span>• 還元金明細</span>
            </div>
            <p className="mt-2 text-gray-500">ブラウザのコンソール(F12)でデバッグ情報を確認できます</p>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">{error}</p>
          )}

          {successMessage && (
            <p className="mt-3 text-sm text-green-700 bg-green-50 p-3 rounded border border-green-200 font-medium">{successMessage}</p>
          )}

          {(userMaster.length > 0 || unitManagement.length > 0) && (
            <div className="mt-3 text-xs bg-green-50 p-3 rounded border border-green-200">
              <p className="font-medium text-green-800 mb-2">読み込み完了:</p>
              <div className="grid grid-cols-3 gap-2 text-gray-700">
                <span>利用者マスタ: {userMaster.length}件</span>
                <span>ユニット管理: {unitManagement.length}件</span>
                <span>ユニットマスタ: {unitMaster.length}件</span>
                <span>光熱費: {unitUtilityCost.length}件</span>
                <span>食数計算: {mealCount.length}件</span>
                <span>還元金明細: {refundDetail.length}件</span>
              </div>
              {userMaster.length > 0 && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <p className="text-green-800 font-medium">サンプル (利用者マスタ 1件目):</p>
                  <div className="mt-1 text-gray-600 bg-white p-2 rounded">
                    <p>利用者ID: {userMaster[0].利用者ID}, 氏名: {userMaster[0].氏名}</p>
                    <p>月額預り金: {userMaster[0].月額預り金.toLocaleString()}円, 家賃補助: {userMaster[0].家賃補助.toLocaleString()}円</p>
                    <p>朝食費: {userMaster[0].朝食費}円, 昼食費: {userMaster[0].昼食費}円, 夕食費: {userMaster[0].夕食費}円</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {validationWarnings.length > 0 && (
            <div className="mt-3 text-xs bg-yellow-50 p-3 rounded border border-yellow-200 max-h-64 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <p className="font-medium text-yellow-800">
                  データ検証: {validationWarnings.length}件の警告が見つかりました
                </p>
              </div>
              <ul className="space-y-1 text-gray-700">
                {validationWarnings.slice(0, 50).map((warning, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-0.5">•</span>
                    <div>
                      <span className="font-medium">{warning.message}</span>
                      {warning.details && (
                        <span className="text-gray-500 ml-2">({warning.details})</span>
                      )}
                    </div>
                  </li>
                ))}
                {validationWarnings.length > 50 && (
                  <li className="text-gray-500 italic">
                    ...他 {validationWarnings.length - 50} 件の警告
                  </li>
                )}
              </ul>
            </div>
          )}

          {unitChanges.length > 0 && (
            <div className="mt-3 text-xs bg-blue-50 p-3 rounded border border-blue-200">
              <p className="font-medium text-blue-800 mb-2">
                ユニット変更検出: {unitChanges.length}名の利用者にユニット変更がありました
              </p>
              <div className="space-y-2">
                {unitChanges.map((change) => (
                  <div key={change.利用者ID} className="bg-white p-2 rounded border border-blue-100">
                    <p className="font-medium text-gray-900 mb-1">
                      {change.氏名} (ID: {change.利用者ID})
                    </p>
                    <div className="space-y-1 text-gray-700">
                      {change.変更履歴.map((history, idx) => (
                        <p key={idx} className="flex items-center gap-2">
                          <span className="text-blue-600">→</span>
                          <span>
                            {history.年月}: <span className="text-orange-600">{history.変更前}</span>
                            <span className="mx-1">→</span>
                            <span className="text-green-600">{history.変更後}</span>
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {tab.label}
                  {tab.data.length > 0 && (
                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                      {tab.data.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">{renderTable()}</div>
        </div>
      </div>
    </div>
  );
}

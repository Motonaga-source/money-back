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
  // 表示用に追加
  家賃補助: number;
  朝食費: number;
  昼食費: number;
  夕食費: number;
}

// ... (omitted)

const 朝食単価 = user?.朝食費 || 0;
const 昼食単価 = user?.昼食費 || 0;
const 夕食単価 = user?.夕食費 || 0;
const 行事食単価 = user?.行事食 || 0;

const 朝食費 = 朝食回数 * 朝食単価;
const 昼食費 = 昼食回数 * 昼食単価;
const 夕食費 = 夕食回数 * 夕食単価;
const 行事食費 = 行事食回数 * 行事食単価;

const 食費合計 = 朝食費 + 昼食費 + 夕食費 + 行事食費;

const 光熱費総額 = utility?.合計 || 0;
// ... (omitted)
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
  家賃: Math.round(実質家賃),
  家賃補助: Math.round(家賃補助), // 追加
  日用品: Math.round(日用品),
  修繕積立: Math.round(修繕積立),
  食費合計: Math.round(食費合計),
  朝食費: Math.round(朝食費), // 追加
  昼食費: Math.round(昼食費), // 追加
  夕食費: Math.round(夕食費 + 行事食費), // 夕食に行事食を含めるか、別途表示するか？ユーザー要望は「朝・昼・夕」なので夕食に含めるか、項目を増やすか。ここでは一旦夕食に含める（または行事食は無視されていた？いや食費合計には入っていた）。要望通り3項目にするなら夕食+行事食が無難かも。
  光熱費: Math.round(光熱費),
  金銭管理費: Math.round(金銭管理費),
  火災保険: Math.round(火災保険),
  繰越金: 0,
  当月還元金合計: Math.round(当月還元金合計),
  calculated: true,
};

return result;
    });

// ... (omitted)

                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">年月</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">ユニット</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">預り金</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">家賃</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">家賃補助</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">光熱費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">朝食費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">昼食費</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">夕食費</th>
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
                                  {r.朝食費.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.昼食費.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {r.夕食費.toLocaleString()}
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

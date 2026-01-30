export interface UnitManagement {
  年月: string;
  利用者ID: string;
  氏名: string;
  所属ユニット: string;
  月額預り金: number;
  家賃: number;
  家賃補助: number;
  日用品費: number;
  修繕積立金: number;
  朝食費: number;
  昼食費: number;
  夕食費: number;
  行事食: number;
  共益費: number;
  金銭管理費: number;
  火災保険: number;
  食材費: number;
  備考: string;
}

export interface UnitMaster {
  ユニット名: string;
  家賃: number;
  光熱費按分率: number;
}

export interface UnitUtilityCost {
  年月: string;
  ユニット名: string;
  電気代: number;
  ガス代: number;
  水道代: number;
  サブ: number;
  合計: number;
}

export interface MealCount {
  月: string;
  利用者ID: string;
  氏名: string;
  ユニット名: string;
  朝食: number;
  昼食: number;
  夕食: number;
  行事食: number;
  備考: string;
}

export interface RefundDetail {
  年月: string;
  利用者ID: string;
  氏名: string;
  所属ユニット: string;
  月額預り金: number;
  家賃: number;
  家賃補助: number;
  共益費: number;
  日用品: number;
  修繕積立: number;
  食費合計: number;
  光熱費: number;
  金銭管理費: number;
  火災保険: number;
  食材費: number;
  繰越金: number;
  当月還元金合計: number;
}

export interface SheetConfig {
  name: string;
  range: string;
}

export const SHEET_CONFIGS: Record<string, SheetConfig> = {
  unitManagement: { name: 'ユニット管理', range: 'A:R' },
  unitMaster: { name: 'ユニットマスタ', range: 'A:C' },
  unitUtilityCost: { name: 'ユニット別光熱費', range: 'A:G' },
  mealCount: { name: '食数計算', range: 'A:I' },
  refundDetail: { name: '還元金明細', range: 'A:Q' },
};

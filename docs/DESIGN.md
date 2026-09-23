# 設計ドキュメント

## 要件

- 年収と家族構成を入力すると、ふるさと納税の控除上限額（概算）を即時表示する。
- 入力・結果はブラウザ内(localStorage)に保存でき、一覧表示・個別削除・全件削除ができる。
- JSON形式でのフルバックアップのエクスポート/インポート、CSV形式（Excel想定、
  BOM付きUTF-8）でのエクスポートができる。
- 外部への通信を行わない（オフラインで完結する）。PWA化し、一度開けば以後は
  オフラインでも起動・計算できる。
- スマホ幅(375px)〜PC幅(1280px以上)でレイアウトが崩れない。

## 画面一覧

1. **トップページ（単一ページ構成）**
   - 入力フォーム（年収・家族構成） → 「計算する」
   - 結果表示（控除上限額・所得税率概算・住民税所得割額概算）→「この結果を保存する」
   - 保存済み記録一覧（テーブル・削除ボタン）
   - エクスポート／インポート操作（CSV／JSON）
   - 免責事項・出典セクション

## データモデル

### 計算入力・出力 (`src/lib/calc.ts`)

```ts
type FamilyType =
  | 'single'
  | 'spouse_no_income'
  | 'spouse_no_income_child1_hs'
  | 'spouse_no_income_child1_univ'
  | 'spouse_no_income_child2_hs_univ'

interface SimulationInput {
  annualIncome: number   // 年収(給与収入額・円)
  familyType: FamilyType
}

interface SimulationResult {
  donationLimit: number         // 控除上限額(概算・円、100円未満切り捨て)
  employmentIncome: number      // 給与所得
  taxableIncomeNational: number // 所得税の課税所得
  taxableIncomeLocal: number    // 住民税の課税所得
  nationalTaxRate: number       // 所得税率(基準)
  localIncomeLeviedTax: number  // 住民税所得割額
}
```

### 保存レコード (`src/lib/storage.ts`, localStorageキー: `furusato-sim.v1`)

```ts
interface SavedRecord {
  id: string           // crypto.randomUUID()
  savedAt: string       // ISO8601
  annualIncome: number
  familyType: FamilyType
  result: SimulationResult
  memo: string          // 現バージョンではUI未実装(将来拡張用。常に空文字)
}
```

## 計算ロジックの設計方針

1. 給与所得 = 年収 − 給与所得控除（2020年改正後の表を使用）
2. 社会保険料控除は年収の15%と仮定する簡易モデル（正確な保険料率は加入状況で変動するため簡略化）
3. 所得税の課税所得 = 給与所得 − 社会保険料控除 − 基礎控除(48万) − 家族構成による控除(所得税ベース)
4. 住民税の課税所得 = 給与所得 − 社会保険料控除 − 基礎控除(43万) − 家族構成による控除(住民税ベース)
5. 住民税所得割額 = 住民税の課税所得(1,000円未満切り捨て) × 10%（調整控除は簡易化のため省略）
6. 控除上限額 = 住民税所得割額 × 20% ÷ (90% − 所得税率 × 1.021) + 2,000円
   （ただし住民税所得割額が0円の場合は上限額も0円とする）

既知の簡略化（README・免責事項にも明記）:
- 調整控除、住宅ローン控除、医療費控除、iDeCo等の個別控除は考慮していない。
- 社会保険料控除は年収の15%という一律の仮定であり、実際の加入状況により変動する。

## 将来の拡張候補（バックログ）

- 保存記録への「メモ」入力UIの追加（現状データモデルのみ存在、入力UI未実装）。
- 個人事業主（青色申告等）向けの入力モードの追加。
- 詳細モード（住民税所得割額を直接入力できるオプション）の追加。

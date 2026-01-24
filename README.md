# 還元金計算ツール

Google Sheetsと連携した還元金計算アプリケーション

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Cloudflare Pages Functions
- **データソース**: Google Sheets API

## プロジェクト構成

```
project/
├── functions/           # Cloudflare Pages Functions
│   └── api/
│       └── sheets.ts   # Google Sheets API エンドポイント
├── src/                # フロントエンドソースコード
│   ├── components/     # Reactコンポーネント
│   ├── services/       # APIクライアント
│   └── types/          # TypeScript型定義
└── dist/               # ビルド出力
```

## 環境変数の設定

### ローカル開発

`.env`ファイルに以下の環境変数を設定してください：

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
SPREADSHEET_ID=your-spreadsheet-id
```

### Cloudflare Pagesでの設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Pages** → プロジェクトを選択
3. **Settings** → **Environment variables**
4. 以下の環境変数を追加：

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Googleサービスアカウントのメールアドレス | `hiroaki@vihara21.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Googleサービスアカウントの秘密鍵（改行を`\n`で表現） | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"` |
| `SPREADSHEET_ID` | Google SpreadsheetsのID | `1ivn7v7axdZsj8LwpzWHcUl0xeaOutYCzkpykDTsrtgY` |

5. **Production**と**Preview**の両方にチェックを入れる
6. 保存後、再デプロイ

## Google Sheets APIの設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Google Sheets APIを有効化
3. サービスアカウントを作成し、JSONキーをダウンロード
4. スプレッドシートをサービスアカウントのメールアドレスと共有（編集権限）

## 開発

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview
```

## デプロイ

### Cloudflare Pagesへのデプロイ

1. GitHubリポジトリをCloudflare Pagesに接続
2. ビルド設定：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `project`
3. 環境変数を設定（上記参照）
4. デプロイ

## APIエンドポイント

### GET `/api/sheets`

スプレッドシートからデータを読み取ります。

**クエリパラメータ:**
- `sheetName` (必須): シート名
- `range` (オプション): 範囲（デフォルト: `A:Z`）

**レスポンス:**
```json
{
  "data": [
    ["列1", "列2", "列3"],
    ["値1", "値2", "値3"]
  ]
}
```

### POST `/api/sheets`

スプレッドシートにデータを書き込みます。

**リクエストボディ:**
```json
{
  "sheetName": "シート名",
  "data": [
    ["値1", "値2", "値3"],
    ["値4", "値5", "値6"]
  ]
}
```

**レスポンス:**
```json
{
  "success": true,
  "updatedRows": 2
}
```

## トラブルシューティング

### エラー: "Server returned HTML instead of JSON"

**原因**: `/api/sheets`エンドポイントが404を返している

**解決策**:
1. `functions/api/sheets.ts`ファイルが存在することを確認
2. Cloudflare Pagesで環境変数が正しく設定されていることを確認
3. 再デプロイを実行

### エラー: "GOOGLE_SERVICE_ACCOUNT_EMAIL is not set"

**原因**: 環境変数が設定されていない

**解決策**:
1. Cloudflare Pages Dashboardで環境変数を確認
2. 変数名が正確に一致していることを確認（大文字小文字を含む）
3. 保存後、必ず再デプロイを実行

### エラー: "Failed to authenticate with Google"

**原因**: サービスアカウントの認証情報が正しくない

**解決策**:
1. `GOOGLE_PRIVATE_KEY`に改行が正しく含まれていることを確認（`\n`）
2. キーが`-----BEGIN PRIVATE KEY-----`と`-----END PRIVATE KEY-----`で囲まれていることを確認
3. サービスアカウントがGoogle Sheets APIへのアクセス権限を持っていることを確認

## ライセンス

Private

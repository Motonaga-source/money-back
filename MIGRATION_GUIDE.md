# Cloudflare Pages Functions 移行完了

## 実施した変更

### 1. ✅ Cloudflare Pages Functions APIの作成

**ファイル**: `functions/api/sheets.ts`

- Google Sheets APIと連携するCloudflare Pages Functionを作成
- JWT認証を使用してGoogleサービスアカウントで認証
- GET（読み取り）とPOST（書き込み）の両方をサポート
- 詳細なエラーログとデバッグ情報を追加

### 2. ✅ フロントエンドAPIクライアントの修正

**ファイル**: `src/services/sheetsService.ts`

**変更内容**:
- Supabase URLを削除し、`/api/sheets`エンドポイントを使用
- `spreadsheetId`パラメータをURLから削除（環境変数で設定）
- エラーハンドリングを強化：
  - HTMLレスポンス（404エラー）を検出
  - JSONとHTMLレスポンスを区別
  - 詳細なエラーメッセージを表示
- デバッグログに絵文字を追加（📖 読み取り、✅ 成功、❌ エラー）

### 3. ✅ 環境変数の統一

**新しい環境変数**:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=hiroaki@vihara21.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
SPREADSHEET_ID=1ivn7v7axdZsj8LwpzWHcUl0xeaOutYCzkpykDTsrtgY
```

**削除した環境変数**:
```
VITE_SUPABASE_URL（不要）
VITE_SUPABASE_ANON_KEY（不要）
```

### 4. ✅ TypeScript型定義の更新

**ファイル**: `src/vite-env.d.ts`

- Supabase関連の型定義を削除
- Cloudflare環境変数の型定義を追加

### 5. ✅ ドキュメントの作成

**ファイル**: 
- `README.md` - セットアップ手順とトラブルシューティング
- `.env.example` - 環境変数のテンプレート

## フォルダ構造

```
project/
├── functions/              # Cloudflare Pages Functions（ルート直下）
│   └── api/
│       └── sheets.ts      # Google Sheets APIエンドポイント
├── src/
│   ├── services/
│   │   └── sheetsService.ts  # APIクライアント（修正済み）
│   └── vite-env.d.ts      # 型定義（更新済み）
├── .env                   # 環境変数（更新済み）
├── .env.example           # 環境変数テンプレート（新規）
└── README.md              # ドキュメント（新規）
```

## 次のステップ：Cloudflare Pagesでの設定

### 1. 環境変数の設定

Cloudflare Pages Dashboardで以下を設定してください：

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Pages** → プロジェクトを選択
3. **Settings** → **Environment variables**
4. 以下の3つの環境変数を追加：

| 変数名 | 値 |
|--------|-----|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `hiroaki@vihara21.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | `"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCJNeIGTS2RPXgs\njbLfwF2x1PmifEygY4fyVeq76NRG30o2ITTTYe8tIUMqVaWT8GBCdoXOwaiQifm/\nA2qeb3sDz50ZEX1Dij0Vfvfw/Jle2Gyr03G+3QlN2b6wC8zaLGXTGVn/sU/l3428\nGMZhR0dhn43jTZee41ZB5KO3Q2tSWXupgnm2HbTJdBtvv0VS+BIiitoY57LWivNL\nsmwczFoTAGfJcBTe6Lq7kbCPAPgubnjChDp60ELRCzPGjCeXWRvJgQInSt2pH/p3\nbJ+mBl5Y6tvaVy4H2139G7A0dITc5IlkmGxuyxMG3gUD1I2QSa6Wa9KLlnTIbL/f\nAWaQOJcbAgMBAAECggEAA5lsFZyRApuEBgMs5eK0HStIOyNwl8/Ulp5QsIo3MKlr\nLHKq4eqn7V1PLOf0lntlQwkR5y5m/2z8e1lvGBCLlQ+CqvrYTYfC+h02YCt4KH1G\nkyv88rP1/6/5E8F+J7D8y3tW7uFWBmKFY3bw6Udcj3/cfHx3auhtcFVmQrNG4vDt\nJf3mglZQ/qo0geOuIkBQ0eOHfpD2ZzRZzge6AVaq1aa7Tc5e4aZYD+EdH7AEGEAm\nwYqGSxSAjQK7Cs9mLqcatWTLxwVnrYiN5imQjT2jMVdSTxbwGcgzq4QXM+O8cgFr\nahIw9EEoSS625VmRay7VPriCKv7mGLAxG1dG9IpcjQKBgQC9cQHA7akeVG1vLSc5\nrLstxlRNqkBvxmy1kskM6v4A0FMn4uof9sigfGtFdTRhUVSZmY0Sy6EJ3KX3S21P\njtZE8oHnh+PuT3QNmoj4lag1tP7N9ZX5kDy6LQolwdZB4x1rSh8F4hJlGvvlm61e\nGlulCGr/xYJM3FkghYpoyOBRDwKBgQC5awzexOhXEv03YIWHFKMIg8VeukfqNrKN\nrfZMABgh3k1PG8HXBcZA+r/rKucnBJM1AJ5uAOqhVpWGTyBiPPvZRbW9mzrzxu+9\nGupYsS/CMaHM9R9vrPVpW7TpVKv2ByzI9BbrCZcRyftG1VvPRwkZlEtLah4FFthc\nu4OawZ1BNQKBgAm60iI8kqESKQS6xvb5Xiu9sfrDMcgL4u14eocFUsJr8LltuCSo\nIinL+h55JJWS/ctdzZcXik/dW1DWOOkLJwongnCH1DcbMZS5SSurVBZeE3A0mt1U\ngSn2wjyqNfzwU0R9bBZ7RAKZXjKuyjq5E9foFMbKOCUGdDVtZmx3VL4VAoGBAJpW\n2We1UBDq5Yvq9Dr0mqDDzs6DEMmMriPw4ktw6KWIfaGT4U4yqEv+bTI7jB2WWVKN\nKVM3wBZ8FAqwYqxjRuAcfqNNS00QEw6+EMOy+aYT2jLY90nmFoGUrIpsyJcKceT0\nCP+sA+vyzQ6xGrL21kRMhEBKHKLv2TmXfHydHWDhAoGBAKt+SB7QZHgaZT4GTRdX\n44cr1iwCodQgGNURY2Mzf/foHJIVJo+Hil2GmC3CF6gSsDBNPBYN2p31y5tgD8vv\nV2f1Nkx8y0Z629Qjq0hcGOSPskhfoAI5jvyxuj6qc+S2Q0bp78Osxq4pvIlUr4K9\nrWQo8MaQpcPxobiXD4JNrgKL\n-----END PRIVATE KEY-----"` |
| `SPREADSHEET_ID` | `1ivn7v7axdZsj8LwpzWHcUl0xeaOutYCzkpykDTsrtgY` |

**重要**: 
- `GOOGLE_PRIVATE_KEY`の値は**ダブルクォートで囲む**必要があります
- 改行は`\n`で表現してください
- **Production**と**Preview**の両方にチェックを入れてください

5. 保存後、**必ず再デプロイを実行**してください

### 2. ビルド設定の確認

Cloudflare Pagesのビルド設定が以下のようになっていることを確認：

- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `project`（または空白）

### 3. デプロイ

環境変数を設定したら、再デプロイを実行してください。

## デバッグ方法

### ブラウザのコンソールで確認

デプロイ後、ブラウザの開発者ツール（F12）を開いて、以下のログを確認してください：

**成功時**:
```
📖 Fetching sheet: 還元金明細, URL: /api/sheets?sheetName=還元金明細&range=A:N
✅ Data received for 還元金明細: 10 rows
```

**エラー時**:
```
❌ Non-JSON error response for 還元金明細: <!doctype html>...
❌ Failed to fetch 還元金明細: Error: Server returned HTML instead of JSON...
```

### Cloudflare Pagesのログで確認

1. Cloudflare Dashboard → Pages → プロジェクト
2. **Functions** タブを選択
3. リアルタイムログを確認

**期待されるログ**:
```
🔵 GET request to /api/sheets
📧 Service Account: hiroaki@vihara21.iam.gserviceaccount.com
📊 Spreadsheet ID: 1ivn7v7axdZsj8LwpzWHcUl0xeaOutYCzkpykDTsrtgY
📖 Reading from: 還元金明細!A:N
✅ Read 10 rows from 還元金明細
```

## トラブルシューティング

### エラー: "Server returned HTML instead of JSON"

**原因**: `/api/sheets`エンドポイントが見つからない（404）

**解決策**:
1. `functions/api/sheets.ts`ファイルが存在することを確認
2. Gitにコミット・プッシュされていることを確認
3. Cloudflare Pagesで再デプロイを実行

### エラー: "GOOGLE_SERVICE_ACCOUNT_EMAIL is not set"

**原因**: 環境変数が設定されていない

**解決策**:
1. Cloudflare Pages Dashboardで環境変数を確認
2. 変数名のスペルミスがないか確認
3. **必ず再デプロイを実行**（環境変数の変更は再デプロイが必要）

### エラー: "Failed to authenticate with Google"

**原因**: サービスアカウントの認証情報が正しくない

**解決策**:
1. `GOOGLE_PRIVATE_KEY`がダブルクォートで囲まれているか確認
2. 改行が`\n`で表現されているか確認
3. キーの先頭と末尾に`-----BEGIN PRIVATE KEY-----`と`-----END PRIVATE KEY-----`があるか確認

## 完了チェックリスト

- [ ] `functions/api/sheets.ts`が作成されている
- [ ] `src/services/sheetsService.ts`が更新されている
- [ ] `.env`ファイルが更新されている
- [ ] Cloudflare Pagesで環境変数を設定した
- [ ] 環境変数設定後に再デプロイを実行した
- [ ] ブラウザのコンソールでエラーがないことを確認した
- [ ] データが正常に読み込まれることを確認した

すべてのチェックが完了したら、アプリケーションが正常に動作するはずです！

# Cloudflare Pages 環境変数設定ガイド

## エラー: "atob() called with invalid base64-encoded data" の解決方法

このエラーは、`GOOGLE_PRIVATE_KEY`の形式が正しくない場合に発生します。

## 正しい環境変数の設定方法

### 1. GOOGLE_SERVICE_ACCOUNT_EMAIL

**値**:
```
hiroaki@vihara21.iam.gserviceaccount.com
```

**注意**: ダブルクォートは**不要**です。

---

### 2. GOOGLE_PRIVATE_KEY

**重要**: この環境変数の設定が最も重要です。

#### オプション A: エスケープされた改行を使用（推奨）

Cloudflare Pagesの環境変数設定画面で、以下のように**ダブルクォートなし**で入力してください：

```
-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCJNeIGTS2RPXgs\njbLfwF2x1PmifEygY4fyVeq76NRG30o2ITTTYe8tIUMqVaWT8GBCdoXOwaiQifm/\nA2qeb3sDz50ZEX1Dij0Vfvfw/Jle2Gyr03G+3QlN2b6wC8zaLGXTGVn/sU/l3428\nGMZhR0dhn43jTZee41ZB5KO3Q2tSWXupgnm2HbTJdBtvv0VS+BIiitoY57LWivNL\nsmwczFoTAGfJcBTe6Lq7kbCPAPgubnjChDp60ELRCzPGjCeXWRvJgQInSt2pH/p3\nbJ+mBl5Y6tvaVy4H2139G7A0dITc5IlkmGxuyxMG3gUD1I2QSa6Wa9KLlnTIbL/f\nAWaQOJcbAgMBAAECggEAA5lsFZyRApuEBgMs5eK0HStIOyNwl8/Ulp5QsIo3MKlr\nLHKq4eqn7V1PLOf0lntlQwkR5y5m/2z8e1lvGBCLlQ+CqvrYTYfC+h02YCt4KH1G\nkyv88rP1/6/5E8F+J7D8y3tW7uFWBmKFY3bw6Udcj3/cfHx3auhtcFVmQrNG4vDt\nJf3mglZQ/qo0geOuIkBQ0eOHfpD2ZzRZzge6AVaq1aa7Tc5e4aZYD+EdH7AEGEAm\nwYqGSxSAjQK7Cs9mLqcatWTLxwVnrYiN5imQjT2jMVdSTxbwGcgzq4QXM+O8cgFr\nahIw9EEoSS625VmRay7VPriCKv7mGLAxG1dG9IpcjQKBgQC9cQHA7akeVG1vLSc5\nrLstxlRNqkBvxmy1kskM6v4A0FMn4uof9sigfGtFdTRhUVSZmY0Sy6EJ3KX3S21P\njtZE8oHnh+PuT3QNmoj4lag1tP7N9ZX5kDy6LQolwdZB4x1rSh8F4hJlGvvlm61e\nGlulCGr/xYJM3FkghYpoyOBRDwKBgQC5awzexOhXEv03YIWHFKMIg8VeukfqNrKN\nrfZMABgh3k1PG8HXBcZA+r/rKucnBJM1AJ5uAOqhVpWGTyBiPPvZRbW9mzrzxu+9\nGupYsS/CMaHM9R9vrPVpW7TpVKv2ByzI9BbrCZcRyftG1VvPRwkZlEtLah4FFthc\nu4OawZ1BNQKBgAm60iI8kqESKQS6xvb5Xiu9sfrDMcgL4u14eocFUsJr8LltuCSo\nIinL+h55JJWS/ctdzZcXik/dW1DWOOkLJwongnCH1DcbMZS5SSurVBZeE3A0mt1U\ngSn2wjyqNfzwU0R9bBZ7RAKZXjKuyjq5E9foFMbKOCUGdDVtZmx3VL4VAoGBAJpW\n2We1UBDq5Yvq9Dr0mqDDzs6DEMmMriPw4ktw6KWIfaGT4U4yqEv+bTI7jB2WWVKN\nKVM3wBZ8FAqwYqxjRuAcfqNNS00QEw6+EMOy+aYT2jLY90nmFoGUrIpsyJcKceT0\nCP+sA+vyzQ6xGrL21kRMhEBKHKLv2TmXfHydHWDhAoGBAKt+SB7QZHgaZT4GTRdX\n44cr1iwCodQgGNURY2Mzf/foHJIVJo+Hil2GmC3CF6gSsDBNPBYN2p31y5tgD8vv\nV2f1Nkx8y0Z629Qjq0hcGOSPskhfoAI5jvyxuj6qc+S2Q0bp78Osxq4pvIlUr4K9\nrWQo8MaQpcPxobiXD4JNrgKL\n-----END PRIVATE KEY-----
```

**重要なポイント**:
- ✅ `\n` を使って改行を表現
- ✅ ダブルクォート（`"`）は**付けない**
- ✅ `-----BEGIN PRIVATE KEY-----` と `-----END PRIVATE KEY-----` を含める
- ✅ 改行位置は元のPEMファイルと同じ

#### オプション B: Base64エンコード（代替案）

もしオプションAでうまくいかない場合は、秘密鍵全体をBase64エンコードして設定することもできます。

---

### 3. SPREADSHEET_ID

**値**:
```
1ivn7v7axdZsj8LwpzWHcUl0xeaOutYCzkpykDTsrtgY
```

**注意**: ダブルクォートは**不要**です。

---

## Cloudflare Pagesでの設定手順

### ステップ1: ダッシュボードにアクセス

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Pages** を選択
3. プロジェクトを選択

### ステップ2: 環境変数を設定

1. **Settings** タブを選択
2. **Environment variables** セクションまでスクロール
3. **Add variable** をクリック

### ステップ3: 各変数を追加

各環境変数について：

1. **Variable name** に変数名を入力（例: `GOOGLE_SERVICE_ACCOUNT_EMAIL`）
2. **Value** に値を入力（上記の値を参照）
3. **Production** と **Preview** の両方にチェック
4. **Save** をクリック

### ステップ4: 再デプロイ

環境変数を設定したら、**必ず再デプロイを実行**してください：

1. **Deployments** タブを選択
2. 最新のデプロイメントの右側にある **...** をクリック
3. **Retry deployment** を選択

---

## デバッグ方法

### Cloudflare Functionsログの確認

1. Cloudflare Dashboard → Pages → プロジェクト
2. **Functions** タブを選択
3. リアルタイムログを確認

**期待されるログ（成功時）**:
```
🔵 GET request to /api/sheets
📧 Service Account: hiroaki@vihara21.iam.gserviceaccount.com
📊 Spreadsheet ID: 1ivn7v7axdZsj8LwpzWHcUl0xeaOutYCzkpykDTsrtgY
🔑 Private key (first 100 chars): -----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCJNeIGTS2RPXgs...
🔑 PEM contents length: 1704
🔑 PEM contents (first 50 chars): MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAo...
🔑 Binary DER length: 1216
📖 Reading from: 還元金明細!A:N
✅ Read 10 rows from 還元金明細
```

**エラーログ（失敗時）**:
```
❌ Failed to process private key: Error: Invalid base64 characters in private key
```

### よくあるエラーと解決方法

#### エラー: "Invalid base64 characters in private key"

**原因**: 秘密鍵に不正な文字が含まれている

**解決策**:
- `\n` 以外のエスケープシーケンスが含まれていないか確認
- コピー＆ペースト時に余分な文字が入っていないか確認
- 元のJSONファイルから直接コピーする

#### エラー: "GOOGLE_PRIVATE_KEY is not set"

**原因**: 環境変数が設定されていない、または再デプロイされていない

**解決策**:
1. 環境変数が正しく保存されているか確認
2. **必ず再デプロイを実行**

#### エラー: "Failed to authenticate with Google"

**原因**: 秘密鍵の形式が正しくない、またはサービスアカウントの権限が不足

**解決策**:
1. 秘密鍵が完全であることを確認（BEGIN/ENDマーカーを含む）
2. サービスアカウントがGoogle Sheets APIへのアクセス権限を持っているか確認
3. スプレッドシートがサービスアカウントと共有されているか確認

---

## 確認チェックリスト

設定前に以下を確認してください：

- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` にダブルクォートを付けていない
- [ ] `GOOGLE_PRIVATE_KEY` に `\n` を使って改行を表現している
- [ ] `GOOGLE_PRIVATE_KEY` にダブルクォートを付けていない
- [ ] `GOOGLE_PRIVATE_KEY` に `-----BEGIN PRIVATE KEY-----` と `-----END PRIVATE KEY-----` が含まれている
- [ ] `SPREADSHEET_ID` にダブルクォートを付けていない
- [ ] Production と Preview の両方にチェックを入れている
- [ ] 環境変数設定後に再デプロイを実行している

すべてのチェックが完了したら、アプリケーションが正常に動作するはずです！

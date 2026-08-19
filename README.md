# aichat
AIと会話できるチャットアプリです。

## 使い方

### 開発者のサーバーでチャットする
[サーバー１へアクセス](https://another-duckbill-editor.ngrok-free.dev)(https://another-duckbill-editor.ngrok-free.dev)
(予期せずリンクが変わる可能性もあります)

### 自前でサーバーを立てる
#### 必要なもの
- cURL
- Git
- Bun (最新推奨、開発者の環境はv1.3.14)

### インストール
1. ターミナルを開く
2. `git clone https://github.com/tarutarudev/aichat.git;cd aichat;bun i`を実行
3. 完了！

### 起動
1. `.env.example`を`.env`にリネームする
2. `.env`の`GEMINI_API_KEY`にAPIキーを入れて保存
3. `bun start`を実行し、`https://localhost:3000`へブラウザでアクセス

### サンプル
![サンプル](docs/image.png)

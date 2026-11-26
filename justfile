# デフォルト: すべての検証を実行する
default: verify

# 依存関係をインストールする
install:
    pnpm install

# Biome でフォーマット + lint を検査する
check:
    pnpm check

# Biome で自動修正する
format:
    pnpm format

# ast-grep のスタイルルールで走査する
scan:
    pnpm scan

# 文書とコメントの言い回しを検査する (ルールは scripts/wording/rules.ts)
wording-check:
    pnpm wording:check

# Markdown の改行のルールを検査する (整形は pnpm md:format)
md-check:
    pnpm md:check

# コードのコメントが 1 文 1 行になっているかを検査する
comments-check:
    pnpm comments:check

# シークレットの形をした文字列が入っていないかを検査する (ルールは scripts/secrets/rules.ts)
secrets-check:
    pnpm secrets:check

# scripts/ の型検査を実行する (src/ の型検査は build が行う)
typecheck-scripts:
    pnpm typecheck:scripts

# ast-grep ルール自体のテストを実行する
test-rules:
    pnpm test:rules

# ユニットテストを実行する
test:
    pnpm test

# 型検査 + ビルド
build:
    pnpm build

# すべての検証を実行する(コミット前に実行)
verify: check scan wording-check md-check comments-check secrets-check typecheck-scripts test-rules test build

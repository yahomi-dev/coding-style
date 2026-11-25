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

# 文書とコメントの言い回しを検査する (規則は scripts/wording/rules.ts)
wording-check:
    pnpm wording:check

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
verify: check scan wording-check test-rules test build

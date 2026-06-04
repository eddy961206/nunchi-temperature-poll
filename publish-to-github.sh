#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-nunchi-temperature-poll}"
DESCRIPTION="말 꺼내기 애매한 사무실 온도를 더워요/괜찮아요/추워요 익명 투표로 확인하는 초간단 웹앱"

if ! command -v git >/dev/null 2>&1; then
  echo "git이 설치되어 있지 않아. git부터 설치해줘."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI(gh)가 설치되어 있지 않아."
  echo "설치 후 'gh auth login'을 먼저 실행하거나, PUBLISH_TO_GITHUB.md의 수동 push 방법을 써줘."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub 로그인이 필요해. 먼저 실행해: gh auth login"
  exit 1
fi

if [ ! -d .git ]; then
  git init
fi

git add .
if ! git diff --cached --quiet; then
  git commit -m "Initial commit"
fi

CURRENT_BRANCH="$(git branch --show-current || true)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  git branch -M main
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "origin remote가 이미 있어: $(git remote get-url origin)"
else
  gh repo create "$REPO_NAME" --public --description "$DESCRIPTION" --source=. --remote=origin --push
  echo "완료: https://github.com/$(gh api user --jq .login)/$REPO_NAME"
  exit 0
fi

git push -u origin main

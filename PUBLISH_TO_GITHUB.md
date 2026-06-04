# GitHub 공개 레포로 올리는 방법

이 폴더를 GitHub 공개 레포로 올릴 때는 아래 둘 중 하나로 하면 돼.

## 방법 1: GitHub CLI로 한 번에 올리기

```bash
gh auth login
./publish-to-github.sh
```

기본 레포명은 `nunchi-temperature-poll`이야.
다른 이름으로 만들고 싶으면 이렇게 실행해.

```bash
./publish-to-github.sh my-repo-name
```

## 방법 2: GitHub 웹에서 레포를 만든 뒤 push

GitHub에서 새 공개 레포를 만들고, 레포명은 `nunchi-temperature-poll`로 해.
그다음 이 폴더에서 아래 명령어를 실행해.

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nunchi-temperature-poll.git
git push -u origin main
```

`YOUR_USERNAME`만 네 GitHub 아이디로 바꾸면 돼.

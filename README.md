# 🖱️ CipherBFT L1 Realtime Onchain Apps

**빠른 L1 블록타임을 활용한 실시간 온체인 앱 데모**

## 🎯 컨셉

기존 블록체인에서는 불가능했던 **실시간 앱**을 빠른 L1의 초고속 처리로 구현

| 구분 | 기존 방식 | 온체인 |
|------|----------|--------|
| 통신 | Socket.IO (중앙 서버) | Smart Contract Events |
| 지연 | ~50ms (서버 의존) | 블록타임 의존 |
| 신뢰 | 서버 신뢰 필요 | 탈중앙화, 검증 가능 |
| 비용 | 서버 운영비 | 가스비 (매우 저렴) |

---

## 📦 포함된 앱

### 1. Mouse Tracker (`MouseTracker.sol`)
- 모든 유저의 커서 위치를 실시간 공유
- 각 마우스 이동 = 온체인 트랜잭션
- 이벤트 폴링으로 실시간 수신

### 2. Whiteboard (`OnchainWhiteboard.sol`)
- 실시간 협업 그림판
- 각 획(stroke)이 온체인에 기록
- 영구 저장 + 실시간 동기화

### 3. Collaboration Board (`CollaborationBoard.sol`) ⭐ NEW
- **Figma 스타일 실시간 협업 도구**
- 도형 그리기 (사각형, 원, 선, 화살표)
- 오브젝트 선택/이동/리사이즈
- 스티키 노트 & 텍스트
- 레이어 시스템 (앞으로/뒤로 보내기)

**도구 단축키:**
| 키 | 도구 |
|----|------|
| V | 선택 (Select) |
| P | 펜 (Pen) |
| R | 사각형 (Rectangle) |
| O | 원 (Ellipse) |
| L | 선 (Line) |
| A | 화살표 (Arrow) |
| S | 스티키 노트 |
| T | 텍스트 |
| Delete | 선택된 오브젝트 삭제 |

### 4. 올인원 앱 (`mousetracker-app.html`)
- HTML 파일 하나로 바로 사용
- 컨트랙트 자동 배포
- 기존 컨트랙트 재사용 가능

---

## 🔧 기술 스택

- **Smart Contract**: Solidity 0.8.19
- **Frontend**: Vanilla JS + ethers.js
- **Network**: CipherBFT L1 (Chain ID: 85300)
- **RPC**: https://jsonrpc.cipherbft.xyz/

---

## 🚀 빠른 시작 (Collaboration Board)

### 로컬 테스트 (Anvil)

```bash
# 0. Foundry 설치 (처음만)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 1. Anvil 로컬 노드 실행
cd onChainWhiteBoard
anvil

# 2. 새 터미널에서 컨트랙트 배포
forge script script/Deploy.s.sol:DeployCollaborationBoard \
  --rpc-url http://localhost:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 배포 후 출력되는 주소를 복사해두세요!
# 예: CollaborationBoard deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3

# 3. HTTP 서버 실행 (프로젝트 루트에서)
cd ..
python3 -m http.server 3000

# 4. 브라우저에서 열기
# http://localhost:3000/collaboration-app.html
```

### 사용법

1. **계정 선택**: 드롭다운에서 Anvil 계정 선택 (또는 Custom Key로 직접 입력)
2. **Connect** 클릭
3. **Setup Contract** → 배포 시 출력된 컨트랙트 주소 입력 → **Use Existing**
4. **Join Room** → 협업 시작!

### 협업 테스트

두 개의 브라우저 탭에서 다른 계정으로 접속하면 실시간 협업 테스트 가능:
- 탭 1: Anvil #0 선택 → Connect → Join
- 탭 2: Anvil #1 선택 → Connect → Join

### CipherBFT 메인넷 배포

```bash
forge script script/Deploy.s.sol:DeployCollaborationBoard \
  --rpc-url https://rpc.cipherbft.xyz/ \
  --broadcast \
  --private-key $PRIVATE_KEY
```

---

## 🚀 빠른 시작 (Mouse Tracker)

1. `mousetracker-app.html` 브라우저에서 열기
2. **Connect Wallet** 클릭 → MetaMask 연결
3. **Deploy Contract** → 새로 배포 또는 기존 주소 입력
4. **Join Room** → 참가!
5. 마우스 움직이면 → 온체인 TX 전송 → 실시간 동기화

---

## 🛠️ 수동 배포 가이드

### 1. 환경 설정

```bash
# Foundry 설치
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 프로젝트 셋업
cd cipherbft-realtime-apps
forge init --no-commit
```

### 2. 네트워크 설정

```bash
# .env 파일 생성
PRIVATE_KEY=your_private_key_here
RPC_URL=https://jsonrpc.cipherbft.xyz/
```

### 3. 컨트랙트 배포

```bash
# MouseTracker 배포
forge create --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  contracts/MouseTracker.sol:MouseTracker

# OnchainWhiteboard 배포
forge create --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  contracts/OnchainWhiteboard.sol:OnchainWhiteboard
```

### 4. 프론트엔드 설정

`frontend/index.html`에서 컨트랙트 주소 업데이트:

```javascript
const CONFIG = {
    contractAddress: '0x배포된_주소_여기에',
    // ...
};
```

### 5. 실행

```bash
# 간단히 로컬에서 실행
npx serve frontend

# 또는 Vercel/Netlify에 배포
```

---

## ⚡ 성능 최적화 팁

### 1. 배치 트랜잭션
마우스 이동을 모아서 한번에 전송:

```solidity
function moveCursorBatch(uint16[] calldata positions) external {
    for (uint i = 0; i < positions.length; i += 2) {
        emit CursorMoved(msg.sender, positions[i], positions[i+1], block.timestamp);
    }
}
```

### 2. 클라이언트 예측
TX 컨펌 전에 로컬에서 먼저 업데이트:

```javascript
// TX 보내기 전에 로컬 커서 먼저 이동
updateLocalCursor(x, y);

// 그 다음 TX 전송 (논블로킹)
contract.moveCursor(x, y).catch(() => {});
```

### 3. 가스 최적화
- `uint16` 사용 (좌표에 `uint256` 불필요)
- 이벤트만 emit, 상태 최소화
- Packed storage 활용

---

## 🎮 확장 아이디어

빠른 L1의 실시간 성능으로 가능한 것들:

| 앱 | 설명 |
|----|------|
| 🎯 Agar.io 온체인 | 모든 이동이 TX, 충돌 판정도 온체인 |
| 🏎️ 레이싱 게임 | 실시간 위치 동기화 |
| 💬 온체인 채팅 | 메시지가 영구 기록 |
| 📊 실시간 투표 | 투표 결과 즉시 반영 |
| 🎵 음악 잼 | 실시간 협업 작곡 |

---

## 📜 라이선스

MIT

---

## 🔗 네트워크 정보

| 항목 | 값 |
|------|-----|
| Network Name | CipherBFT L1 |
| Chain ID | 85300 |
| RPC URL | https://rpc.cipherbft.xyz/ |
| Currency | ETH |
# cipherBFT_DApp-Whiteboard

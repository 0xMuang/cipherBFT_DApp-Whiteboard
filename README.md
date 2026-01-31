# CipherBFT L1 Realtime Onchain Apps

**빠른 L1 블록타임을 활용한 실시간 온체인 앱 데모**

## 컨셉

기존 블록체인에서는 불가능했던 **실시간 앱**을 빠른 L1의 초고속 처리로 구현

| 구분 | 기존 방식 | 온체인 |
|------|----------|--------|
| 통신 | Socket.IO (중앙 서버) | Smart Contract Events |
| 지연 | ~50ms (서버 의존) | 블록타임 의존 |
| 신뢰 | 서버 신뢰 필요 | 탈중앙화, 검증 가능 |
| 비용 | 서버 운영비 | 가스비 (매우 저렴) |

---

## 포함된 앱

### 1. Collaboration Board (Figma 스타일 협업 도구)

실시간 협업 화이트보드로, 모든 그림과 오브젝트가 블록체인에 저장됩니다.

**주요 기능:**
- 펜 도구로 자유 드로잉
- 도형 그리기 (사각형, 원, 선, 화살표)
- 오브젝트 선택/이동/리사이즈
- 스티키 노트 & 텍스트
- 레이어 시스템 (앞으로/뒤로 보내기)
- 실시간 커서 공유
- 다중 보드 지원 (BoardRegistry)

**도구 단축키:**
| 키 | 도구 |
|----|------|
| V | 선택 (Select) |
| P | 펜 (Pen) |
| E | 지우개 (Eraser) |
| R | 사각형 (Rectangle) |
| O | 원 (Ellipse) |
| L | 선 (Line) |
| A | 화살표 (Arrow) |
| S | 스티키 노트 |
| T | 텍스트 |
| Delete/Backspace | 선택된 오브젝트 삭제 |
| Escape | 선택 해제 |

### 2. Mouse Tracker
- 모든 유저의 커서 위치를 실시간 공유
- 각 마우스 이동 = 온체인 트랜잭션

### 3. Whiteboard (기본 버전)
- 실시간 협업 그림판
- 각 획(stroke)이 온체인에 기록

---

## 프로젝트 구조

```
cipherbft-realtime-apps/
├── README.md
├── collaboration-app.html      # 올인원 버전 (단일 HTML)
├── collaboration-board/        # 모듈화 버전
│   ├── index.html              # 메인 HTML
│   ├── styles/
│   │   └── main.css            # 스타일시트
│   └── js/
│       ├── config.js           # 설정 및 ABI
│       ├── ObjectManager.js    # 오브젝트 상태 관리
│       ├── SelectionSystem.js  # 선택/변환 시스템
│       ├── CanvasRenderer.js   # 캔버스 렌더링
│       └── app.js              # 메인 애플리케이션
├── mousetracker-app.html       # 마우스 트래커
└── onChainWhiteBoard/          # 스마트 컨트랙트
    ├── src/
    │   ├── CollaborationBoard.sol
    │   ├── BoardRegistry.sol
    │   ├── MouseTracker.sol
    │   └── OnchainWhiteboard.sol
    ├── script/
    │   └── Deploy.s.sol
    └── test/
```

---

## 아키텍처

### 스마트 컨트랙트

```
┌─────────────────────────────────────────────────────────────┐
│                      BoardRegistry                          │
│  - createBoard() → 새 CollaborationBoard 생성               │
│  - getAllBoards() → 보드 목록 조회                          │
└────────────────────────┬────────────────────────────────────┘
                         │ 생성
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ CollaborationBoard│ CollaborationBoard│ CollaborationBoard│
│  - 유저 관리     │ │  - 유저 관리     │ │  - 유저 관리     │
│  - 오브젝트 CRUD │ │  - 오브젝트 CRUD │ │  - 오브젝트 CRUD │
│  - 커서 동기화   │ │  - 커서 동기화   │ │  - 커서 동기화   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 데이터 흐름

```
[사용자 입력] → [로컬 렌더링] → [TX 전송] → [이벤트 발생] → [다른 유저 수신]
     │              │                            │
     │         Optimistic                    폴링 (100ms)
     │          Update                           │
     └──────────────┴────────────────────────────┘
                    실시간 동기화
```

### 프론트엔드 모듈

| 모듈 | 역할 |
|------|------|
| `config.js` | 체인 설정, 컨트랙트 ABI, 색상 팔레트 |
| `ObjectManager.js` | 오브젝트 상태 관리, 레이어 정렬 |
| `SelectionSystem.js` | 선택, 드래그, 리사이즈 핸들링 |
| `CanvasRenderer.js` | 캔버스에 오브젝트 렌더링 |
| `app.js` | 이벤트 핸들러, 블록체인 통신, UI |

---

## 빠른 시작

### 사전 준비

```bash
# Foundry 설치 (처음만)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 1. 로컬 노드 실행

```bash
cd onChainWhiteBoard
anvil
```

Anvil이 실행되면 테스트 계정들과 Private Key가 표시됩니다.

### 2. 컨트랙트 배포

새 터미널에서:

```bash
cd onChainWhiteBoard

# BoardRegistry + 샘플 보드 배포
forge script script/Deploy.s.sol:DeployBoardRegistry \
  --rpc-url http://localhost:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

출력 예시:
```
BoardRegistry deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Sample board created at: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

**BoardRegistry 주소를 복사해두세요!**

### 3. 프론트엔드 실행

프로젝트 루트에서:

```bash
# Python 3
python3 -m http.server 3000

# 또는 Node.js
npx serve .
```

### 4. 브라우저에서 접속

**모듈화 버전 (권장):**
```
http://localhost:3000/collaboration-board/index.html
```

**올인원 버전:**
```
http://localhost:3000/collaboration-app.html
```

### 5. 앱 사용법

1. **계정 선택**: 드롭다운에서 Anvil 계정 선택
2. **Connect** 클릭
3. **Setup Contract** 클릭
4. BoardRegistry 주소 입력 (배포 시 출력된 주소)
5. 보드 선택 또는 새 보드 생성
6. 닉네임 입력 후 **Join Board**

### 6. 협업 테스트

두 개의 브라우저 탭/창에서 다른 계정으로 접속:
- 탭 1: Anvil #0 선택 → Connect → 보드 선택 → Join
- 탭 2: Anvil #1 선택 → Connect → 같은 보드 선택 → Join

이제 한 쪽에서 그리면 다른 쪽에서 실시간으로 보입니다!

---

## CipherBFT 메인넷 배포

### 컨트랙트 배포

```bash
cd onChainWhiteBoard

# BoardRegistry 배포
forge script script/Deploy.s.sol:DeployBoardRegistry \
  --rpc-url https://rpc.cipherbft.xyz/ \
  --broadcast \
  --private-key $YOUR_PRIVATE_KEY
```

### 프론트엔드 설정

`js/config.js` 수정:

```javascript
export const CONFIG = {
    chainId: 85300,
    chainName: 'CipherBFT L1',
    rpcUrl: 'https://rpc.cipherbft.xyz/',
    // ...
};
```

### 호스팅

정적 파일이므로 아무 호스팅에나 배포 가능:
- Vercel
- Netlify
- GitHub Pages
- IPFS

---

## 스마트 컨트랙트 API

### BoardRegistry

```solidity
// 새 보드 생성
function createBoard(string name, bool allowAnyoneDelete)
    returns (uint256 boardId, address boardAddress)

// 모든 보드 조회
function getAllBoards()
    returns (BoardInfo[])

// 특정 보드 조회
function getBoard(uint256 boardId)
    returns (address, string, address, uint256, bool)
```

### CollaborationBoard

```solidity
// 유저 관리
function join(string nickname) external
function leave() external
function updateNickname(string newNickname) external

// 오브젝트 생성
function createStroke(int16[] points, uint8 colorIndex, uint8 strokeWidth) returns (uint256)
function createShape(uint8 shapeType, int32 x, int32 y, uint16 width, uint16 height, ...) returns (uint256)
function createStickyNote(int32 x, int32 y, uint16 width, uint16 height, string content, uint8 bgColorIndex) returns (uint256)
function createText(int32 x, int32 y, string content, uint8 colorIndex, uint8 fontSize) returns (uint256)

// 오브젝트 수정
function moveObject(uint256 objectId, int32 newX, int32 newY) external
function resizeObject(uint256 objectId, uint16 newWidth, uint16 newHeight) external
function deleteObject(uint256 objectId) external

// 레이어
function bringToFront(uint256 objectId) external
function sendToBack(uint256 objectId) external

// 커서
function moveCursor(int32 x, int32 y) external
```

### 주요 이벤트

```solidity
event ObjectCreated(address indexed creator, uint256 indexed objectId, ...)
event StrokePoints(uint256 indexed objectId, int16[] points)
event ShapeGeometry(uint256 indexed objectId, int32 x, int32 y, ...)
event ObjectMoved(address indexed user, uint256 indexed objectId, int32 newX, int32 newY)
event ObjectDeleted(address indexed user, uint256 indexed objectId)
event UserJoined(address indexed user, string nickname)
event CursorMoved(address indexed user, int32 x, int32 y)
```

---

## 성능 최적화

### Optimistic Update
TX 컨펌 전에 로컬에서 먼저 렌더링:
```javascript
// 1. 로컬에 먼저 반영
objectManager.addObject(obj);
render();

// 2. TX 전송 (비동기)
sendCreateStroke(points, color, width, localId);
```

### 이벤트 폴링
100ms 간격으로 새 블록의 이벤트 조회:
```javascript
setInterval(async () => {
    const currentBlock = await provider.getBlockNumber();
    if (currentBlock > lastBlock) {
        await processEvents(lastBlock + 1, currentBlock);
        lastBlock = currentBlock;
    }
}, 100);
```

### 가스 최적화
- `int16`으로 좌표 저장 (가스 절약)
- Geometry 데이터는 이벤트에만 저장 (storage 최소화)
- 스트로크 실시간 스트리밍 (작은 청크로 분할)

---

## 확장 아이디어

빠른 L1의 실시간 성능으로 가능한 것들:

| 앱 | 설명 |
|----|------|
| Agar.io 온체인 | 모든 이동이 TX, 충돌 판정도 온체인 |
| 레이싱 게임 | 실시간 위치 동기화 |
| 온체인 채팅 | 메시지가 영구 기록 |
| 실시간 투표 | 투표 결과 즉시 반영 |
| 음악 잼 세션 | 실시간 협업 작곡 |

---

## 기술 스택

- **Smart Contract**: Solidity 0.8.19, Foundry
- **Frontend**: Vanilla JS (ES Modules), ethers.js v5
- **Network**: CipherBFT L1 (Chain ID: 85300)
- **RPC**: https://rpc.cipherbft.xyz/

---

## 네트워크 정보

| 항목 | 값 |
|------|-----|
| Network Name | CipherBFT L1 |
| Chain ID | 85300 |
| RPC URL | https://rpc.cipherbft.xyz/ |
| Currency | ETH |

**로컬 테스트 (Anvil):**
| 항목 | 값 |
|------|-----|
| Chain ID | 31337 |
| RPC URL | http://localhost:8545 |

---

## 라이선스

MIT

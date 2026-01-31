/**
 * Configuration and constants for the Collaboration Board
 */

export const CONFIG = {
    // 로컬 테스트용 (Anvil)
    chainId: 31337,
    chainName: 'Anvil Local',
    rpcUrl: 'http://localhost:8545',
    // 실제 배포시:
    // chainId: 85300,
    // chainName: 'CipherBFT L1',
    // rpcUrl: 'https://rpc.cipherbft.xyz/',

    colors: [
        '#000000', '#ffffff', '#ff0000', '#ff9900',
        '#ffff00', '#00ff00', '#00ffff', '#0000ff',
        '#9900ff', '#ff00ff', '#795548', '#607d8b',
        '#e91e63', '#00bcd4', '#8bc34a', '#ff5722'
    ],

    stickyColors: [
        '#fff740', '#ff7eb9', '#7afcff',
        '#98ff98', '#ffb366', '#e0b0ff'
    ],

    objectTypes: ['stroke', 'rectangle', 'ellipse', 'line', 'arrow', 'stickyNote', 'text'],

    cursorColors: [
        '#E07A5F', '#81B29A', '#F2CC8F', '#3D405B',
        '#9B5DE5', '#00BBF9', '#00F5D4', '#FEE440'
    ]
};

export const CONTRACT_ABI = [
    // User management
    "function join(string nickname) external",
    "function leave() external",
    "function updateNickname(string newNickname) external",
    "function getActiveUsers() view returns (address[])",
    "function getUserInfo(address user) view returns (string nickname, bool isActive, uint256 objectCount)",

    // Object creation
    "function createStroke(int16[] points, uint8 colorIndex, uint8 strokeWidth) external returns (uint256)",
    "function createShape(uint8 shapeType, int32 x, int32 y, uint16 width, uint16 height, uint16 rotation, uint8 colorIndex, uint8 strokeWidth) external returns (uint256)",
    "function createStickyNote(int32 x, int32 y, uint16 width, uint16 height, string content, uint8 bgColorIndex) external returns (uint256)",
    "function createText(int32 x, int32 y, string content, uint8 colorIndex, uint8 fontSize) external returns (uint256)",

    // Transformations
    "function moveObject(uint256 objectId, int32 newX, int32 newY) external",
    "function resizeObject(uint256 objectId, uint16 newWidth, uint16 newHeight) external",
    "function deleteObject(uint256 objectId) external",

    // Layer management
    "function bringToFront(uint256 objectId) external",
    "function sendToBack(uint256 objectId) external",

    // Content updates
    "function updateStickyNote(uint256 objectId, string newContent) external",
    "function updateText(uint256 objectId, string newContent) external",

    // Lock
    "function toggleLock(uint256 objectId) external",

    // Canvas
    "function clearCanvas() external",

    // Cursor
    "function moveCursor(int32 x, int32 y) external",

    // View
    "function totalObjects() view returns (uint256)",
    "function canvasVersion() view returns (uint256)",
    "function getObjectInfo(uint256 objectId) view returns (address creator, uint8 objectType, uint8 colorIndex, uint8 strokeWidth, uint16 layer, bool isLocked, bool isDeleted)",

    // Events
    "event ObjectCreated(address indexed creator, uint256 indexed objectId, uint8 objectType, uint8 colorIndex, uint8 strokeWidth, uint16 layer)",
    "event StrokePoints(uint256 indexed objectId, int16[] points)",
    "event ShapeGeometry(uint256 indexed objectId, int32 x, int32 y, uint16 width, uint16 height, uint16 rotation)",
    "event StickyNoteData(uint256 indexed objectId, int32 x, int32 y, uint16 width, uint16 height, string content, uint8 bgColorIndex)",
    "event TextData(uint256 indexed objectId, int32 x, int32 y, string content, uint8 fontSize)",
    "event ObjectMoved(address indexed user, uint256 indexed objectId, int32 newX, int32 newY)",
    "event ObjectResized(address indexed user, uint256 indexed objectId, uint16 newWidth, uint16 newHeight)",
    "event ObjectDeleted(address indexed user, uint256 indexed objectId)",
    "event LayerChanged(uint256 indexed objectId, uint16 oldLayer, uint16 newLayer)",
    "event ContentUpdated(uint256 indexed objectId, string newContent)",
    "event ObjectLockToggled(uint256 indexed objectId, bool isLocked)",
    "event UserJoined(address indexed user, string nickname)",
    "event UserLeft(address indexed user)",
    "event NicknameUpdated(address indexed user, string newNickname)",
    "event CanvasCleared(address indexed user)",
    "event CursorMoved(address indexed user, int32 x, int32 y)"
];

export const REGISTRY_ABI = [
    "function createBoard(string name, bool allowAnyoneDelete) external returns (uint256 boardId, address boardAddress)",
    "function getBoardCount() view returns (uint256)",
    "function getBoard(uint256 boardId) view returns (address boardAddress, string name, address creator, uint256 createdAt, bool allowAnyoneDelete)",
    "function getAllBoards() view returns (tuple(address boardAddress, string name, address creator, uint256 createdAt, bool allowAnyoneDelete)[])",
    "function getUserBoards(address user) view returns (uint256[])",
    "event BoardCreated(uint256 indexed boardId, address indexed boardAddress, string name, address indexed creator, bool allowAnyoneDelete)"
];

// Anvil 테스트 계정들 (각각 10000 ETH)
export const ANVIL_ACCOUNTS = [
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'
];

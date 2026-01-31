// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CollaborationBoard
 * @notice Figma-like 실시간 협업 보드 - CipherBFT L1용
 * @dev 통합 오브젝트 시스템: Stroke, Shape, StickyNote, Text를 하나의 Object로 관리
 */
contract CollaborationBoard {

    // ===== ENUMS =====

    enum ObjectType {
        STROKE,       // 0: 자유 그리기 (펜/지우개)
        RECTANGLE,    // 1: 사각형
        ELLIPSE,      // 2: 원/타원
        LINE,         // 3: 직선
        ARROW,        // 4: 화살표
        STICKY_NOTE,  // 5: 스티키 노트
        TEXT          // 6: 텍스트
    }

    // ===== STRUCTS =====

    struct ObjectMeta {
        address creator;
        ObjectType objectType;
        uint8 colorIndex;      // 0-15 팔레트
        uint8 strokeWidth;     // 1-20 (텍스트의 경우 폰트 크기)
        uint16 layer;          // z-order (0 = 맨 아래)
        bool isLocked;         // 수정 방지
        bool isDeleted;        // 소프트 삭제
    }

    struct User {
        string nickname;
        bool isActive;
        uint256 objectCount;
    }

    // ===== EVENTS =====

    // 오브젝트 생명주기
    event ObjectCreated(
        address indexed creator,
        uint256 indexed objectId,
        ObjectType objectType,
        uint8 colorIndex,
        uint8 strokeWidth,
        uint16 layer
    );

    event ObjectDeleted(
        address indexed user,
        uint256 indexed objectId
    );

    // Stroke 전용: 점 배열
    event StrokePoints(
        uint256 indexed objectId,
        int16[] points  // [x1, y1, x2, y2, ...]
    );

    // Shape 전용: 기하 정보
    event ShapeGeometry(
        uint256 indexed objectId,
        int32 x,
        int32 y,
        uint16 width,
        uint16 height,
        uint16 rotation  // 0-3600 (degrees * 10)
    );

    // StickyNote 전용
    event StickyNoteData(
        uint256 indexed objectId,
        int32 x,
        int32 y,
        uint16 width,
        uint16 height,
        string content,
        uint8 bgColorIndex
    );

    // Text 전용
    event TextData(
        uint256 indexed objectId,
        int32 x,
        int32 y,
        string content,
        uint8 fontSize
    );

    // 변환 이벤트
    event ObjectMoved(
        address indexed user,
        uint256 indexed objectId,
        int32 newX,
        int32 newY
    );

    event ObjectResized(
        address indexed user,
        uint256 indexed objectId,
        uint16 newWidth,
        uint16 newHeight
    );

    event ObjectRotated(
        address indexed user,
        uint256 indexed objectId,
        uint16 rotation
    );

    // 레이어 이벤트
    event LayerChanged(
        uint256 indexed objectId,
        uint16 oldLayer,
        uint16 newLayer
    );

    // 잠금 이벤트
    event ObjectLockToggled(
        uint256 indexed objectId,
        bool isLocked
    );

    // 콘텐츠 업데이트 이벤트
    event ContentUpdated(
        uint256 indexed objectId,
        string newContent
    );

    // 유저 이벤트
    event UserJoined(address indexed user, string nickname);
    event UserLeft(address indexed user);
    event NicknameUpdated(address indexed user, string newNickname);
    event CanvasCleared(address indexed user);

    // 커서 이벤트
    event CursorMoved(address indexed user, int32 x, int32 y);

    // ===== STATE =====

    mapping(uint256 => ObjectMeta) public objects;
    mapping(address => User) public users;
    address[] public activeUsers;

    uint256 public totalObjects;
    uint256 public canvasVersion;
    uint16 public maxLayer;

    // 방 설정
    bool public allowAnyoneDelete;  // true: 누구나 삭제 가능, false: 본인만 삭제

    // ===== CONSTRUCTOR =====

    constructor(bool _allowAnyoneDelete) {
        allowAnyoneDelete = _allowAnyoneDelete;
    }

    // ===== MODIFIERS =====

    modifier onlyActiveUser() {
        require(users[msg.sender].isActive, "Not joined");
        _;
    }

    modifier objectExists(uint256 objectId) {
        require(objectId < totalObjects, "Object does not exist");
        require(!objects[objectId].isDeleted, "Object deleted");
        _;
    }

    modifier onlyObjectOwner(uint256 objectId) {
        require(objects[objectId].creator == msg.sender, "Not owner");
        _;
    }

    modifier notLocked(uint256 objectId) {
        require(!objects[objectId].isLocked, "Object locked");
        _;
    }

    // ===== USER FUNCTIONS =====

    function join(string calldata nickname) external {
        require(!users[msg.sender].isActive, "Already joined");

        users[msg.sender] = User({
            nickname: nickname,
            isActive: true,
            objectCount: 0
        });

        activeUsers.push(msg.sender);
        emit UserJoined(msg.sender, nickname);
    }

    function leave() external onlyActiveUser {
        users[msg.sender].isActive = false;

        // activeUsers에서 제거 (swap-and-pop)
        for (uint i = 0; i < activeUsers.length; i++) {
            if (activeUsers[i] == msg.sender) {
                activeUsers[i] = activeUsers[activeUsers.length - 1];
                activeUsers.pop();
                break;
            }
        }

        emit UserLeft(msg.sender);
    }

    /**
     * @notice 닉네임 변경
     */
    function updateNickname(string calldata newNickname) external onlyActiveUser {
        users[msg.sender].nickname = newNickname;
        emit NicknameUpdated(msg.sender, newNickname);
    }

    /**
     * @notice 커서 위치 업데이트
     */
    function moveCursor(int32 x, int32 y) external onlyActiveUser {
        emit CursorMoved(msg.sender, x, y);
    }

    // ===== OBJECT CREATION =====

    /**
     * @notice Stroke 생성 (자유 그리기)
     * @param points 좌표 배열 [x1, y1, x2, y2, ...]
     * @param colorIndex 색상 인덱스 (0-15)
     * @param strokeWidth 브러시 크기 (1-20)
     */
    function createStroke(
        int16[] calldata points,
        uint8 colorIndex,
        uint8 strokeWidth
    ) external onlyActiveUser returns (uint256 objectId) {
        require(points.length >= 4 && points.length % 2 == 0, "Invalid points");
        require(colorIndex < 16, "Invalid color");
        require(strokeWidth > 0 && strokeWidth <= 20, "Invalid brush");

        objectId = _createObject(ObjectType.STROKE, colorIndex, strokeWidth);
        emit StrokePoints(objectId, points);
    }

    /**
     * @notice Shape 생성 (사각형, 원, 선, 화살표)
     * @param shapeType 도형 타입 (1-4)
     * @param x 좌상단 X
     * @param y 좌상단 Y
     * @param width 너비
     * @param height 높이
     * @param rotation 회전 (0-3600, degrees * 10)
     * @param colorIndex 색상 인덱스
     * @param strokeWidth 선 두께
     */
    function createShape(
        ObjectType shapeType,
        int32 x,
        int32 y,
        uint16 width,
        uint16 height,
        uint16 rotation,
        uint8 colorIndex,
        uint8 strokeWidth
    ) external onlyActiveUser returns (uint256 objectId) {
        require(
            shapeType == ObjectType.RECTANGLE ||
            shapeType == ObjectType.ELLIPSE ||
            shapeType == ObjectType.LINE ||
            shapeType == ObjectType.ARROW,
            "Invalid shape type"
        );
        require(colorIndex < 16, "Invalid color");
        require(strokeWidth > 0 && strokeWidth <= 20, "Invalid stroke");

        objectId = _createObject(shapeType, colorIndex, strokeWidth);
        emit ShapeGeometry(objectId, x, y, width, height, rotation);
    }

    /**
     * @notice StickyNote 생성
     * @param x X 좌표
     * @param y Y 좌표
     * @param width 너비
     * @param height 높이
     * @param content 텍스트 내용
     * @param bgColorIndex 배경색 인덱스
     */
    function createStickyNote(
        int32 x,
        int32 y,
        uint16 width,
        uint16 height,
        string calldata content,
        uint8 bgColorIndex
    ) external onlyActiveUser returns (uint256 objectId) {
        require(bgColorIndex < 16, "Invalid bg color");

        objectId = _createObject(ObjectType.STICKY_NOTE, bgColorIndex, 0);
        emit StickyNoteData(objectId, x, y, width, height, content, bgColorIndex);
    }

    /**
     * @notice Text 생성
     * @param x X 좌표
     * @param y Y 좌표
     * @param content 텍스트 내용
     * @param colorIndex 색상 인덱스
     * @param fontSize 폰트 크기 (8-72)
     */
    function createText(
        int32 x,
        int32 y,
        string calldata content,
        uint8 colorIndex,
        uint8 fontSize
    ) external onlyActiveUser returns (uint256 objectId) {
        require(colorIndex < 16, "Invalid color");
        require(fontSize >= 8 && fontSize <= 72, "Invalid font size");

        objectId = _createObject(ObjectType.TEXT, colorIndex, fontSize);
        emit TextData(objectId, x, y, content, fontSize);
    }

    // ===== TRANSFORMATIONS =====

    /**
     * @notice 오브젝트 이동
     */
    function moveObject(
        uint256 objectId,
        int32 newX,
        int32 newY
    ) external onlyActiveUser objectExists(objectId) onlyObjectOwner(objectId) notLocked(objectId) {
        emit ObjectMoved(msg.sender, objectId, newX, newY);
    }

    /**
     * @notice 오브젝트 크기 변경
     */
    function resizeObject(
        uint256 objectId,
        uint16 newWidth,
        uint16 newHeight
    ) external onlyActiveUser objectExists(objectId) onlyObjectOwner(objectId) notLocked(objectId) {
        require(newWidth > 0 && newHeight > 0, "Invalid size");
        emit ObjectResized(msg.sender, objectId, newWidth, newHeight);
    }

    /**
     * @notice 오브젝트 회전
     */
    function rotateObject(
        uint256 objectId,
        uint16 rotation
    ) external onlyActiveUser objectExists(objectId) onlyObjectOwner(objectId) notLocked(objectId) {
        require(rotation <= 3600, "Invalid rotation");
        emit ObjectRotated(msg.sender, objectId, rotation);
    }

    /**
     * @notice 오브젝트 삭제 (소프트 삭제)
     * @dev allowAnyoneDelete가 true면 누구나, false면 본인만 삭제 가능
     */
    function deleteObject(
        uint256 objectId
    ) external onlyActiveUser objectExists(objectId) {
        if (!allowAnyoneDelete) {
            require(objects[objectId].creator == msg.sender, "Not owner");
        }
        objects[objectId].isDeleted = true;
        emit ObjectDeleted(msg.sender, objectId);
    }

    // ===== LAYER MANAGEMENT =====

    /**
     * @notice 오브젝트 레이어 설정
     */
    function setObjectLayer(
        uint256 objectId,
        uint16 newLayer
    ) external onlyActiveUser objectExists(objectId) onlyObjectOwner(objectId) {
        uint16 oldLayer = objects[objectId].layer;
        objects[objectId].layer = newLayer;

        if (newLayer > maxLayer) {
            maxLayer = newLayer;
        }

        emit LayerChanged(objectId, oldLayer, newLayer);
    }

    /**
     * @notice 오브젝트를 맨 앞으로
     */
    function bringToFront(
        uint256 objectId
    ) external onlyActiveUser objectExists(objectId) onlyObjectOwner(objectId) {
        uint16 oldLayer = objects[objectId].layer;
        maxLayer++;
        objects[objectId].layer = maxLayer;

        emit LayerChanged(objectId, oldLayer, maxLayer);
    }

    /**
     * @notice 오브젝트를 맨 뒤로
     */
    function sendToBack(
        uint256 objectId
    ) external onlyActiveUser objectExists(objectId) onlyObjectOwner(objectId) {
        uint16 oldLayer = objects[objectId].layer;
        objects[objectId].layer = 0;

        emit LayerChanged(objectId, oldLayer, 0);
    }

    // ===== CONTENT UPDATE =====

    /**
     * @notice StickyNote 내용 업데이트
     */
    function updateStickyNote(
        uint256 objectId,
        string calldata newContent
    ) external onlyActiveUser objectExists(objectId) onlyObjectOwner(objectId) notLocked(objectId) {
        require(objects[objectId].objectType == ObjectType.STICKY_NOTE, "Not a sticky note");
        emit ContentUpdated(objectId, newContent);
    }

    /**
     * @notice Text 내용 업데이트
     */
    function updateText(
        uint256 objectId,
        string calldata newContent
    ) external onlyActiveUser objectExists(objectId) onlyObjectOwner(objectId) notLocked(objectId) {
        require(objects[objectId].objectType == ObjectType.TEXT, "Not a text object");
        emit ContentUpdated(objectId, newContent);
    }

    // ===== LOCK =====

    /**
     * @notice 오브젝트 잠금 토글
     */
    function toggleLock(
        uint256 objectId
    ) external onlyActiveUser objectExists(objectId) onlyObjectOwner(objectId) {
        objects[objectId].isLocked = !objects[objectId].isLocked;
        emit ObjectLockToggled(objectId, objects[objectId].isLocked);
    }

    // ===== CANVAS =====

    /**
     * @notice 캔버스 클리어
     */
    function clearCanvas() external onlyActiveUser {
        canvasVersion++;
        emit CanvasCleared(msg.sender);
    }

    // ===== INTERNAL =====

    function _createObject(
        ObjectType objType,
        uint8 colorIndex,
        uint8 strokeWidth
    ) internal returns (uint256 objectId) {
        objectId = totalObjects++;
        maxLayer++;

        objects[objectId] = ObjectMeta({
            creator: msg.sender,
            objectType: objType,
            colorIndex: colorIndex,
            strokeWidth: strokeWidth,
            layer: maxLayer,
            isLocked: false,
            isDeleted: false
        });

        users[msg.sender].objectCount++;

        emit ObjectCreated(
            msg.sender,
            objectId,
            objType,
            colorIndex,
            strokeWidth,
            maxLayer
        );
    }

    // ===== VIEW FUNCTIONS =====

    function getActiveUserCount() external view returns (uint256) {
        return activeUsers.length;
    }

    function getActiveUsers() external view returns (address[] memory) {
        return activeUsers;
    }

    function getUserInfo(address user) external view returns (
        string memory nickname,
        bool isActive,
        uint256 objectCount
    ) {
        User memory u = users[user];
        return (u.nickname, u.isActive, u.objectCount);
    }

    function getObjectInfo(uint256 objectId) external view returns (
        address creator,
        ObjectType objectType,
        uint8 colorIndex,
        uint8 strokeWidth,
        uint16 layer,
        bool isLocked,
        bool isDeleted
    ) {
        ObjectMeta memory obj = objects[objectId];
        return (
            obj.creator,
            obj.objectType,
            obj.colorIndex,
            obj.strokeWidth,
            obj.layer,
            obj.isLocked,
            obj.isDeleted
        );
    }
}

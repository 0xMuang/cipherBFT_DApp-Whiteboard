// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title OnchainWhiteboard
 * @notice 실시간 협업 화이트보드 - CipherBFT L1용
 * @dev 각 획(stroke)이 온체인 트랜잭션, 10ms 미니블록으로 실시간 동기화
 */
contract OnchainWhiteboard {

    // ===== 이벤트 =====

    // 그리기 시작 (펜 다운)
    event StrokeStart(
        address indexed user,
        uint256 indexed strokeId,
        uint16 x,
        uint16 y,
        uint8 color,      // 0-15 팔레트 인덱스
        uint8 brushSize   // 1-20
    );

    // 그리기 진행 (펜 이동)
    event StrokeMove(
        address indexed user,
        uint256 indexed strokeId,
        uint16 x,
        uint16 y
    );

    // 그리기 끝 (펜 업)
    event StrokeEnd(
        address indexed user,
        uint256 indexed strokeId
    );

    // 캔버스 클리어
    event CanvasCleared(address indexed user);

    // 유저 이벤트
    event UserJoined(address indexed user, string nickname);
    event UserLeft(address indexed user);

    // ===== 상태 =====

    struct User {
        string nickname;
        bool isActive;
        uint256 strokeCount;
    }

    struct Stroke {
        address user;
        uint8 color;
        uint8 brushSize;
        bool isComplete;
    }

    mapping(address => User) public users;
    mapping(uint256 => Stroke) public strokes;

    address[] public activeUsers;
    uint256 public totalStrokes;
    uint256 public canvasVersion; // 클리어할 때마다 증가

    // 방 시스템 (선택적)
    mapping(bytes32 => address[]) public rooms;

    // ===== 수정자 =====

    modifier onlyActiveUser() {
        require(users[msg.sender].isActive, "Not joined");
        _;
    }

    // ===== 함수 =====

    /**
     * @notice 화이트보드 참가
     */
    function join(string calldata nickname) external {
        require(!users[msg.sender].isActive, "Already joined");

        users[msg.sender] = User({
            nickname: nickname,
            isActive: true,
            strokeCount: 0
        });

        activeUsers.push(msg.sender);
        emit UserJoined(msg.sender, nickname);
    }

    /**
     * @notice 획 시작
     * @param x 시작 X 좌표
     * @param y 시작 Y 좌표
     * @param color 색상 인덱스 (0-15)
     * @param brushSize 브러시 크기 (1-20)
     */
    function startStroke(
        uint16 x,
        uint16 y,
        uint8 color,
        uint8 brushSize
    ) external onlyActiveUser returns (uint256 strokeId) {
        require(color < 16, "Invalid color");
        require(brushSize > 0 && brushSize <= 20, "Invalid brush size");

        strokeId = totalStrokes++;

        strokes[strokeId] = Stroke({
            user: msg.sender,
            color: color,
            brushSize: brushSize,
            isComplete: false
        });

        users[msg.sender].strokeCount++;

        emit StrokeStart(msg.sender, strokeId, x, y, color, brushSize);
    }

    /**
     * @notice 획 진행 (점 추가)
     * @param strokeId 획 ID
     * @param x X 좌표
     * @param y Y 좌표
     */
    function moveStroke(uint256 strokeId, uint16 x, uint16 y) external onlyActiveUser {
        Stroke storage stroke = strokes[strokeId];
        require(stroke.user == msg.sender, "Not your stroke");
        require(!stroke.isComplete, "Stroke already complete");

        emit StrokeMove(msg.sender, strokeId, x, y);
    }

    /**
     * @notice 배치로 획 진행 (여러 점을 한 TX에)
     * @param strokeId 획 ID
     * @param points 좌표 배열 [x1, y1, x2, y2, ...]
     */
    function moveStrokeBatch(uint256 strokeId, uint16[] calldata points) external onlyActiveUser {
        Stroke storage stroke = strokes[strokeId];
        require(stroke.user == msg.sender, "Not your stroke");
        require(!stroke.isComplete, "Stroke already complete");
        require(points.length >= 2 && points.length % 2 == 0, "Invalid points");

        for (uint i = 0; i < points.length; i += 2) {
            emit StrokeMove(msg.sender, strokeId, points[i], points[i+1]);
        }
    }

    /**
     * @notice 획 종료
     * @param strokeId 획 ID
     */
    function endStroke(uint256 strokeId) external onlyActiveUser {
        Stroke storage stroke = strokes[strokeId];
        require(stroke.user == msg.sender, "Not your stroke");
        require(!stroke.isComplete, "Stroke already complete");

        stroke.isComplete = true;
        emit StrokeEnd(msg.sender, strokeId);
    }

    /**
     * @notice 한번에 전체 획 그리기 (시작 + 점들 + 끝)
     * @param points 좌표 배열 [x1, y1, x2, y2, ...]
     * @param color 색상
     * @param brushSize 브러시 크기
     */
    function drawCompleteStroke(
        uint16[] calldata points,
        uint8 color,
        uint8 brushSize
    ) external onlyActiveUser returns (uint256 strokeId) {
        require(points.length >= 4 && points.length % 2 == 0, "Need at least 2 points");
        require(color < 16, "Invalid color");
        require(brushSize > 0 && brushSize <= 20, "Invalid brush size");

        strokeId = totalStrokes++;

        strokes[strokeId] = Stroke({
            user: msg.sender,
            color: color,
            brushSize: brushSize,
            isComplete: true
        });

        users[msg.sender].strokeCount++;

        // 시작
        emit StrokeStart(msg.sender, strokeId, points[0], points[1], color, brushSize);

        // 중간 점들
        for (uint i = 2; i < points.length; i += 2) {
            emit StrokeMove(msg.sender, strokeId, points[i], points[i+1]);
        }

        // 종료
        emit StrokeEnd(msg.sender, strokeId);
    }

    /**
     * @notice 캔버스 클리어 (모든 유저 동의 필요? 또는 단독?)
     * @dev 단순화를 위해 누구나 클리어 가능하게 함
     */
    function clearCanvas() external onlyActiveUser {
        canvasVersion++;
        emit CanvasCleared(msg.sender);
    }

    /**
     * @notice 세션 나가기
     */
    function leave() external onlyActiveUser {
        users[msg.sender].isActive = false;

        // activeUsers에서 제거
        for (uint i = 0; i < activeUsers.length; i++) {
            if (activeUsers[i] == msg.sender) {
                activeUsers[i] = activeUsers[activeUsers.length - 1];
                activeUsers.pop();
                break;
            }
        }

        emit UserLeft(msg.sender);
    }

    // ===== 조회 함수 =====

    function getActiveUserCount() external view returns (uint256) {
        return activeUsers.length;
    }

    function getActiveUsers() external view returns (address[] memory) {
        return activeUsers;
    }

    function getUserInfo(address user) external view returns (
        string memory nickname,
        bool isActive,
        uint256 strokeCount
    ) {
        User memory u = users[user];
        return (u.nickname, u.isActive, u.strokeCount);
    }

    function getStrokeInfo(uint256 strokeId) external view returns (
        address user,
        uint8 color,
        uint8 brushSize,
        bool isComplete
    ) {
        Stroke memory s = strokes[strokeId];
        return (s.user, s.color, s.brushSize, s.isComplete);
    }
}

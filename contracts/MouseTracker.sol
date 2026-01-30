// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MouseTracker
 * @notice 실시간 온체인 마우스 트래커 - CipherBFT L1용
 * @dev 10ms 미니블록 덕분에 실시간처럼 동작
 */
contract MouseTracker {
    
    // 커서 이동 이벤트 - 클라이언트가 eth_subscribe로 구독
    event CursorMoved(
        address indexed user,
        uint16 x,
        uint16 y,
        uint256 timestamp
    );
    
    // 유저 입장/퇴장 이벤트
    event UserJoined(address indexed user, string nickname);
    event UserLeft(address indexed user);
    
    // 유저 정보
    struct User {
        string nickname;
        uint16 lastX;
        uint16 lastY;
        bool isActive;
    }
    
    mapping(address => User) public users;
    address[] public activeUsers;
    
    /**
     * @notice 세션 참가
     * @param nickname 표시할 닉네임
     */
    function join(string calldata nickname) external {
        require(!users[msg.sender].isActive, "Already joined");
        
        users[msg.sender] = User({
            nickname: nickname,
            lastX: 0,
            lastY: 0,
            isActive: true
        });
        
        activeUsers.push(msg.sender);
        emit UserJoined(msg.sender, nickname);
    }
    
    /**
     * @notice 커서 위치 업데이트 - 핵심 함수!
     * @param x X 좌표 (0-65535)
     * @param y Y 좌표 (0-65535)
     */
    function moveCursor(uint16 x, uint16 y) external {
        require(users[msg.sender].isActive, "Not joined");
        
        users[msg.sender].lastX = x;
        users[msg.sender].lastY = y;
        
        emit CursorMoved(msg.sender, x, y, block.timestamp);
    }
    
    /**
     * @notice 배치로 커서 업데이트 (가스 최적화)
     * @param positions 여러 좌표를 한번에 (x1,y1,x2,y2,...)
     */
    function moveCursorBatch(uint16[] calldata positions) external {
        require(users[msg.sender].isActive, "Not joined");
        require(positions.length >= 2 && positions.length % 2 == 0, "Invalid positions");
        
        // 마지막 위치만 저장
        uint16 lastX = positions[positions.length - 2];
        uint16 lastY = positions[positions.length - 1];
        
        users[msg.sender].lastX = lastX;
        users[msg.sender].lastY = lastY;
        
        // 모든 위치에 대해 이벤트 발생
        for (uint i = 0; i < positions.length; i += 2) {
            emit CursorMoved(msg.sender, positions[i], positions[i+1], block.timestamp);
        }
    }
    
    /**
     * @notice 세션 나가기
     */
    function leave() external {
        require(users[msg.sender].isActive, "Not joined");
        
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
    
    /**
     * @notice 활성 유저 수 조회
     */
    function getActiveUserCount() external view returns (uint256) {
        return activeUsers.length;
    }
    
    /**
     * @notice 모든 활성 유저 조회
     */
    function getActiveUsers() external view returns (address[] memory) {
        return activeUsers;
    }
    
    /**
     * @notice 유저 정보 조회
     */
    function getUserInfo(address user) external view returns (
        string memory nickname,
        uint16 x,
        uint16 y,
        bool isActive
    ) {
        User memory u = users[user];
        return (u.nickname, u.lastX, u.lastY, u.isActive);
    }
}

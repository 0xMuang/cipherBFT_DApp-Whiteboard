// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CollaborationBoard} from "./CollaborationBoard.sol";

/**
 * @title BoardRegistry
 * @notice 화이트보드 목록 관리 및 생성
 */
contract BoardRegistry {

    struct BoardInfo {
        address boardAddress;
        string name;
        address creator;
        uint256 createdAt;
        bool allowAnyoneDelete;  // 누구나 삭제 가능 여부
    }

    BoardInfo[] public boards;
    mapping(address => uint256[]) public userBoards; // 유저가 만든 보드 인덱스

    event BoardCreated(
        uint256 indexed boardId,
        address indexed boardAddress,
        string name,
        address indexed creator,
        bool allowAnyoneDelete
    );

    /**
     * @notice 새 화이트보드 생성
     * @param name 보드 이름
     * @param allowAnyoneDelete true면 누구나 삭제 가능, false면 본인만
     */
    function createBoard(string calldata name, bool allowAnyoneDelete) external returns (uint256 boardId, address boardAddress) {
        CollaborationBoard newBoard = new CollaborationBoard(allowAnyoneDelete);
        boardAddress = address(newBoard);
        boardId = boards.length;

        boards.push(BoardInfo({
            boardAddress: boardAddress,
            name: name,
            creator: msg.sender,
            createdAt: block.timestamp,
            allowAnyoneDelete: allowAnyoneDelete
        }));

        userBoards[msg.sender].push(boardId);

        emit BoardCreated(boardId, boardAddress, name, msg.sender, allowAnyoneDelete);
    }

    /**
     * @notice 전체 보드 개수
     */
    function getBoardCount() external view returns (uint256) {
        return boards.length;
    }

    /**
     * @notice 보드 정보 조회
     */
    function getBoard(uint256 boardId) external view returns (
        address boardAddress,
        string memory name,
        address creator,
        uint256 createdAt,
        bool allowAnyoneDelete
    ) {
        require(boardId < boards.length, "Board not found");
        BoardInfo memory board = boards[boardId];
        return (board.boardAddress, board.name, board.creator, board.createdAt, board.allowAnyoneDelete);
    }

    /**
     * @notice 모든 보드 목록 조회
     */
    function getAllBoards() external view returns (BoardInfo[] memory) {
        return boards;
    }

    /**
     * @notice 특정 유저가 만든 보드 목록
     */
    function getUserBoards(address user) external view returns (uint256[] memory) {
        return userBoards[user];
    }
}

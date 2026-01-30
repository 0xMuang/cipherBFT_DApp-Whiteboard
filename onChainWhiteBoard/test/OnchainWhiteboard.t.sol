// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {OnchainWhiteboard} from "../src/OnchainWhiteboard.sol";

contract OnchainWhiteboardTest is Test {
    OnchainWhiteboard public whiteboard;
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    event StrokeStart(address indexed user, uint256 indexed strokeId, uint16 x, uint16 y, uint8 color, uint8 brushSize);
    event StrokeMove(address indexed user, uint256 indexed strokeId, uint16 x, uint16 y);
    event StrokeEnd(address indexed user, uint256 indexed strokeId);
    event CanvasCleared(address indexed user);
    event UserJoined(address indexed user, string nickname);

    function setUp() public {
        whiteboard = new OnchainWhiteboard();
    }

    function test_Join() public {
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit UserJoined(user1, "Artist1");
        whiteboard.join("Artist1");

        (string memory nickname, bool isActive, uint256 strokeCount) = whiteboard.getUserInfo(user1);
        assertEq(nickname, "Artist1");
        assertTrue(isActive);
        assertEq(strokeCount, 0);
    }

    function test_StartStroke() public {
        vm.startPrank(user1);
        whiteboard.join("Artist1");

        vm.expectEmit(true, true, false, true);
        emit StrokeStart(user1, 0, 100, 200, 5, 3);
        uint256 strokeId = whiteboard.startStroke(100, 200, 5, 3);

        assertEq(strokeId, 0);
        assertEq(whiteboard.totalStrokes(), 1);

        (address strokeUser, uint8 color, uint8 brushSize, bool isComplete) = whiteboard.getStrokeInfo(strokeId);
        assertEq(strokeUser, user1);
        assertEq(color, 5);
        assertEq(brushSize, 3);
        assertFalse(isComplete);
        vm.stopPrank();
    }

    function test_MoveAndEndStroke() public {
        vm.startPrank(user1);
        whiteboard.join("Artist1");

        uint256 strokeId = whiteboard.startStroke(100, 200, 5, 3);

        vm.expectEmit(true, true, false, true);
        emit StrokeMove(user1, strokeId, 150, 250);
        whiteboard.moveStroke(strokeId, 150, 250);

        vm.expectEmit(true, true, false, false);
        emit StrokeEnd(user1, strokeId);
        whiteboard.endStroke(strokeId);

        (,,, bool isComplete) = whiteboard.getStrokeInfo(strokeId);
        assertTrue(isComplete);
        vm.stopPrank();
    }

    function test_DrawCompleteStroke() public {
        vm.startPrank(user1);
        whiteboard.join("Artist1");

        uint16[] memory points = new uint16[](6);
        points[0] = 0;
        points[1] = 0;
        points[2] = 100;
        points[3] = 100;
        points[4] = 200;
        points[5] = 200;

        uint256 strokeId = whiteboard.drawCompleteStroke(points, 3, 5);

        (address strokeUser,,, bool isComplete) = whiteboard.getStrokeInfo(strokeId);
        assertEq(strokeUser, user1);
        assertTrue(isComplete);

        (, , uint256 strokeCount) = whiteboard.getUserInfo(user1);
        assertEq(strokeCount, 1);
        vm.stopPrank();
    }

    function test_ClearCanvas() public {
        vm.startPrank(user1);
        whiteboard.join("Artist1");

        assertEq(whiteboard.canvasVersion(), 0);

        vm.expectEmit(true, false, false, false);
        emit CanvasCleared(user1);
        whiteboard.clearCanvas();

        assertEq(whiteboard.canvasVersion(), 1);
        vm.stopPrank();
    }

    function test_RevertWhen_InvalidColor() public {
        vm.startPrank(user1);
        whiteboard.join("Artist1");
        vm.expectRevert("Invalid color");
        whiteboard.startStroke(100, 200, 16, 3); // color 16 is invalid (max 15)
        vm.stopPrank();
    }

    function test_RevertWhen_InvalidBrushSize() public {
        vm.startPrank(user1);
        whiteboard.join("Artist1");
        vm.expectRevert("Invalid brush size");
        whiteboard.startStroke(100, 200, 5, 21); // brushSize 21 is invalid (max 20)
        vm.stopPrank();
    }
}

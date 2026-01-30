// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {MouseTracker} from "../src/MouseTracker.sol";

contract MouseTrackerTest is Test {
    MouseTracker public tracker;
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    event CursorMoved(address indexed user, uint16 x, uint16 y, uint256 timestamp);
    event UserJoined(address indexed user, string nickname);
    event UserLeft(address indexed user);

    function setUp() public {
        tracker = new MouseTracker();
    }

    function test_Join() public {
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit UserJoined(user1, "Alice");
        tracker.join("Alice");

        (string memory nickname, uint16 x, uint16 y, bool isActive) = tracker.getUserInfo(user1);
        assertEq(nickname, "Alice");
        assertEq(x, 0);
        assertEq(y, 0);
        assertTrue(isActive);
        assertEq(tracker.getActiveUserCount(), 1);
    }

    function test_MoveCursor() public {
        vm.startPrank(user1);
        tracker.join("Alice");

        vm.expectEmit(true, false, false, true);
        emit CursorMoved(user1, 100, 200, block.timestamp);
        tracker.moveCursor(100, 200);

        (, uint16 x, uint16 y,) = tracker.getUserInfo(user1);
        assertEq(x, 100);
        assertEq(y, 200);
        vm.stopPrank();
    }

    function test_MoveCursorBatch() public {
        vm.startPrank(user1);
        tracker.join("Alice");

        uint16[] memory positions = new uint16[](4);
        positions[0] = 10;
        positions[1] = 20;
        positions[2] = 30;
        positions[3] = 40;

        tracker.moveCursorBatch(positions);

        (, uint16 x, uint16 y,) = tracker.getUserInfo(user1);
        assertEq(x, 30); // 마지막 x
        assertEq(y, 40); // 마지막 y
        vm.stopPrank();
    }

    function test_Leave() public {
        vm.startPrank(user1);
        tracker.join("Alice");

        vm.expectEmit(true, false, false, false);
        emit UserLeft(user1);
        tracker.leave();

        (,,, bool isActive) = tracker.getUserInfo(user1);
        assertFalse(isActive);
        assertEq(tracker.getActiveUserCount(), 0);
        vm.stopPrank();
    }

    function test_MultipleUsers() public {
        vm.prank(user1);
        tracker.join("Alice");

        vm.prank(user2);
        tracker.join("Bob");

        assertEq(tracker.getActiveUserCount(), 2);

        address[] memory users = tracker.getActiveUsers();
        assertEq(users.length, 2);
    }

    function test_RevertWhen_JoinTwice() public {
        vm.startPrank(user1);
        tracker.join("Alice");
        vm.expectRevert("Already joined");
        tracker.join("Alice Again");
        vm.stopPrank();
    }

    function test_RevertWhen_MoveWithoutJoin() public {
        vm.prank(user1);
        vm.expectRevert("Not joined");
        tracker.moveCursor(100, 200);
    }
}

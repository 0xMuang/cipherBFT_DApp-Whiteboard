// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {CollaborationBoard} from "../src/CollaborationBoard.sol";

contract CollaborationBoardTest is Test {
    CollaborationBoard public board;
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    // Events
    event ObjectCreated(
        address indexed creator,
        uint256 indexed objectId,
        CollaborationBoard.ObjectType objectType,
        uint8 colorIndex,
        uint8 strokeWidth,
        uint16 layer
    );
    event StrokePoints(uint256 indexed objectId, int16[] points);
    event ShapeGeometry(uint256 indexed objectId, int32 x, int32 y, uint16 width, uint16 height, uint16 rotation);
    event StickyNoteData(uint256 indexed objectId, int32 x, int32 y, uint16 width, uint16 height, string content, uint8 bgColorIndex);
    event TextData(uint256 indexed objectId, int32 x, int32 y, string content, uint8 fontSize);
    event ObjectMoved(address indexed user, uint256 indexed objectId, int32 newX, int32 newY);
    event ObjectResized(address indexed user, uint256 indexed objectId, uint16 newWidth, uint16 newHeight);
    event ObjectDeleted(address indexed user, uint256 indexed objectId);
    event LayerChanged(uint256 indexed objectId, uint16 oldLayer, uint16 newLayer);
    event ContentUpdated(uint256 indexed objectId, string newContent);
    event UserJoined(address indexed user, string nickname);
    event CanvasCleared(address indexed user);

    function setUp() public {
        board = new CollaborationBoard(false);
    }

    // ===== USER TESTS =====

    function test_Join() public {
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit UserJoined(user1, "Designer1");
        board.join("Designer1");

        (string memory nickname, bool isActive, uint256 objectCount) = board.getUserInfo(user1);
        assertEq(nickname, "Designer1");
        assertTrue(isActive);
        assertEq(objectCount, 0);
    }

    function test_RevertWhen_JoinTwice() public {
        vm.startPrank(user1);
        board.join("Designer1");
        vm.expectRevert("Already joined");
        board.join("Designer1Again");
        vm.stopPrank();
    }

    // ===== STROKE TESTS =====

    function test_CreateStroke() public {
        vm.startPrank(user1);
        board.join("Designer1");

        int16[] memory points = new int16[](6);
        points[0] = 0;
        points[1] = 0;
        points[2] = 100;
        points[3] = 100;
        points[4] = 200;
        points[5] = 200;

        uint256 objectId = board.createStroke(points, 5, 3);

        assertEq(objectId, 0);
        assertEq(board.totalObjects(), 1);

        (
            address creator,
            CollaborationBoard.ObjectType objType,
            uint8 colorIndex,
            uint8 strokeWidth,
            uint16 layer,
            bool isLocked,
            bool isDeleted
        ) = board.getObjectInfo(objectId);

        assertEq(creator, user1);
        assertEq(uint8(objType), uint8(CollaborationBoard.ObjectType.STROKE));
        assertEq(colorIndex, 5);
        assertEq(strokeWidth, 3);
        assertEq(layer, 1);
        assertFalse(isLocked);
        assertFalse(isDeleted);
        vm.stopPrank();
    }

    // ===== SHAPE TESTS =====

    function test_CreateRectangle() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createShape(
            CollaborationBoard.ObjectType.RECTANGLE,
            100,  // x
            200,  // y
            300,  // width
            150,  // height
            0,    // rotation
            2,    // colorIndex
            2     // strokeWidth
        );

        assertEq(objectId, 0);

        (
            address creator,
            CollaborationBoard.ObjectType objType,
            ,,,,
        ) = board.getObjectInfo(objectId);

        assertEq(creator, user1);
        assertEq(uint8(objType), uint8(CollaborationBoard.ObjectType.RECTANGLE));
        vm.stopPrank();
    }

    function test_CreateEllipse() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createShape(
            CollaborationBoard.ObjectType.ELLIPSE,
            50, 50, 100, 100, 0, 3, 2
        );

        (, CollaborationBoard.ObjectType objType,,,,,) = board.getObjectInfo(objectId);
        assertEq(uint8(objType), uint8(CollaborationBoard.ObjectType.ELLIPSE));
        vm.stopPrank();
    }

    function test_CreateArrow() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createShape(
            CollaborationBoard.ObjectType.ARROW,
            0, 0, 200, 100, 450, 0, 3  // rotation 45 degrees = 450
        );

        (, CollaborationBoard.ObjectType objType,,,,,) = board.getObjectInfo(objectId);
        assertEq(uint8(objType), uint8(CollaborationBoard.ObjectType.ARROW));
        vm.stopPrank();
    }

    function test_RevertWhen_InvalidShapeType() public {
        vm.startPrank(user1);
        board.join("Designer1");

        vm.expectRevert("Invalid shape type");
        board.createShape(
            CollaborationBoard.ObjectType.STROKE,  // STROKE is not a valid shape type
            0, 0, 100, 100, 0, 0, 2
        );
        vm.stopPrank();
    }

    // ===== STICKY NOTE TESTS =====

    function test_CreateStickyNote() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createStickyNote(
            100, 100,    // x, y
            200, 150,    // width, height
            "Hello World!",
            0            // bgColorIndex (yellow)
        );

        (, CollaborationBoard.ObjectType objType,,,,,) = board.getObjectInfo(objectId);
        assertEq(uint8(objType), uint8(CollaborationBoard.ObjectType.STICKY_NOTE));
        vm.stopPrank();
    }

    function test_UpdateStickyNote() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createStickyNote(100, 100, 200, 150, "Original", 0);

        vm.expectEmit(true, false, false, true);
        emit ContentUpdated(objectId, "Updated Content");
        board.updateStickyNote(objectId, "Updated Content");
        vm.stopPrank();
    }

    // ===== TEXT TESTS =====

    function test_CreateText() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createText(
            50, 50,
            "Sample Text",
            0,    // colorIndex (black)
            16    // fontSize
        );

        (, CollaborationBoard.ObjectType objType,,,,,) = board.getObjectInfo(objectId);
        assertEq(uint8(objType), uint8(CollaborationBoard.ObjectType.TEXT));
        vm.stopPrank();
    }

    function test_RevertWhen_InvalidFontSize() public {
        vm.startPrank(user1);
        board.join("Designer1");

        vm.expectRevert("Invalid font size");
        board.createText(50, 50, "Text", 0, 5);  // fontSize 5 < 8
        vm.stopPrank();
    }

    // ===== TRANSFORMATION TESTS =====

    function test_MoveObject() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createShape(
            CollaborationBoard.ObjectType.RECTANGLE,
            0, 0, 100, 100, 0, 0, 2
        );

        vm.expectEmit(true, true, false, true);
        emit ObjectMoved(user1, objectId, 500, 500);
        board.moveObject(objectId, 500, 500);
        vm.stopPrank();
    }

    function test_ResizeObject() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createShape(
            CollaborationBoard.ObjectType.RECTANGLE,
            0, 0, 100, 100, 0, 0, 2
        );

        vm.expectEmit(true, true, false, true);
        emit ObjectResized(user1, objectId, 200, 300);
        board.resizeObject(objectId, 200, 300);
        vm.stopPrank();
    }

    function test_DeleteObject() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createShape(
            CollaborationBoard.ObjectType.RECTANGLE,
            0, 0, 100, 100, 0, 0, 2
        );

        vm.expectEmit(true, true, false, false);
        emit ObjectDeleted(user1, objectId);
        board.deleteObject(objectId);

        (,,,,,, bool isDeleted) = board.getObjectInfo(objectId);
        assertTrue(isDeleted);
        vm.stopPrank();
    }

    function test_RevertWhen_NotOwner() public {
        vm.prank(user1);
        board.join("Designer1");

        vm.prank(user1);
        uint256 objectId = board.createShape(
            CollaborationBoard.ObjectType.RECTANGLE,
            0, 0, 100, 100, 0, 0, 2
        );

        vm.prank(user2);
        board.join("Designer2");

        vm.prank(user2);
        vm.expectRevert("Not owner");
        board.moveObject(objectId, 100, 100);
    }

    // ===== LAYER TESTS =====

    function test_BringToFront() public {
        vm.startPrank(user1);
        board.join("Designer1");

        // Create 3 objects
        board.createShape(CollaborationBoard.ObjectType.RECTANGLE, 0, 0, 100, 100, 0, 0, 2);
        board.createShape(CollaborationBoard.ObjectType.RECTANGLE, 50, 50, 100, 100, 0, 1, 2);
        uint256 objectId = board.createShape(CollaborationBoard.ObjectType.RECTANGLE, 100, 100, 100, 100, 0, 2, 2);

        // First object's layer should be 1
        (,,,,uint16 layer1,,) = board.getObjectInfo(0);
        assertEq(layer1, 1);

        // Bring first object to front
        board.bringToFront(0);

        (,,,,uint16 newLayer,,) = board.getObjectInfo(0);
        assertEq(newLayer, 4);  // Should be maxLayer + 1
        vm.stopPrank();
    }

    function test_SendToBack() public {
        vm.startPrank(user1);
        board.join("Designer1");

        board.createShape(CollaborationBoard.ObjectType.RECTANGLE, 0, 0, 100, 100, 0, 0, 2);
        uint256 objectId = board.createShape(CollaborationBoard.ObjectType.RECTANGLE, 50, 50, 100, 100, 0, 1, 2);

        board.sendToBack(objectId);

        (,,,,uint16 layer,,) = board.getObjectInfo(objectId);
        assertEq(layer, 0);
        vm.stopPrank();
    }

    function test_SetObjectLayer() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createShape(CollaborationBoard.ObjectType.RECTANGLE, 0, 0, 100, 100, 0, 0, 2);

        vm.expectEmit(true, false, false, true);
        emit LayerChanged(objectId, 1, 10);
        board.setObjectLayer(objectId, 10);

        (,,,,uint16 layer,,) = board.getObjectInfo(objectId);
        assertEq(layer, 10);
        vm.stopPrank();
    }

    // ===== LOCK TESTS =====

    function test_ToggleLock() public {
        vm.startPrank(user1);
        board.join("Designer1");

        uint256 objectId = board.createShape(CollaborationBoard.ObjectType.RECTANGLE, 0, 0, 100, 100, 0, 0, 2);

        board.toggleLock(objectId);

        (,,,,,bool isLocked,) = board.getObjectInfo(objectId);
        assertTrue(isLocked);

        // Should not be able to move locked object
        vm.expectRevert("Object locked");
        board.moveObject(objectId, 100, 100);
        vm.stopPrank();
    }

    // ===== CANVAS TESTS =====

    function test_ClearCanvas() public {
        vm.startPrank(user1);
        board.join("Designer1");

        assertEq(board.canvasVersion(), 0);

        vm.expectEmit(true, false, false, false);
        emit CanvasCleared(user1);
        board.clearCanvas();

        assertEq(board.canvasVersion(), 1);
        vm.stopPrank();
    }

    // ===== MULTIPLE USERS =====

    function test_MultipleUsersCollaboration() public {
        // User1 joins and creates a rectangle
        vm.prank(user1);
        board.join("Designer1");

        vm.prank(user1);
        uint256 rect1 = board.createShape(CollaborationBoard.ObjectType.RECTANGLE, 0, 0, 100, 100, 0, 0, 2);

        // User2 joins and creates a sticky note
        vm.prank(user2);
        board.join("Designer2");

        vm.prank(user2);
        uint256 note1 = board.createStickyNote(200, 200, 150, 100, "User2's note", 1);

        // Both objects should exist
        assertEq(board.totalObjects(), 2);

        // User1 can only modify their own object
        vm.prank(user1);
        board.moveObject(rect1, 50, 50);

        // User2 can only modify their own object
        vm.prank(user2);
        board.updateStickyNote(note1, "Updated note");

        // Active users should be 2
        assertEq(board.getActiveUserCount(), 2);
    }
}

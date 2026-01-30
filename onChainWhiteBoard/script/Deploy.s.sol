// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {MouseTracker} from "../src/MouseTracker.sol";
import {OnchainWhiteboard} from "../src/OnchainWhiteboard.sol";
import {CollaborationBoard} from "../src/CollaborationBoard.sol";

contract DeployScript is Script {
    function run() public {
        vm.startBroadcast();

        // MouseTracker 배포
        MouseTracker mouseTracker = new MouseTracker();
        console.log("MouseTracker deployed at:", address(mouseTracker));

        // OnchainWhiteboard 배포
        OnchainWhiteboard whiteboard = new OnchainWhiteboard();
        console.log("OnchainWhiteboard deployed at:", address(whiteboard));

        // CollaborationBoard 배포
        CollaborationBoard collab = new CollaborationBoard();
        console.log("CollaborationBoard deployed at:", address(collab));

        vm.stopBroadcast();
    }
}

contract DeployMouseTracker is Script {
    function run() public {
        vm.startBroadcast();

        MouseTracker mouseTracker = new MouseTracker();
        console.log("MouseTracker deployed at:", address(mouseTracker));

        vm.stopBroadcast();
    }
}

contract DeployWhiteboard is Script {
    function run() public {
        vm.startBroadcast();

        OnchainWhiteboard whiteboard = new OnchainWhiteboard();
        console.log("OnchainWhiteboard deployed at:", address(whiteboard));

        vm.stopBroadcast();
    }
}

contract DeployCollaborationBoard is Script {
    function run() public {
        vm.startBroadcast();

        CollaborationBoard collab = new CollaborationBoard();
        console.log("CollaborationBoard deployed at:", address(collab));

        vm.stopBroadcast();
    }
}

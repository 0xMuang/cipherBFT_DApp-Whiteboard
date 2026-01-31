// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CollaborationBoard} from "../src/CollaborationBoard.sol";
import {BoardRegistry} from "../src/BoardRegistry.sol";

contract DeployScript is Script {
    function run() public {
        vm.startBroadcast();

        // BoardRegistry 배포 (권장)
        BoardRegistry registry = new BoardRegistry();
        console.log("BoardRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}

contract DeployCollaborationBoard is Script {
    function run() public {
        vm.startBroadcast();

        // allowAnyoneDelete = false (본인만 삭제 가능)
        CollaborationBoard collab = new CollaborationBoard(false);
        console.log("CollaborationBoard deployed at:", address(collab));

        vm.stopBroadcast();
    }
}

contract DeployBoardRegistry is Script {
    function run() public {
        vm.startBroadcast();

        BoardRegistry registry = new BoardRegistry();
        console.log("BoardRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}

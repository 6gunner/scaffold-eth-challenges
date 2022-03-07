  // SPDX-License-Identifier: GPL-3.0

  pragma solidity 0.8.4;

  import "hardhat/console.sol";
  import "./ExampleExternalContract.sol";

  contract Staker {

    ExampleExternalContract public exampleExternalContract;

    mapping (address => uint256) public balances;

    uint256 public constant threshold = 1 ether;
    uint256 public deadline = block.timestamp  + 1 minutes; // 合约部署的时候会声明初始化

    bool openForWithdraw = false;

    event Stake(address,uint256);

    event Received(address, uint256);

    constructor(address exampleExternalContractAddress) {
        exampleExternalContract = ExampleExternalContract(exampleExternalContractAddress);
    }

    modifier notCompleted() {
      require(
          !exampleExternalContract.completed(),
          "staking process already completed."
      );
      _;
    }

    // Collect funds in a payable `stake()` function and track individual `balances` with a mapping:
    //  ( make sure to add a `Stake(address,uint256)` event and emit it for the frontend <List/> display )
    function stake() payable public notCompleted {
      require(block.timestamp < deadline, "Stake is over, not allowed to execute");
      balances[msg.sender] += msg.value; // 可能用户之前也stake过
      emit Stake(msg.sender, msg.value);
    }

    // After some `deadline` allow anyone to call an `execute()` function
    //  It should either call `exampleExternalContract.complete{value: address(this).balance}()` to send all the value
    function execute() public notCompleted {
      require(block.timestamp > deadline, "Deadline is not reached yet");

      uint256 contractBalance = address(this).balance;
      if (address(this).balance > threshold) {
        openForWithdraw = false;
        // exampleExternalContract.complete{value: contractBalance}();
        (bool sent,) = address(exampleExternalContract).call{value: contractBalance}(abi.encodeWithSignature("complete()"));
        require(sent, "exampleExternalContract.complete failed");
      } else {
        openForWithdraw = true;
      }
    }
    // if the `threshold` was not met, allow everyone to call a `withdraw()` function
    // Add a `withdraw(address payable)` function lets users withdraw their balance
    function withdraw(address payable _to) public notCompleted {
      require(openForWithdraw, "not allowed to withdraw");
      require(block.timestamp > deadline, "Deadline is not reached yet");
      uint256 userBalance = balances[_to];
      require(userBalance > 0, "User has no enough balance");
      balances[_to] = 0;
      (bool sent,) = _to.call{value: userBalance}("");
      require(sent, "Failed to send user balance back to the user");
    }

    // Add a `timeLeft()` view function that returns the time left before the deadline for the frontend
    function timeLeft() view public returns (uint) {
      if (block.timestamp > deadline) {
        return 0;
      }
      return deadline - block.timestamp;
    }

    // Add the `receive()` special function that receives eth and calls stake()
    receive() external payable {
      stake();
      emit Received(msg.sender, msg.value);
    }

  }

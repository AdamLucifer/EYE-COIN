pragma solidity ^0.4.11;

import "./EYEFactory.sol";

contract EYE {

    struct Brother {
        uint balance;
        uint credit; // wei amount to reset balance to 100%
        address class;
    }

    mapping(address => Brother) public brothers;

    address factory;
    address public owner;
    uint public brothersCount = 0;
    uint public totalCredit = 0;


    event NewBrother(address brother, address class);
    event Kicked(address brother, address class);
    event Debit(address indexed brother, uint amount, uint balanceBefore, uint balanceAfter, uint creditReduced);
    event Credit(address indexed brother, uint amount, uint balanceBefore, uint balanceAfter);


    modifier onlyOwner() {

        if (msg.sender != owner) {
            throw;
        }

        _;
    }

    modifier onlyBrother(address _account) {

        if (!isBrother(_account)) {
            throw;
        }

        _;
    }


    function isBrother(address _account) constant returns(bool) {

        return brothers[_account].class != address(0);
    }

    function initBalance() constant returns(uint) {

        return 100000000000000;
    }

    function maxBrothersCount() constant returns(uint) {

        return 13;
    }

    function newBrother(address _account, address _class) internal returns(bool) {

        brothers[_account] = Brother(initBalance(), 0, _class);
        brothersCount++;
        NewBrother(_account, _class);

        return true;
    }

    function init(address _owner, address _factory) returns(bool) {

        if (brothersCount > 0) {
            return false;
        }

        owner = _owner;
        factory = _factory;

        return newBrother(_owner, this);
    }

    function() payable onlyBrother(msg.sender) { // debit

        Brother brother = brothers[msg.sender];

        if (msg.value == 0) {
            throw;
        }

        uint _creditReduced = 0;
        uint _balanceBefore = brother.balance;

        if (brother.credit > 0) {
            uint _newCredit = brother.credit - msg.value;
            _creditReduced = brother.credit - _newCredit;

            uint _recentPercents = initBalance() - brother.balance;
            brother.balance += (initBalance() * _recentPercents) / (initBalance() * brother.credit / _creditReduced);

            if (brother.balance > initBalance()) {
                brother.balance = initBalance();
            }

            brother.credit = _newCredit;
            totalCredit -= _creditReduced;
        }

        Debit(msg.sender, msg.value, _balanceBefore, brother.balance, _creditReduced);
    }

    function credit(uint _amount) onlyBrother(msg.sender) returns(bool) {

        Brother brother = brothers[msg.sender];

        if (_amount > available()) {
            return false;
        }

        uint _balanceBefore = brother.balance;
        brother.balance -= (initBalance() ** 2) / (initBalance() * availableTotal() / _amount);

        if (!msg.sender.send(_amount)) {
            return false;
        }

        brother.credit += _amount;
        totalCredit += _amount;

        Credit(msg.sender, _amount, _balanceBefore, brother.balance);

        return true;
    }

    function enroll(address _newBrother) onlyOwner returns(bool) {

        if (isBrother(_newBrother) || brothersCount == maxBrothersCount()) {
            return false;
        }

        address _newEYE = EYEFactory(factory).create();
        EYE(_newEYE).init(_newBrother, factory);

        newBrother(_newBrother, _newEYE);

        return true;
    }

    function kick(address _brother) onlyOwner onlyBrother(_brother) returns(bool) {

        if (_brother == owner) {
            return false;
        }

        totalCredit -= brothers[_brother].credit;

        Kicked(_brother, brothers[_brother].class);

        delete brothers[_brother];

        brothersCount--;

        return true;
    }

    function availableTotal() constant returns(uint) {

        return (this.balance + totalCredit) / brothersCount;
    }

    function available() onlyBrother(msg.sender) constant returns(uint) {

        return (availableTotal() * initBalance()) / ((initBalance() ** 2) / brothers[msg.sender].balance);
    }

    function balanceOf(address _brother) onlyBrother(_brother) constant returns(uint) {

        return brothers[_brother].balance;
    }

    function creditOf(address _brother) onlyBrother(_brother) constant returns(uint) {

        return brothers[_brother].credit;
    }

    function classOf(address _brother) onlyBrother(_brother) constant returns(address) {

        return brothers[_brother].class;
    }

    function symbol() constant returns(string) {

        return "EYE";
    }

    function whatIsIt() constant returns(string) {

        return "FUND OF BROTHERHOOD OF MAN – EVERYTHING IS HOW IT SHOULD BE";
    }

    function whatIsLove() constant returns(string) {

        return "IF YOU WANT ME, IF YOU NEED ME, IM YOURS";
    }

    function copyright() constant returns(string) {

        return "Adam Lucifer";
    }

    function website() constant returns(string) {

        return "https://github.com/AdamLucifer/EYE-COIN";
    }

}

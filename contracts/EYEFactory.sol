pragma solidity ^0.4.11;

import "./EYE.sol";

contract EYEFactory {

    function create() constant returns(address) {

        return new EYE();
    }

}

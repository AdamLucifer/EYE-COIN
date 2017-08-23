const EYE = artifacts.require('./EYE.sol')
const EYEFactory = artifacts.require('./EYEFactory.sol')

module.exports = (deployer) => {

  deployer.deploy(EYE);
  deployer.deploy(EYEFactory);
}

const EYE = artifacts.require('./EYE.sol')
const EYEFactory = artifacts.require('./EYEFactory.sol')
const BigNumber = require('../node_modules/bignumber.js/bignumber.js')

contract('EYE', (accounts) => {

  it('should init contract', async () => {

    const eye = await EYE.deployed()
    const eyeFactory = await EYEFactory.deployed()

    assert.equal(await eye.init.call(accounts[0], eyeFactory.address), true, 'Init failed')

    await eye.init(accounts[0], eyeFactory.address)

    assert.equal(await eye.isBrother.call(accounts[0]), true, 'Init failed, not is brother')
    assert.equal(await eye.owner.call(accounts[0]), accounts[0], 'Init failed, not owner')
    assert.equal(await eye.classOf.call(accounts[0]), eye.address, 'Init failed, wrong class')

    const balanceOf0 = await eye.balanceOf.call(accounts[0])
    const initBalance = await eye.initBalance.call()
    assert.equal(balanceOf0.valueOf(), initBalance.valueOf(), 'Invalid init balance')
  })

  it('should not reinit contract', async () => {

    const eye = await EYE.deployed()
    const eyeFactory = await EYEFactory.deployed()
    const result = await eye.init.call(accounts[1], eyeFactory.address)
    assert.equal(result, false, 'Reinit should fail')
  })

  it('should debit', async () => {

    const eye = await EYE.deployed()

    const amount = web3.toWei(10, 'ether')

    await web3.eth.sendTransaction({from: accounts[0], to: eye.address, value: amount})

    const contractBalance = await web3.eth.getBalance(eye.address)
    assert.equal(contractBalance, amount, 'Invalid contract balance after debit')

    const brothersCount = await eye.brothersCount.call()
    const expectedAvailable = contractBalance.div(brothersCount).valueOf().split('.')[0]
    const available = await eye.available.call()
    const availableTotal = await eye.availableTotal.call()

    assert.equal(availableTotal.valueOf(), available.valueOf(), 'Invalid available total after debit')
    assert.equal(available.valueOf(), expectedAvailable, 'Invalid available after debit')

    const initBalance = await eye.initBalance.call()

    const log = await getDebitLog(eye)
    assert.equal(log.event, 'Debit', 'Debit event not emitted')
    assert.equal(log.args.brother, accounts[0], 'Debit event wrong brother')
    assert.equal(log.args.amount, amount, 'Debit event wrong amount')
    assert.equal(log.args.balanceBefore.valueOf(), initBalance.valueOf(), 'Debit event wrong balanceBefore')
    assert.equal(log.args.balanceAfter.valueOf(), initBalance.valueOf(), 'Debit event wrong balanceAfter')
    assert.equal(log.args.creditReduced.valueOf(), 0, 'Debit event wrong creditReduced')
  })

  it('should enroll', async () => {

    const eye = await EYE.deployed()

    try {
      await eye.enroll.call(accounts[2], {from: accounts[1]})
      assert.equal(true, false, 'Enroll should be available only for contract owner')
    } catch (e) {
      // empty
    }

    const result = await eye.enroll(accounts[1])

    const newClass = await eye.classOf.call(accounts[1])
    const newEYE = await EYE.at(newClass)
    const newEYEOwner = await newEYE.owner.call()
    assert.equal(newEYEOwner, accounts[1])

    assert.equal(result.logs[0].event, 'NewBrother', 'NewBrother not emitted')
    assert.equal(result.logs[0].args.brother, accounts[1], 'NewBrother wrong address')
    assert.equal(result.logs[0].args.class, newEYE.address, 'NewBrother wrong class')

    await eye.enroll(accounts[2])
    await eye.enroll(accounts[3])
    await eye.enroll(accounts[4])
    await eye.enroll(accounts[5])
    await eye.enroll(accounts[6])
    await eye.enroll(accounts[7])
    await eye.enroll(accounts[8])
    await eye.enroll(accounts[9])
    await eye.enroll('0x0c3fbbfa72dfaab18488494d85e195aa26783bee')
    await eye.enroll('0x1c3fbbfa72dfaab18488494d85e195aa26783bee')
    await eye.enroll('0x2c3fbbfa72dfaab18488494d85e195aa26783bee')

    const brothersCount = await eye.brothersCount.call()
    assert.equal(brothersCount, 13)

    const overflowEnroll = await eye.enroll.call('0x4c3fbbfa72dfaab18488494d85e195aa26783bee')
    assert.equal(overflowEnroll, false, '14th brother was added but 13 is maximum number of accounts per contract')
  })

  it('should credit', async () => {

    const eye = await EYE.deployed()

    const amount = web3.toWei(0.15, 'ether')

    assert.equal(await eye.credit.call(amount), true, 'Credit failed')

    const initBalance = await eye.initBalance.call()
    const balanceBefore = await eye.balanceOf.call(accounts[0])
    assert.equal(balanceBefore.valueOf(), initBalance.valueOf(), 'Invalid balance before credit')

    const contractBalanceBefore = await web3.eth.getBalance(eye.address)
    const brothersCount = await eye.brothersCount.call()
    const availableTotal = new BigNumber(
      contractBalanceBefore.div(brothersCount).valueOf().split('.')[0]
    )
    const contractAvailableTotal = await eye.availableTotal.call()
    assert.equal(contractAvailableTotal.valueOf(), availableTotal.valueOf(), 'Invalid available total')

    const result = await eye.credit(amount)

    const contractBalance = await web3.eth.getBalance(eye.address)
    assert.equal(contractBalance.valueOf(), web3.toWei(9.85, 'ether'), 'Invalid contract balance after credit')

    const credit = await eye.creditOf.call(accounts[0])
    assert.equal(credit.valueOf(), web3.toWei(0.15, 'ether'), 'Invalid credit')

    const balance = await eye.balanceOf.call(accounts[0])
    const expectedBalance = balanceBefore.minus(
      initBalance.div(
        availableTotal.div(amount)
      ).round()
    )
    assert.equal(balance.valueOf(), expectedBalance.valueOf(), 'Invalid balance after credit')

    assert.equal(result.logs[0].event, 'Credit', 'Credit event not emitted')
    assert.equal(result.logs[0].args.brother, accounts[0], 'Credit event wrong brother')
    assert.equal(result.logs[0].args.amount, amount, 'Credit event wrong amount')
    assert.equal(result.logs[0].args.balanceBefore.valueOf(), balanceBefore.valueOf(), 'Credit event wrong balanceBefore')
    assert.equal(result.logs[0].args.balanceAfter.valueOf(), expectedBalance.valueOf(), 'Credit event wrong balanceAfter')
  })

  it('should debit after credit and reset balance', async () => {

    const eye = await EYE.deployed()

    const amount = web3.toWei(0.1, 'ether')
    const balanceBefore = await eye.balanceOf.call(accounts[0])
    const creditBefore = await eye.creditOf.call(accounts[0])
    const initBalance = await eye.initBalance.call()

    await web3.eth.sendTransaction({from: accounts[0], to: eye.address, value: amount})

    const contractBalance = await web3.eth.getBalance(eye.address)
    assert.equal(contractBalance.valueOf(), web3.toWei(9.95, 'ether'), 'Invalid contract balance after second debit')

    const expectedBalance = balanceBefore.plus(
      initBalance.minus(balanceBefore).div(
        creditBefore.div(amount)
      )
    )
    const balance = await eye.balanceOf.call(accounts[0])
    assert.equal(balance.valueOf(), expectedBalance.valueOf(), 'Invalid balance after second debit')

    const credit = await eye.creditOf.call(accounts[0])
    assert.equal(credit.valueOf(), web3.toWei(0.05, 'ether'), 'Invalid credit after second debit')

    const log = await getDebitLog(eye)
    assert.equal(log.event, 'Debit', 'Debit 2 event not emitted')
    assert.equal(log.args.brother, accounts[0], 'Debit 2 event wrong brother')
    assert.equal(log.args.amount, amount, 'Debit 2 event wrong amount')
    assert.equal(log.args.balanceBefore.valueOf(), balanceBefore.valueOf(), 'Debit 2 event wrong balanceBefore')
    assert.equal(log.args.balanceAfter.valueOf(), expectedBalance.valueOf(), 'Debit 2 event wrong balanceAfter')
    assert.equal(log.args.creditReduced.valueOf(), amount, 'Debit 2 event wrong creditReduced')
  })

  it('should kick', async () => {

    const eye = await EYE.deployed()
    const brotherClass = await eye.classOf.call(accounts[1])

    const result = await eye.kick(accounts[1])

    const isBrother = await eye.isBrother.call(accounts[1])
    assert.equal(isBrother, false, 'Kick failed')

    const brothersCount = await eye.brothersCount.call()
    assert.equal(brothersCount, 12, 'Kick wrong brothers count')

    assert.equal(result.logs[0].event, 'Kicked', 'Kicked not emitted')
    assert.equal(result.logs[0].args.brother, accounts[1], 'Kicked wrong address')
    assert.equal(result.logs[0].args.class, brotherClass, 'Kicked wrong class')
  })

})

const getDebitLog = (eye) => {
  return new Promise((resolve, reject) => {
    const filter = eye.Debit({}, {fromBlock: 'latest'})
    filter.get((e, r) => {
      if (e) {
        return reject(e)
      }
      resolve(r[0])
    })
  })
}

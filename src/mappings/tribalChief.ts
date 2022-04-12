import {
  Deposit,
  Withdraw,
  TribeWithdraw,
  EmergencyWithdraw,
  Harvest,
  LogSetPool,
  NewTribePerBlock,
  LogPoolAddition,
  LogPoolMultiplier,
  LogUpdatePool,
  PoolLocked,
  TribalChief as TribalChiefContract
} from '../types/TribalChief/TribalChief'
import {
  BIG_DECIMAL_1E12,
  BIG_DECIMAL_1E18,
  BIG_DECIMAL_ZERO,
  BIG_INT_ONE,
  BIG_INT_ONE_DAY_SECONDS,
  BIG_INT_ZERO,
  TRIBAL_CHIEF_ADDRESS,
  TRIBAL_CHIEF_START_BLOCK,
} from './helper'
import { Address, BigDecimal, BigInt, dataSource, ethereum, log } from '@graphprotocol/graph-ts'
import { History, TribalChief, Pool, PoolHistory, User } from '../types/schema'
import { getTribePrice } from './pricing'
import { ERC20 as ERC20Contract } from '../types/TribalChief/ERC20'

function getTribalChief(block: ethereum.Block): TribalChief {
  let tribalChief = TribalChief.load(TRIBAL_CHIEF_ADDRESS.toHex())

  if (tribalChief === null) {
    const contract = TribalChiefContract.bind(TRIBAL_CHIEF_ADDRESS)
    tribalChief = new TribalChief(TRIBAL_CHIEF_ADDRESS.toHex())

    // tribalChief.owner = contract.owner()
    // poolInfo ...
    tribalChief.startBlock = TRIBAL_CHIEF_START_BLOCK // contract.startBlock()
    tribalChief.tribe = contract.TRIBE()
    tribalChief.tribePerBlock = contract.tribePerBlock()
    tribalChief.totalAllocPoint = contract.totalAllocPoint()
    // userInfo ...
    tribalChief.poolCount = BIG_INT_ZERO
    // tribalChief.rewardMultiplier = 

    tribalChief.tokenBalance = BIG_DECIMAL_ZERO
    tribalChief.tokenAge = BIG_DECIMAL_ZERO
    tribalChief.tokenAgeRemoved = BIG_DECIMAL_ZERO
    tribalChief.tokenDeposited = BIG_DECIMAL_ZERO
    tribalChief.tokenWithdrawn = BIG_DECIMAL_ZERO

    tribalChief.updatedAt = block.timestamp

    tribalChief.save()
  }

  return tribalChief as TribalChief
}


export function getPool(id: BigInt, block: ethereum.Block): Pool {
  let pool = Pool.load(id.toString())

  if (pool === null) {
    const tribalChief = getTribalChief(block)

    const tribalChiefContract = TribalChiefContract.bind(TRIBAL_CHIEF_ADDRESS)
    const poolLength = tribalChiefContract.numPools()

    if (id >= poolLength) {
      return null
    }

    // Create new pool.
    pool = new Pool(id.toString())

    // Set relation
    pool.owner = tribalChief.id

    const poolInfo = tribalChiefContract.poolInfo(tribalChief.poolCount)
    const stakedToken = tribalChiefContract.stakedToken(tribalChief.poolCount)
    const rewarder = tribalChiefContract.rewarder(tribalChief.poolCount)
    // struct PoolInfo {
    //     IERC20 lpToken; // Address of LP token contract.
    //     uint256 allocPoint; // How many allocation points assigned to this pool. SUSHIs to distribute per block.
    //     uint256 lastRewardBlock; // Last block number that SUSHIs distribution occurs.
    //     uint256 accTribePerShare; // Accumulated SUSHIs per share, times 1e12. See below.
    // }
    // struct PoolInfo {
    //     uint256 virtualTotalSupply;
    //     uint256 accTribePerShare;
    //     uint128 lastRewardBlock;
    //     uint120 allocPoint;
    //     bool unlocked;
    // }
    pool.stakedToken = stakedToken
    pool.rewarder = rewarder
    pool.virtualTotalSupply = poolInfo.value0
    pool.accTribePerShare = poolInfo.value1
    pool.lastRewardBlock = poolInfo.value2
    pool.allocPoint = poolInfo.value3
    pool.unlocked = poolInfo.value4

    // Total supply of LP tokens
    pool.balance = BIG_INT_ZERO
    pool.userCount = BIG_INT_ZERO

    pool.tokenBalance = BIG_DECIMAL_ZERO
    pool.tokenAge = BIG_DECIMAL_ZERO
    pool.tokenAgeRemoved = BIG_DECIMAL_ZERO
    pool.tokenDeposited = BIG_DECIMAL_ZERO
    pool.tokenWithdrawn = BIG_DECIMAL_ZERO

    pool.timestamp = block.timestamp
    pool.block = block.number

    pool.updatedAt = block.timestamp
    pool.entryUSD = BIG_DECIMAL_ZERO
    pool.exitUSD = BIG_DECIMAL_ZERO
    pool.tribeHarvested = BIG_DECIMAL_ZERO
    pool.tribeHarvestedUSD = BIG_DECIMAL_ZERO
    pool.save()
  }

  return pool as Pool
}

function getPoolHistory(pool: Pool, block: ethereum.Block): PoolHistory {
  const day = block.timestamp.div(BIG_INT_ONE_DAY_SECONDS)

  const id = pool.id.concat(day.toString())

  let history = PoolHistory.load(id)

  if (history === null) {
    history = new PoolHistory(id)
    history.pool = pool.id
    history.tokenBalance = BIG_DECIMAL_ZERO
    history.tokenAge = BIG_DECIMAL_ZERO
    history.tokenAgeRemoved = BIG_DECIMAL_ZERO
    history.tokenDeposited = BIG_DECIMAL_ZERO
    history.tokenWithdrawn = BIG_DECIMAL_ZERO
    history.timestamp = block.timestamp
    history.block = block.number
    history.entryUSD = BIG_DECIMAL_ZERO
    history.exitUSD = BIG_DECIMAL_ZERO
    history.tribeHarvested = BIG_DECIMAL_ZERO
    history.tribeHarvestedUSD = BIG_DECIMAL_ZERO
  }

  return history as PoolHistory
}

export function getUser(pid: BigInt, address: Address, block: ethereum.Block): User {
  const uid = address.toHex()
  const id = pid.toString().concat('-').concat(uid)

  let user = User.load(id)

  if (user === null) {
    user = new User(id)
    user.pool = null
    user.address = address
    user.amount = BIG_INT_ZERO
    user.rewardDebt = BIG_INT_ZERO
    user.virtualAmount = BIG_INT_ZERO
    user.tribeHarvested = BIG_DECIMAL_ZERO
    user.tribeHarvestedUSD = BIG_DECIMAL_ZERO
    user.entryUSD = BIG_DECIMAL_ZERO
    user.exitUSD = BIG_DECIMAL_ZERO
    user.timestamp = block.timestamp
    user.block = block.number
    user.save()
  }

  return user as User
}

function getHistory(owner: string, block: ethereum.Block): History {
  const day = block.timestamp.div(BIG_INT_ONE_DAY_SECONDS)

  const id = owner.concat(day.toString())

  let history = History.load(id)

  if (history === null) {
    history = new History(id)
    history.owner = owner
    history.tokenBalance = BIG_DECIMAL_ZERO
    history.tokenAge = BIG_DECIMAL_ZERO
    history.tokenAgeRemoved = BIG_DECIMAL_ZERO
    history.tokenDeposited = BIG_DECIMAL_ZERO
    history.tokenWithdrawn = BIG_DECIMAL_ZERO
    history.timestamp = block.timestamp
    history.block = block.number
  }

  return history as History
}

// event Deposit(
//         address indexed user,
//         uint256 indexed pid,
//         uint256 amount,
//         uint256 indexed depositID
//     );
export function handleDeposit(event: Deposit): void {
  // if (event.params.amount == BIG_INT_ZERO) {
  //   log.info('Deposit zero transaction, input {} hash {}', [
  //     event.transaction.input.toHex(),
  //     event.transaction.hash.toHex(),
  //   ])
  // }

  const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

  /*log.info('{} has deposited {} token tokens to pool #{}', [
    event.params.user.toHex(),
    event.params.amount.toString(),
    event.params.pid.toString(),
  ])*/

  const tribalChiefContract = TribalChiefContract.bind(TRIBAL_CHIEF_ADDRESS)

  const poolInfo = tribalChiefContract.poolInfo(event.params.pid)
  const stakedToken = tribalChiefContract.stakedToken(event.params.pid)

  const pool = getPool(event.params.pid, event.block)

  const poolHistory = getPoolHistory(pool, event.block)

  const stakedTokenContract = ERC20Contract.bind(stakedToken)
  pool.balance = stakedTokenContract.balanceOf(TRIBAL_CHIEF_ADDRESS)

  pool.lastRewardBlock = poolInfo.value2
  pool.accTribePerShare = poolInfo.value3

  const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  pool.tokenAge = pool.tokenAge.plus(poolDays.times(pool.tokenBalance))

  pool.tokenDeposited = pool.tokenDeposited.plus(amount)
  pool.tokenBalance = pool.tokenBalance.plus(amount)

  pool.updatedAt = event.block.timestamp

  const userInfo = tribalChiefContract.userInfo(event.params.pid, event.params.user)

  const user = getUser(event.params.pid, event.params.user, event.block)

  // If not currently in pool and depositing token
  if (!user.pool && event.params.amount.gt(BIG_INT_ZERO)) {
    user.pool = pool.id
    pool.userCount = pool.userCount.plus(BIG_INT_ONE)
  }

  // Calculate Tribe being paid out
  if (event.block.number.gt(TRIBAL_CHIEF_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
    const pending = user.amount
      .toBigDecimal()
      .times(pool.accTribePerShare.toBigDecimal())
      .div(BIG_DECIMAL_1E12)
      .minus(user.rewardDebt.toBigDecimal())
      .div(BIG_DECIMAL_1E18)
    // log.info('Deposit: User amount is more than zero, we should harvest {} sushi', [pending.toString()])
    if (pending.gt(BIG_DECIMAL_ZERO)) {
      // log.info('Harvesting {} SUSHI', [pending.toString()])
      const tribeHarvestedUSD = pending.times(getTribePrice(event.block))
      user.tribeHarvested = user.tribeHarvested.plus(pending)
      user.tribeHarvestedUSD = user.tribeHarvestedUSD.plus(tribeHarvestedUSD)
      pool.tribeHarvested = pool.tribeHarvested.plus(pending)
      pool.tribeHarvestedUSD = pool.tribeHarvestedUSD.plus(tribeHarvestedUSD)
      poolHistory.tribeHarvested = pool.tribeHarvested
      poolHistory.tribeHarvestedUSD = pool.tribeHarvestedUSD
    }
  }

  // struct UserInfo {
  //       int256 rewardDebt;
  //       uint256 virtualAmount;
  //   }
  // user.amount = userInfo.value0  // Todo:: use depositInfo
  // user.rewardDebt = userInfo.value1
  user.rewardDebt = userInfo.value0
  user.virtualAmount = userInfo.value1

  // Todo:: update info by DepositInfo

  user.save()
  pool.save()

  // // Update tribalChief token accumulated info
  const tribalChief = getTribalChief(event.block)

  const tribalChiefDays = event.block.timestamp.minus(tribalChief.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  tribalChief.tokenAge = tribalChief.tokenAge.plus(tribalChiefDays.times(tribalChief.tokenBalance))

  tribalChief.tokenDeposited = tribalChief.tokenDeposited.plus(amount)
  tribalChief.tokenBalance = tribalChief.tokenBalance.plus(amount)

  tribalChief.updatedAt = event.block.timestamp
  tribalChief.save()

  // // Update History token accumulated info
  const history = getHistory(TRIBAL_CHIEF_ADDRESS.toHex(), event.block)
  history.tokenAge = tribalChief.tokenAge
  history.tokenBalance = tribalChief.tokenBalance
  history.tokenDeposited = history.tokenDeposited.plus(amount)
  history.save()

  // Sync pool data to pool history
  poolHistory.tokenAge = pool.tokenAge
  poolHistory.tokenBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
  poolHistory.tokenDeposited = poolHistory.tokenDeposited.plus(amount)
  poolHistory.userCount = pool.userCount
  poolHistory.save()
}

// event Withdraw(
//         address indexed user,
//         uint256 indexed pid,
//         uint256 amount,
//         address indexed to
//     );
export function withdraw(event: Withdraw): void {
  // if (event.params.amount == BIG_INT_ZERO && User.load(event.params.user.toHex()) !== null) {
  //   log.info('Withdrawal zero transaction, input {} hash {}', [
  //     event.transaction.input.toHex(),
  //     event.transaction.hash.toHex(),
  //   ])
  // }

  const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

  // log.info('{} has withdrawn {} token tokens from pool #{}', [
  //   event.params.user.toHex(),
  //   amount.toString(),
  //   event.params.pid.toString(),
  // ])

  // if (event.block.number == BigInt.fromI32(14098817) && event.params.pid == BigInt.fromI32(344)) {
  //   return
  // }

  const tribalChiefContract = TribalChiefContract.bind(TRIBAL_CHIEF_ADDRESS)

  // struct PoolInfo {
  //       uint256 virtualTotalSupply;
  //       uint256 accTribePerShare;
  //       uint128 lastRewardBlock;
  //       uint120 allocPoint;
  //       bool unlocked;
  //   }
  const poolInfo = tribalChiefContract.poolInfo(event.params.pid)

  const stakedToken = tribalChiefContract.stakedToken(event.params.pid)

  const pool = getPool(event.params.pid, event.block)

  const poolHistory = getPoolHistory(pool, event.block)

  const stakedTokenContract = ERC20Contract.bind(stakedToken)
  pool.balance = stakedTokenContract.balanceOf(TRIBAL_CHIEF_ADDRESS)
  pool.accTribePerShare = poolInfo.value1
  pool.lastRewardBlock = poolInfo.value2

  const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  const poolAge = pool.tokenAge.plus(poolDays.times(pool.tokenBalance))
  const poolAgeRemoved = poolAge.div(pool.tokenBalance).times(amount)
  pool.tokenAge = poolAge.minus(poolAgeRemoved)
  pool.tokenAgeRemoved = pool.tokenAgeRemoved.plus(poolAgeRemoved)
  pool.tokenWithdrawn = pool.tokenWithdrawn.plus(amount)
  pool.tokenBalance = pool.tokenBalance.minus(amount)
  pool.updatedAt = event.block.timestamp

  const user = getUser(event.params.pid, event.params.user, event.block)

  if (event.block.number.gt(TRIBAL_CHIEF_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
    const pending = user.amount
      .toBigDecimal()
      .times(pool.accTribePerShare.toBigDecimal())
      .div(BIG_DECIMAL_1E12)
      .minus(user.rewardDebt.toBigDecimal())
      .div(BIG_DECIMAL_1E18)
    // log.info('Withdraw: User amount is more than zero, we should harvest {} sushi - block: {}', [
    //   pending.toString(),
    //   event.block.number.toString(),
    // ])
    // log.info('SUSHI PRICE {}', [getSushiPrice(event.block).toString()])
    if (pending.gt(BIG_DECIMAL_ZERO)) {
      // log.info('Harvesting {} SUSHI (CURRENT SUSHI PRICE {})', [
      //   pending.toString(),
      //   getSushiPrice(event.block).toString(),
      // ])
      const tribeHarvestedUSD = pending.times(getTribePrice(event.block))
      user.tribeHarvested = user.tribeHarvested.plus(pending)
      user.tribeHarvestedUSD = user.tribeHarvestedUSD.plus(tribeHarvestedUSD)
      pool.tribeHarvested = pool.tribeHarvested.plus(pending)
      pool.tribeHarvestedUSD = pool.tribeHarvestedUSD.plus(tribeHarvestedUSD)
      poolHistory.tribeHarvested = pool.tribeHarvested
      poolHistory.tribeHarvestedUSD = pool.tribeHarvestedUSD
    }
  }

  const userInfo = tribalChiefContract.userInfo(event.params.pid, event.params.user)

  user.amount = userInfo.value0
  user.rewardDebt = userInfo.value1

  // get pool and pool history's exit USD
  // if (event.params.amount.gt(BIG_INT_ZERO)) {
  //   const reservesResult = pairContract.try_getReserves()

  //   if (!reservesResult.reverted) {
  //     const totalSupply = pairContract.totalSupply()

  //     const share = amount.div(totalSupply.toBigDecimal())

  //     const token0Amount = reservesResult.value.value0.toBigDecimal().times(share)

  //     const token1Amount = reservesResult.value.value1.toBigDecimal().times(share)

  //     const token0PriceUSD = getUSDRate(pairContract.token0(), event.block)

  //     const token1PriceUSD = getUSDRate(pairContract.token1(), event.block)

  //     const token0USD = token0Amount.times(token0PriceUSD)

  //     const token1USD = token1Amount.times(token1PriceUSD)

  //     const exitUSD = token0USD.plus(token1USD)

  //     pool.exitUSD = pool.exitUSD.plus(exitUSD)

  //     poolHistory.exitUSD = pool.exitUSD

  //     // log.info('User {} has withdrwn {} token tokens {} {} (${}) and {} {} (${}) at a combined value of ${}', [
  //     //   user.address.toHex(),
  //     //   amount.toString(),
  //     //   token0Amount.toString(),
  //     //   token0USD.toString(),
  //     //   pairContract.token0().toHex(),
  //     //   token1Amount.toString(),
  //     //   token1USD.toString(),
  //     //   pairContract.token1().toHex(),
  //     //   exitUSD.toString(),
  //     // ])

  //     user.exitUSD = user.exitUSD.plus(exitUSD)
  //   } else {
  //     log.info("Withdraw couldn't get reserves for pair {}", [poolInfo.value0.toHex()])
  //   }
  // }

  // If token amount equals zero, remove from pool and reduce userCount
  if (user.amount.equals(BIG_INT_ZERO)) {
    user.pool = null
    pool.userCount = pool.userCount.minus(BIG_INT_ONE)
  }

  user.save()
  pool.save()

  // Update global info
  const tribalChief = getTribalChief(event.block)

  const days = event.block.timestamp.minus(tribalChief.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  const tokenAge = tribalChief.tokenAge.plus(days.times(tribalChief.tokenBalance))
  const tokenAgeRemoved = tokenAge.div(tribalChief.tokenBalance).times(amount)
  tribalChief.tokenAge = tokenAge.minus(tokenAgeRemoved)
  tribalChief.tokenAgeRemoved = tribalChief.tokenAgeRemoved.plus(tokenAgeRemoved)

  tribalChief.tokenWithdrawn = tribalChief.tokenWithdrawn.plus(amount)
  tribalChief.tokenBalance = tribalChief.tokenBalance.minus(amount)
  tribalChief.updatedAt = event.block.timestamp
  tribalChief.save()

  const history = getHistory(TRIBAL_CHIEF_ADDRESS.toHex(), event.block)
  history.tokenAge = tribalChief.tokenAge
  history.tokenAgeRemoved = history.tokenAgeRemoved.plus(tokenAgeRemoved)
  history.tokenBalance = tribalChief.tokenBalance
  history.tokenWithdrawn = history.tokenWithdrawn.plus(amount)
  history.save()

  poolHistory.tokenAge = pool.tokenAge
  poolHistory.tokenAgeRemoved = poolHistory.tokenAgeRemoved.plus(tokenAgeRemoved)
  poolHistory.tokenBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
  poolHistory.tokenWithdrawn = poolHistory.tokenWithdrawn.plus(amount)
  poolHistory.userCount = pool.userCount
  poolHistory.save()
}

//  event LogSetPool(
//         uint256 indexed pid,
//         uint256 allocPoint,
//         IRewarder indexed rewarder,
//         bool overwrite
//     );
export function handlePoolSet(event: LogSetPool): void {
  log.info('Set pool id: {} allocPoint: {} withUpdate: {}', [
    event.params.pid.toString(),
    event.params.allocPoint.toString(),
    event.params.rewarder.toString(),
    event.params.overwrite ? 'true' : 'false'
  ])

  const pool = getPool(event.params.pid, event.block)

  const tribalChief = getTribalChief(event.block)

  // // Update tribalchief
  tribalChief.totalAllocPoint = tribalChief.totalAllocPoint.plus(event.params.allocPoint.minus(pool.allocPoint))
  tribalChief.save()

  // // Update pool
  pool.allocPoint = event.params.allocPoint
  pool.save()
}

// event EmergencyWithdraw(
//         address indexed user,
//         uint256 indexed pid,
//         uint256 amount,
//         address indexed to
//     );
export function handleEmergencyWithdraw(event: EmergencyWithdraw): void {
  log.info('User {} emergancy withdrawal of {} from pool #{} to address {}', [
    event.params.user.toHex(),
    event.params.amount.toString(),
    event.params.pid.toString(),
    event.params.to.toString(),
  ])

  const pool = getPool(event.params.pid, event.block)

  const stakedTokenContract = ERC20Contract.bind(pool.stakedToken as Address)
  // Todo:: handle virtualTotalSupply
  // pool.virtualTotalSupply = pool.virtualTotalSupply.minus()
  pool.balance = stakedTokenContract.balanceOf(TRIBAL_CHIEF_ADDRESS)
  pool.save()

  // Update user
  const user = getUser(event.params.pid, event.params.user, event.block)
  user.amount = BIG_INT_ZERO
  user.rewardDebt = BIG_INT_ZERO

  user.save()
}

// event NewTribePerBlock(uint256 indexed amount);
export function handleNewTribePerBlock(event: NewTribePerBlock): void {
  log.info('Set NewTribePerBlock: {}', [
    event.params.amount.toString(),
  ])
  const tribalChief = getTribalChief(event.block)

  tribalChief.tribePerBlock = event.params.amount

  tribalChief.save()
}

import {
  ADDRESS_ZERO,
  BIG_DECIMAL_1E18,
  BIG_DECIMAL_1E6,
  BIG_DECIMAL_ONE,
  BIG_DECIMAL_ZERO,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_FEI_TRIBE_PAIR_FIRST_LIQUDITY_BLOCK,
  UNISWAP_FEI_TRIBE_PAIR_ADDRESS,
  FEI_ADDRESS,
  TRIBE_ADDRESS,
} from './helper'
import { Address, BigDecimal, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import { UniswapFactory as FactoryContract } from '../types/TribalChief/UniswapFactory'
import { UniswapPair as PairContract } from '../types/TribalChief/UniswapPair'

export function getFeiRate(token: Address, block: ethereum.Block): BigDecimal {
  let fei = BIG_DECIMAL_ONE

  if (token != FEI_ADDRESS) {
    const factory = FactoryContract.bind(
      UNISWAP_FACTORY_ADDRESS
    )

    const address = factory.getPair(token, FEI_ADDRESS)

    if (address == ADDRESS_ZERO) {
      log.info('Adress ZERO...', [])
      return BIG_DECIMAL_ZERO
    }

    const pair = PairContract.bind(address)

    const reserves = pair.getReserves()

    fei =
      pair.token0() == FEI_ADDRESS
        ? reserves.value0.toBigDecimal().times(BIG_DECIMAL_1E18).div(reserves.value1.toBigDecimal())
        : reserves.value1.toBigDecimal().times(BIG_DECIMAL_1E18).div(reserves.value0.toBigDecimal())

    return fei.div(BIG_DECIMAL_1E18)
  }

  return fei
}

export function getTribePrice(block: ethereum.Block): BigDecimal {
  if (block.number.lt(UNISWAP_FEI_TRIBE_PAIR_FIRST_LIQUDITY_BLOCK)) {
    // If before uniswap fei-tribe pair creation and liquidity added, return zero
    return BIG_DECIMAL_ZERO
  } else {
    // else get price from eth fei-tribe pair 
    return getFeiRate(TRIBE_ADDRESS, block)
  }
}

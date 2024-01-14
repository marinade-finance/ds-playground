import { Parser } from "expr-eval"
import { AggregatedValidators, selectExternalStakeMin } from "./aggregate"
import { EligibilityConfig, ValidatorsEligibilities } from "./eligibility"
import { Scores } from "./scoring"

const buildStakingVariables = (stakesConfig: StakesConfig) => ({
    tvl: stakesConfig.tvl
})

export type StakesConfig = {
    tvl: number
    stakeBlocksFromBonus: number
    formulaStakeBlockSize: string
    formulaStakeBlocksFromScore: string
    maxStakeShare: number
    epochs: number
}

export type Stake = {
    total: number
    hypotheticalTotal: number
}

export type Stakes = Record<string, Stake>
export const calcValidatorsStakes = (aggregatedValidators: AggregatedValidators, scores: Scores, validatorsEligibility: ValidatorsEligibilities, stakesConfig: StakesConfig, eligibilityConfig: EligibilityConfig): Stakes => {
    try {
        const result = {}
        const stakingVariables = buildStakingVariables(stakesConfig)
        const blockSize = Parser.evaluate(stakesConfig.formulaStakeBlockSize, stakingVariables)
        const eligibleValidators = Object.keys(aggregatedValidators).filter((v) => validatorsEligibility[v]?.basicEligibility)
        let distributedStake = 0

        eligibleValidators.sort((a, b) => scores[b].score - scores[a].score)

        for (const voteAccount of eligibleValidators) {
            let blocks = 0

            if (validatorsEligibility[voteAccount].bonusEligibility) {
                blocks += stakesConfig.stakeBlocksFromBonus
            }

            blocks += Parser.evaluate(stakesConfig.formulaStakeBlocksFromScore, { ...stakingVariables, score: scores[voteAccount].score })

            const minExternalStake = selectExternalStakeMin(aggregatedValidators[voteAccount], stakesConfig.epochs)
            let stake = Math.min(blockSize * blocks, minExternalStake * (stakesConfig.maxStakeShare / (1 - stakesConfig.maxStakeShare)))

            distributedStake += stake
            result[voteAccount] = {
                total: distributedStake < stakesConfig.tvl ? stake : 0,
                hypotheticalTotal: stake,
            }
        }

        return result
    } catch (err) {
        console.log('err', err)
        return {}
    }
}
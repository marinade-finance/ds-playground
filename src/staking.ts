import { Parser } from "expr-eval"
import { AggregatedValidators, selectExternalStakeMin } from "./aggregate"
import { EligibilityConfig, ValidatorsEligibilities } from "./eligibility"
import { Scores } from "./scoring"
import { DSVote, Votes } from "./validator-data"
import { sum } from "./math"

export type StakesConfig = {
    tvl: number
    mSolControl: number
    veMndeControl: number
    stakeBlocksFromBonus: number
    formulaStakeBlockSize: string
    formulaStakeBlocksFromScore: string
}

export type Stake = {
    algoStake: number
    mSolStake: number
    veMndeStake: number
    totalStake: number
    algoStakeFromOverflow: number
    mSolStakeFromOverflow: number
    veMndeStakeFromOverflow: number
    totalStakeFromOverlfow: number
}

const removeFromVotes = (votes: Votes, to_remove: string): Votes => {
    const votesCopy = { ...votes }
    delete votesCopy[to_remove]
    return votesCopy
}

export type Stakes = Record<string, Stake>
export const calcValidatorsStakes = (aggregatedValidators: AggregatedValidators, scores: Scores, eligibilities: ValidatorsEligibilities, stakesConfig: StakesConfig, mSolVotes: Votes, veMndeVotes: Votes): Stakes => {
    let updatedMSolVotes = { ...mSolVotes }
    let updatedVeMndeVotes = { ...veMndeVotes }

    const veMndeVotesForDS = veMndeVotes[DSVote] ?? 0
    const totalVeMndeVotes = sum(Object.values(veMndeVotes))
    updatedVeMndeVotes = removeFromVotes(updatedVeMndeVotes, DSVote)
    const veMndeTvl = Math.round(totalVeMndeVotes > 0 ? (1 - veMndeVotesForDS / totalVeMndeVotes) * stakesConfig.veMndeControl * stakesConfig.tvl : 0)
    const mSolVotesForDS = mSolVotes[DSVote] ?? 0
    const totalMSolVotes = sum(Object.values(mSolVotes))
    updatedMSolVotes = removeFromVotes(updatedMSolVotes, DSVote)
    const mSolTvl = Math.round(totalMSolVotes > 0 ? (1 - mSolVotesForDS / totalMSolVotes) * stakesConfig.mSolControl * stakesConfig.tvl : 0)

    const algoTvl = stakesConfig.tvl - mSolTvl - veMndeTvl

    console.log({
        veMndeVotesForDS,
        totalVeMndeVotes,
        veMndeTvl,
        mSolVotesForDS,
        totalMSolVotes,
        mSolTvl,
        algoTvl,
    })

    try {
        const result: Stakes = {}
        const stakingVariables = { tvl: algoTvl }
        const blockSize = Parser.evaluate(stakesConfig.formulaStakeBlockSize, stakingVariables)
        const eligibleValidators = Object.keys(aggregatedValidators).filter((v) => eligibilities[v]?.basicEligibility)
        
        Object.keys(aggregatedValidators).filter((v) => !eligibilities[v]?.basicEligibility).forEach((voteAccount) => {
            updatedVeMndeVotes = removeFromVotes(updatedVeMndeVotes, voteAccount)
            updatedMSolVotes = removeFromVotes(updatedMSolVotes, voteAccount)
        })
        let updatedTotalVeMndeVotes = sum(Object.values(updatedVeMndeVotes))
        let updatedTotalMSolVotes = sum(Object.values(updatedMSolVotes))

        for (const voteAccount of eligibleValidators) {
            result[voteAccount] = {
                algoStake: 0,
                mSolStake: 0,
                veMndeStake: 0,
                totalStake: 0,
                algoStakeFromOverflow: 0,
                mSolStakeFromOverflow: 0,
                veMndeStakeFromOverflow: 0,
                totalStakeFromOverlfow: 0,
            }
        }

        let algoStakeDistributed = 0
        let mSolStakeDistributed = 0
        let veMndeStakeDistributed = 0

        eligibleValidators.sort((a, b) => scores[b].score - scores[a].score)

        let round = 1
        while (round <= 100 && (mSolTvl - mSolStakeDistributed > 1 || veMndeTvl - veMndeStakeDistributed > 1)) {
            let someStakeIncreased = false
            const mSolStakeDistributedBeforeRound = mSolStakeDistributed
            const veMndeStakeDistributedBeforeRound = veMndeStakeDistributed
            for (const voteAccount of eligibleValidators) {
                let blocks = 0

                if (round === 1) {
                    if (eligibilities[voteAccount].bonusEligibility) {
                        blocks += stakesConfig.stakeBlocksFromBonus
                    }
    
                    blocks += Parser.evaluate(stakesConfig.formulaStakeBlocksFromScore, { ...stakingVariables, score: scores[voteAccount].score })
                }

                let algoStake = Math.round(Math.min(blockSize * blocks, Math.max(algoTvl - algoStakeDistributed, 0)))
                let mSolStake = updatedTotalMSolVotes > 0 ? Math.round((updatedMSolVotes[voteAccount] ?? 0) / updatedTotalMSolVotes * Math.max(mSolTvl - mSolStakeDistributedBeforeRound, 0)) : 0
                let veMndeStake = updatedTotalVeMndeVotes > 0 ? Math.round((updatedVeMndeVotes[voteAccount] ?? 0) / updatedTotalVeMndeVotes * Math.max(veMndeTvl - veMndeStakeDistributedBeforeRound, 0)) : 0
                let stake = algoStake + veMndeStake + mSolStake

                if (!stake) {
                    continue
                }

                const cappedStake = Math.min(eligibilities[voteAccount].capFromBond - result[voteAccount].totalStake, eligibilities[voteAccount].capFromExternalStake - result[voteAccount].totalStake, stake)
                const stakeOverflow = stake - cappedStake
                const algoStakeOverflow = Math.round(algoStake / stake * stakeOverflow)
                const mSolStakeOverflow = Math.round(mSolStake / stake * stakeOverflow)
                const veMndeStakeOverflow = Math.round(veMndeStake / stake * stakeOverflow)
                const cappedAlgoStake = algoStake - algoStakeOverflow
                const cappedMSolStake = mSolStake - mSolStakeOverflow
                const cappedVeMndeStake = veMndeStake - veMndeStakeOverflow

                if (cappedAlgoStake + cappedMSolStake + cappedVeMndeStake > 0) {
                    someStakeIncreased = true
                }

                algoStakeDistributed += cappedAlgoStake
                mSolStakeDistributed += cappedMSolStake
                veMndeStakeDistributed += cappedVeMndeStake

                result[voteAccount].algoStake += cappedAlgoStake
                result[voteAccount].mSolStake += cappedMSolStake
                result[voteAccount].veMndeStake += cappedVeMndeStake
                result[voteAccount].totalStake += cappedAlgoStake + cappedMSolStake + cappedVeMndeStake
                if (round > 1) {
                    result[voteAccount].algoStakeFromOverflow += cappedAlgoStake
                    result[voteAccount].mSolStakeFromOverflow += cappedMSolStake
                    result[voteAccount].veMndeStakeFromOverflow += cappedVeMndeStake
                    result[voteAccount].totalStakeFromOverlfow += cappedAlgoStake + cappedMSolStake + cappedVeMndeStake
                }
            }

            console.log("Staking round:", round)
            console.log('Distributed algo:', algoStakeDistributed, 'Total algo:', algoTvl, 'Remaining:', algoTvl - algoStakeDistributed)
            console.log('Distributed mSol:', mSolStakeDistributed, 'Total mSol:', mSolTvl, 'Remaining:', mSolTvl - mSolStakeDistributed)
            console.log('Distributed veMNDE:', veMndeStakeDistributed, 'Total veMNDE:', veMndeTvl, 'Remaining:', veMndeTvl - veMndeStakeDistributed)

            round++

            if (!someStakeIncreased) {
                console.log('No more stake increase performed')
                break
            }

            for (const voteAccount of eligibleValidators) {
                if (Math.round(result[voteAccount].totalStake) === Math.round(eligibilities[voteAccount].capFromExternalStake)) {
                    updatedVeMndeVotes = removeFromVotes(updatedVeMndeVotes, voteAccount)
                    updatedMSolVotes = removeFromVotes(updatedMSolVotes, voteAccount)
                }
            }
            updatedTotalVeMndeVotes = sum(Object.values(updatedVeMndeVotes))
            updatedTotalMSolVotes = sum(Object.values(updatedMSolVotes))
        }

        const remainingAlgoTvl = Math.max(algoTvl - algoStakeDistributed, 0)
        const remainingMSolTvl = Math.max(mSolTvl - mSolStakeDistributed, 0)
        const remainingVeMndeTvl = Math.max(veMndeTvl - veMndeStakeDistributed, 0)
        for (const voteAccount of eligibleValidators) {
            if (algoStakeDistributed) {
                const extraStake = Math.round(result[voteAccount].algoStake / algoStakeDistributed * remainingAlgoTvl)
                result[voteAccount].totalStake += extraStake
                result[voteAccount].algoStake += extraStake
                result[voteAccount].algoStakeFromOverflow += extraStake
            }
            if (mSolStakeDistributed) {
                const extraStake = Math.round(result[voteAccount].algoStake / mSolStakeDistributed * remainingMSolTvl)
                result[voteAccount].totalStake += extraStake
                result[voteAccount].mSolStake += extraStake
                result[voteAccount].mSolStakeFromOverflow += extraStake
            }
            if (veMndeStakeDistributed) {
                const extraStake = Math.round(result[voteAccount].algoStake / veMndeStakeDistributed * remainingVeMndeTvl)
                result[voteAccount].totalStake += extraStake
                result[voteAccount].veMndeStake += extraStake
                result[voteAccount].veMndeStakeFromOverflow += extraStake
            }

        }

        return result
    } catch (err) {
        console.log('err', err)
        return {}
    }
}
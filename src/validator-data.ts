import { sum } from "./math"

const VALIDATORS_API = 'https://validators-api.marinade.finance/validators'
const REWARDS_API = 'https://validators-api.marinade.finance/rewards'
const VALIDATORS_MEV_API = 'https://kobe.mainnet.jito.network/api/v1/validators'
const BLACKLIST_URL = 'https://raw.githubusercontent.com/marinade-finance/delegation-strategy-2/master/blacklist.csv'
const VEMNDE_SNAPSHOT_API = 'https://snapshots-api.marinade.finance/v1/votes/vemnde/latest'
const MSOL_SNAPSHOT_API = 'https://snapshots-api.marinade.finance/v1/votes/msol/latest'

export const getMaxEpoch = (validators: any) => {
    let maxEpoch = 0
    for (const validator of validators) {
        for (const { epoch } of validator.epoch_stats) {
            maxEpoch = Math.max(epoch, maxEpoch)
        }
    }
    return maxEpoch
}

const fetchValidators = async (epochsToFetch: number): Promise<any> => {
    const result = await fetch(`${VALIDATORS_API}?limit=9999&epochs=${epochsToFetch + 1}`, {
        // headers: { 'Content-Encoding': 'gzip', 'Access-Control-Allow-Origin': '*' },
        // mode: 'cors',
    })
    const { validators } = await result.json()
    for (const validator of validators) {
        validator.epochStats = {}
        for (const epochStat of validator.epoch_stats) {
            validator.epochStats[epochStat.epoch] = epochStat
        }
    }
    return validators
}

export type MEVRecord = { vote_account: string, mev_commission_bps: number, running_jito: boolean }
const fetchValidatorsMEVConfig = async (): Promise<Record<string, MEVRecord>> => {
    const response = await fetch(VALIDATORS_MEV_API)
    const mevRecords = await response.json()
    const result = {}
    for (const mevRecord of mevRecords.validators) {
        result[mevRecord.vote_account] = mevRecord
    }

    return result
}

const fetchBlacklist = async (): Promise<Set<string>> => {
    const result = await fetch(BLACKLIST_URL)
    const csv = await result.text()
    return new Set(csv.split('\n').map((line) => line.split(',')[0]))
}

export const DSVote = 'TBD'
export type Votes = Record<string, number>
const fetchVeMndeVotes = async (): Promise<Votes> => {
    const response = await fetch(VEMNDE_SNAPSHOT_API)
    const { records } = await response.json()
    const result = {}
    for (const { amount, validatorVoteAccount } of records) {
        const parsedAmount = Number(amount)
        if (parsedAmount > 0) {
            result[validatorVoteAccount] = (result[validatorVoteAccount] ?? 0) + parsedAmount
        }
    }
    return result
}
const fetchMSolVotes = async (): Promise<Votes> => {
    const response = await fetch(MSOL_SNAPSHOT_API)
    const { records } = await response.json()
    const result = {}
    for (const { amount, validatorVoteAccount } of records) {
        const parsedAmount = Number(amount)
        if (parsedAmount > 0) {
            result[validatorVoteAccount] = (result[validatorVoteAccount] ?? 0) + parsedAmount
        }
    }
    return result
}

const REWARDS_PAST_EPOCHS = 14
export type Rewards = { inflation: number, mev: number }
export const fetchRewards = async (): Promise<Rewards> => {
    const response = await fetch(`${REWARDS_API}?epochs=${REWARDS_PAST_EPOCHS}`)
    const { rewards_inflation_est, rewards_mev } = await response.json()
    const inflation = sum(rewards_inflation_est.map(([_, amount]) => amount))
    const mev = sum(rewards_mev.map(([_, amount]) => amount))
    return { inflation, mev }
}

export const getValidatorsRawData = async (epochs: number) => ({
    validators: await fetchValidators(epochs),
    mevConfig: await fetchValidatorsMEVConfig(),
    blacklist: await fetchBlacklist(),
    veMndeVotes: await fetchVeMndeVotes(),
    mSolVotes: await fetchMSolVotes(),
})

export type ValidatorsRawData = Awaited<ReturnType<typeof getValidatorsRawData>>
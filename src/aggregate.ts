import { ClusterInfo } from "./cluster-info";
import { mean, sum } from "./math";
import { zip } from "./utils";
import { MEVRecord, getValidatorsRawData } from "./validator-data";

export type AggregatedValidator = {
    voteAccount: string
    name: string
    epochs: (number)[]
    currentStake: number
    commission: (number)[]
    stake: (number)[]
    externalStake: (number)[]
    credits: (number)[]
    blocksProduced: (number)[]
    leaderSlots: (number)[]
    dataAvailable: boolean[]
    mevCommission: number
    country: string
    city: string
    aso: string
    blacklisted: boolean
}

const aggregateValidator = (validator: any, mevRecord: MEVRecord, blacklist: Set<string>, firstEpoch: number, lastEpoch: number): AggregatedValidator => {
    const voteAccount = validator.vote_account
    const name = validator.info_name
    const commission = []
    const epochs = []
    const stake = []
    const externalStake = []
    const credits = []
    const dataAvailable = []
    const blocksProduced = []
    const leaderSlots = []
    const currentStake = Number(validator[lastEpoch]?.activated_stake ?? 0) / 1e9
    const blacklisted = blacklist.has(voteAccount)

    for (let epoch = lastEpoch; epoch >= firstEpoch; epoch--) {
        const epochStat = validator.epochStats[epoch]
        epochs.push(epoch)
        credits.push(epochStat?.credits ?? 0)
        commission.push(epochStat?.commission_max_observed ?? epochStat?.commission_advertised ?? 0)
        stake.push(epochStat ? Number(epochStat.activated_stake / 1e9) : 0)
        externalStake.push(epochStat ? Number(epochStat.activated_stake / 1e9) - Number(epochStat.marinade_stake / 1e9) - Number(epochStat.marinade_native_stake / 1e9) : null)
        leaderSlots.push(epochStat?.leader_slots ?? 0)
        blocksProduced.push(epochStat?.blocks_produced ?? 0)
        dataAvailable.push(Boolean(epochStat))
    }

    return {
        voteAccount,
        name,
        epochs,
        commission,
        currentStake,
        stake,
        externalStake,
        credits,
        blocksProduced,
        leaderSlots,
        dataAvailable,
        mevCommission: mevRecord?.running_jito ? mevRecord.mev_commission_bps / 100 : 100,
        country: validator.dc_country ?? "???",
        city: validator.dc_full_city ?? "???",
        aso: validator.dc_aso ?? "???",
        blacklisted,
    }

}

export type AggregatedValidators = Record<string, AggregatedValidator>

export const aggregateValidatorsData = ({ validators, mevConfig, blacklist }: Awaited<ReturnType<typeof getValidatorsRawData>>, firstEpoch: number, lastEpoch: number): AggregatedValidators => {
    const result = {}
    for (const validator of validators) {
        result[validator.vote_account] = aggregateValidator(validator, mevConfig[validator.vote_account], blacklist, firstEpoch, lastEpoch)
    }
    return result
}

export const selectCreditsPctMean = (validator: AggregatedValidator, clusterInfo: ClusterInfo, fullEpochs: number) => mean(validator.epochs.slice(1, fullEpochs + 1).map((epoch, fullEpochIndex) => validator.credits[fullEpochIndex + 1] / clusterInfo.targetCreditsByEpoch.get(epoch)))
export const selectBlockProductionMean = (validator: AggregatedValidator, fullEpochs: number) => sum(validator.leaderSlots.slice(1, fullEpochs + 1)) === 0 ? 1 : sum(validator.blocksProduced.slice(1, fullEpochs + 1)) / sum(validator.leaderSlots.slice(1, fullEpochs + 1))
export const selectExternalStakeMin = (validator: AggregatedValidator, fullEpochs: number) => Math.min(...validator.externalStake.slice(0, fullEpochs + 1))
export const selectCommissonInflationMax = (validator: AggregatedValidator, epochs: number) => Math.max(...validator.commission.slice(0, epochs + 1))
export const selectCommissonMEV = (validator: AggregatedValidator) => validator.mevCommission
export const selectCountryStakeConcentration = (validator: AggregatedValidator, clusterInfo: ClusterInfo) => clusterInfo.country.get(validator.country ?? '???') ?? 0
export const selectCityStakeConcentration = (validator: AggregatedValidator, clusterInfo: ClusterInfo) => clusterInfo.city.get(validator.city ?? '???') ?? 0
export const selectASOStakeConcentration = (validator: AggregatedValidator, clusterInfo: ClusterInfo) => clusterInfo.aso.get(validator.aso ?? '???') ?? 0
export const selectNodeStake = (validator: AggregatedValidator) => validator.stake[0]
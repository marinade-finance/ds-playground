import { mean, stdDev } from "./math"
import { ValidatorsRawData } from "./validator-data"

export type ClusterInfo = {
    city: Map<string, number>,
    country: Map<string, number>,
    aso: Map<string, number>,
    targetCreditsByEpoch: Map<number, number>,
    meanBlockProductionOverBasicEligibilityPeriod: number,
    stdDevBlockProductionOverBasicEligibilityPeriod: number,
}

export const calcBlockProduction = (validators: any, from: number, to: number) => {
    const blockProductions = []

    for (const validator of validators) {
        let leaderSlots = 0
        let blocksProduced = 0

        for (let epoch = from; epoch <= to; epoch++) {
            const epochStat = validator.epochStats[epoch]
            if (epochStat) {
                leaderSlots += epochStat.leader_slots;
                blocksProduced += epochStat.blocks_produced;
            }
        }
        if (leaderSlots) {
            blockProductions.push(blocksProduced / leaderSlots)
        }
    }

    return {
        mean: mean(blockProductions),
        stdDev: stdDev(blockProductions),
    }
}

export const calcTargetCreditsByEpoch = (validators: any) => {
    const sumOfWeightedCreditsPerEpoch = new Map()
    const sumOfWeightsPerEpoch = new Map()

    for (const validator of validators) {
        for (const epochStat of validator.epoch_stats) {
            if (epochStat.epoch_end_at) {
                const prevSumOfWeightedCredits = sumOfWeightedCreditsPerEpoch.get(epochStat.epoch) ?? 0
                sumOfWeightedCreditsPerEpoch.set(epochStat.epoch, prevSumOfWeightedCredits + epochStat.credits * (epochStat.activated_stake / 1e9))

                const prevSumOfWeightsPerEpoch = sumOfWeightsPerEpoch.get(epochStat.epoch) ?? 0
                sumOfWeightsPerEpoch.set(epochStat.epoch, prevSumOfWeightsPerEpoch + epochStat.activated_stake / 1e9)
            }
        }
    }

    const result = new Map()
    for (const [epoch, sumOfWeights] of sumOfWeightsPerEpoch.entries()) {
        result.set(epoch, Math.round((sumOfWeightedCreditsPerEpoch.get(epoch) ?? 0) / sumOfWeights))
    }

    return result
}

export const calcConcentrations = (validators: any, epoch: number) => {
    let total = 0
    const city = new Map()
    const country = new Map()
    const aso = new Map()

    for (const validator of validators) {
        const lastEpochStats = validator.epoch_stats[0]
        if (lastEpochStats?.epoch === epoch) {
            const cityKey = validator.dc_full_city ?? '???'
            const countryKey = validator.dc_country ?? '???'
            const asoKey = validator.dc_aso ?? '???'

            const stake = Number(validator.activated_stake) / 1e9

            city.set(cityKey, (city.get(cityKey) ?? 0) + stake)
            country.set(countryKey, (country.get(countryKey) ?? 0) + stake)
            aso.set(asoKey, (aso.get(asoKey) ?? 0) + stake)

            total += stake
        }
    }

    for (const map of [city, country, aso]) {
        for (const key of map.keys()) {
            map.set(key, (map.get(key) ?? 0) / total)
        }
    }

    return { city, country, aso }
}

export const calcClusterInfo = ({ validators }: ValidatorsRawData, basicEligibilityEpochs: number, lastEpoch: number): ClusterInfo => {
    const { mean: meanBlockProduction, stdDev: stdDevBlockProduction } = calcBlockProduction(validators, lastEpoch - basicEligibilityEpochs, lastEpoch - 1)

    return {
        targetCreditsByEpoch: calcTargetCreditsByEpoch(validators),
        ...calcConcentrations(validators, lastEpoch),
        meanBlockProductionOverBasicEligibilityPeriod: meanBlockProduction,
        stdDevBlockProductionOverBasicEligibilityPeriod: stdDevBlockProduction,
    } as ClusterInfo
}
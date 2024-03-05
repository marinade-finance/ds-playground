import { Parser } from "expr-eval"
import { AggregatedValidator, AggregatedValidators, scoreTooltipBuilders, selectASOStakeConcentration, selectBlockProductionMean, selectCityStakeConcentration, selectCommissonInflationMax, selectCommissonMEV, selectCountryStakeConcentration, selectCreditsPctMean, selectNodeStake } from "./aggregate"
import { ClusterInfo } from "./cluster-info"
import { mathUtilityFunctions } from "./math"
import { zip } from "./utils"

const selectVariables = (clusterInfo: ClusterInfo, aggregatedValidator: AggregatedValidator, scoreConfig: ScoreConfig) => ({
    bp_cluster_mean: clusterInfo.meanBlockProductionOverBasicEligibilityPeriod,
    bp_cluster_std_dev: clusterInfo.stdDevBlockProductionOverBasicEligibilityPeriod,

    credits_pct_mean: selectCreditsPctMean(aggregatedValidator, clusterInfo, scoreConfig.epochs),
    bp_mean: selectBlockProductionMean(aggregatedValidator, scoreConfig.epochs),
    commission_inflation_max: selectCommissonInflationMax(aggregatedValidator, scoreConfig.epochs + 1),
    commission_mev: selectCommissonMEV(aggregatedValidator),
    country_stake_concentration_last: selectCountryStakeConcentration(aggregatedValidator, clusterInfo),
    city_stake_concentration_last: selectCityStakeConcentration(aggregatedValidator, clusterInfo),
    aso_stake_concentration_last: selectASOStakeConcentration(aggregatedValidator, clusterInfo),
    node_stake_last: selectNodeStake(aggregatedValidator),
})

export type ScoreConfig = {
    epochs: number // aggregated data are taken for this many past epochs
    concentrationParams: number[]
}

export type Score = {
    score: number,
    concentrationScore: number
    scores: number[]
    values: number[]
    scoreErrors: boolean[]
    tooltips: string[]
}
const calcValidatorScore = (clusterInfo: ClusterInfo, aggregatedValidator: AggregatedValidator, formulas: string[], weights: number[], scoreConfig: ScoreConfig): Score => {
    const scoreErrors = []
    const scores = []
    const values = []
    const tooltips = []
    let totalWeight = 0
    let totalScore = 0
    let totalConcentrationWeight = 0
    let totalConcentrationScore = 0
    const variables = { ...selectVariables(clusterInfo, aggregatedValidator, scoreConfig), ...mathUtilityFunctions()}
    for (const [formula, weight, tooltipBuilder] of zip(formulas, weights, scoreTooltipBuilders)) {
        let componentScore = 0
        try {
            values.push(0)
            componentScore = Parser.evaluate(formula, variables)
            scoreErrors.push(false)
        } catch (err) {
            console.error('Failed to calculate', formula, 'for', aggregatedValidator.voteAccount, 'err:', err)
            scoreErrors.push(true)
        }
        totalWeight += weight
        totalScore += weight * componentScore
        if (scoreConfig.concentrationParams.includes(scores.length)) {
            totalConcentrationWeight += weight
            totalConcentrationScore += weight * componentScore
        }
        tooltips.push(tooltipBuilder(aggregatedValidator, clusterInfo))

        scores.push(componentScore)
    }

    return {
        score: totalScore / totalWeight,
        concentrationScore: totalConcentrationScore / totalConcentrationWeight,
        scores,
        values,
        scoreErrors,
        tooltips,
    }
}

export type Scores = Record<string, Score>
export const calcValidatorsScores = (clusterInfo: ClusterInfo, aggregatedValidators: AggregatedValidators, formulas: string[], weights: number[], scoreConfig: ScoreConfig): Scores => {
    const result = {}

    for (const [voteAccount, aggregatedValidator] of Object.entries(aggregatedValidators)) {
        result[voteAccount] = calcValidatorScore(clusterInfo, aggregatedValidator, formulas, weights, scoreConfig)
    }

    return result
}
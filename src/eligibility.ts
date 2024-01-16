import { AggregatedValidator, AggregatedValidators, selectExternalStakeMin } from "./aggregate"
import { ClusterInfo } from "./cluster-info"
import { Score, Scores } from "./scoring"

export type EligibilityConfig = {
    maxCommission: number
    voteCreditsWarning: number
    voteCreditsLow: number
    minExternalStake: number
    basicEligibilityEpochs: number
    bonusEligibilityExtraEpochs: number
    minScore: number
    maxStakeShare: number
}

export const enum Type {
    NO_DATA = 'NO_DATA',
    SCORE = 'SCORE',
    BLACKLIST = 'BLACKLIST',
    COMMISSION = 'COMMISSION',
    EXTERNAL_STAKE = 'EXTERNAL_STAKE',
    CENTRALIZATION = 'CENTRALIZATION',
    VOTE_CREDITS_LOW = 'VOTE_CREDITS_LOW',
    VOTE_CREDITS_WARNING = 'VOTE_CREDITS_WARNING',
}

export type Issue = {
    type: Type
    message: string
}

const evalLowCreditsIssue = (validator: AggregatedValidator, epochIndex: number, eligibilityConfig: EligibilityConfig, clusterInfo: ClusterInfo): Issue | null => {
    const targetCredits = clusterInfo.targetCreditsByEpoch.get(validator.epochs[epochIndex])
    if (!targetCredits) {
        return null
    }
    const actualCredits = validator.credits[epochIndex]
    const creditsPct = Math.round(100 * actualCredits / targetCredits)
    if (creditsPct < eligibilityConfig.voteCreditsLow) {
        return { type: Type.VOTE_CREDITS_LOW, message: `Credits @ ${creditsPct} %` }
    } else if (creditsPct < eligibilityConfig.voteCreditsWarning) {
        return { type: Type.VOTE_CREDITS_WARNING, message: `(Warning) Credits @ ${creditsPct} %` }
    }
}

const evalLowExternalStakeIssue = (validator: AggregatedValidator, epochIndex: number, eligibilityConfig: EligibilityConfig) => {
    const externalStake = validator.externalStake[epochIndex]
    if (externalStake < eligibilityConfig.minExternalStake) {
        return { type: Type.EXTERNAL_STAKE, message: `External stake: ${externalStake}` }
    }
}

const evalBlacklistIssue = (validator: AggregatedValidator) => {
    if (validator.blacklisted) {
        return { type: Type.BLACKLIST, message: `Validator is blacklisted` }
    }
}

const evalHighCommissionIssue = (validator: AggregatedValidator, epochIndex: number, eligibilityConfig: EligibilityConfig) => {
    const commission = validator.commission[epochIndex]
    if (eligibilityConfig.maxCommission < commission) {
        return { type: Type.COMMISSION, message: `Commission: ${commission}%` }
    }
}

const evalScoreIssue = (epochIndex: number, eligibilityConfig: EligibilityConfig, { score }: Score) => {
    if (epochIndex === 0 && score < eligibilityConfig.minScore) {
        return { type: Type.SCORE, message: `Score: ${score}` }
    }
}

const getValidatorIssuesInEpoch = (validator: AggregatedValidator, epochIndex: number, eligibilityConfig: EligibilityConfig, clusterInfo: ClusterInfo, score: Score) => {
    if (!validator.dataAvailable[epochIndex]) {
        return [{ type: Type.NO_DATA, message: `No data for validator in epoch ${validator.epochs[epochIndex]}` }]
    }
    return [
        evalBlacklistIssue(validator),
        evalLowCreditsIssue(validator, epochIndex, eligibilityConfig, clusterInfo),
        evalLowExternalStakeIssue(validator, epochIndex, eligibilityConfig),
        evalHighCommissionIssue(validator, epochIndex, eligibilityConfig),
        evalScoreIssue(epochIndex, eligibilityConfig, score),
    ].filter(Boolean)
}
const evaluateIssuesInEpoch = (issues: Issue[]) => {
    let criticals = 0
    let warnings = 0
    for (const issue of issues) {
        switch (issue.type) {
            case Type.NO_DATA:
            case Type.BLACKLIST:
            case Type.COMMISSION:
            case Type.EXTERNAL_STAKE:
            case Type.CENTRALIZATION:
            case Type.SCORE:
            case Type.VOTE_CREDITS_LOW:
                criticals++
                break
            case Type.VOTE_CREDITS_WARNING: {
                warnings++
                break
            }
            default: throw new Error(`Unexpected issue: ${issue.type}`)
        }
    }

    return { criticals, warnings }
}

const evaluateIssues = (issuesCollection: Issue[][], epochs: number) => {
    let totalCriticals = 0
    let totalWarnings = 0
    for (let epochIndex = 0; epochIndex < epochs; epochIndex++) {
        const { criticals, warnings } = evaluateIssuesInEpoch(issuesCollection[epochIndex])
        totalCriticals += criticals
        totalWarnings += warnings
    }
    return { criticals: totalCriticals, warnings: totalWarnings }
}

export const isBasicEligible = (issuesCollection: Issue[][], eligibilityConfig: EligibilityConfig) => {
    const { criticals, warnings } = evaluateIssues(issuesCollection, eligibilityConfig.basicEligibilityEpochs + 1)

    return criticals === 0 && warnings <= 1
}

export const isBonusEligible = (issuesCollection: Issue[][], eligibilityConfig: EligibilityConfig) => {
    const { criticals, warnings } = evaluateIssues(issuesCollection, eligibilityConfig.basicEligibilityEpochs + eligibilityConfig.bonusEligibilityExtraEpochs + 1)

    return criticals === 0 && warnings <= 1
}

const getIssuesCollection = (clusterInfo: ClusterInfo, aggregatedValidator: AggregatedValidator, score: Score, eligibilityConfig: EligibilityConfig): Issue[][] => {
    return Array.from({ length: eligibilityConfig.basicEligibilityEpochs + eligibilityConfig.bonusEligibilityExtraEpochs + 1 }, (_, epochIndex) => getValidatorIssuesInEpoch(aggregatedValidator, epochIndex, eligibilityConfig, clusterInfo, score))
}

export type ValidatorEligibility = {
    basicEligibility: boolean
    bonusEligibility: boolean
    issuesCollection: Issue[][]
    capFromBond: number
    capFromExternalStake: number
}
const calcValidatorEligibility = (clusterInfo: ClusterInfo, aggregatedValidator: AggregatedValidator, scores: Score, eligibilityConfig: EligibilityConfig): ValidatorEligibility => {
    const issuesCollection = getIssuesCollection(clusterInfo, aggregatedValidator, scores, eligibilityConfig)
    const minExternalStake = selectExternalStakeMin(aggregatedValidator, eligibilityConfig.basicEligibilityEpochs)

    return {
        basicEligibility: isBasicEligible(issuesCollection, eligibilityConfig),
        bonusEligibility: isBonusEligible(issuesCollection, eligibilityConfig),
        issuesCollection,
        capFromBond: 1e9,
        capFromExternalStake: minExternalStake * (eligibilityConfig.maxStakeShare / (1 - eligibilityConfig.maxStakeShare)),
    }
}

export type ValidatorsEligibilities = Record<string, ValidatorEligibility>
export const calcValidatorsEligibilities = (clusterInfo: ClusterInfo, scores: Scores, aggregatedValidators: AggregatedValidators, eligibilityConfig: EligibilityConfig): ValidatorsEligibilities => {
    const result = {}
    for (const [voteAccount, validator] of Object.entries(aggregatedValidators)) {
        result[voteAccount] = calcValidatorEligibility(clusterInfo, validator, scores[voteAccount], eligibilityConfig)
    }
    return result
}

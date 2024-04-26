import React, { useEffect, useState } from "react";
import styles from './validator.module.css'
import { Stake, ScoreDto, AggregatedValidator, Issue, ValidatorEligibility  } from '@marinade.finance/scoring'

type Props = {
    aggregatedValidator: AggregatedValidator
    eligibility: ValidatorEligibility
    row: number
    score: ScoreDto
    stake: Stake
}

const formatScore = (score: number): string => {
    const formatted = score.toFixed(3)
    if (formatted === '1.000') {
        return '1'
    } else {
        return formatted.replace(/^0\./, '.')
    }
}

const buildIssues = (validator: AggregatedValidator, issuesCollection: Issue[][]) => {
    return issuesCollection.map((issues, epochIndex) => <div className={styles.epoch} key={epochIndex}>
        {
            issues === null || issues.length === 0
                ? <div title={`Epoch ${validator.epochs[epochIndex]} with no issues`} className={`${styles.issue}`}>&nbsp;</div>
                : issues.map((issue, i) => <div key={i} title={`Epoch ${validator.epochs[epochIndex]}: ${issue.message}`} className={`${styles.issue} ${styles[issue.type]}`}>&nbsp;</div>)
        }
    </div>)
}

const buildAlgoStakeTooltip = (stake: Stake, eligibility: ValidatorEligibility): string => {
    return [
        `Stake from algo`,
        `Total stake capped by external stake: ${Math.round(eligibility.capFromExternalStake).toLocaleString()}`,
        `Total stake capped by bond: ${Math.round(eligibility.capFromBond).toLocaleString()}`
    ].join('\n')
}

const buildMSolStakeTooltip = (stake: Stake, eligibility: ValidatorEligibility): string => {
    return [
        `Stake from mSOL`,
        `Total stake capped by external stake: ${Math.round(eligibility.capFromExternalStake).toLocaleString()}`,
        `Total stake capped by bond: ${Math.round(eligibility.capFromBond).toLocaleString()}`
    ].join('\n')
}

const buildVeMndeStakeTooltip = (stake: Stake, eligibility: ValidatorEligibility): string => {
    return [
        `Stake from veMNDE`,
        `Total stake capped by external stake: ${Math.round(eligibility.capFromExternalStake).toLocaleString()}`,
        `Total stake capped by bond: ${Math.round(eligibility.capFromBond).toLocaleString()}`
    ].join('\n')
}

export const Validator: React.FC<Props> = (props: Props) => {
    try {
        const algoStakeTooltip = props.stake ? buildAlgoStakeTooltip(props.stake, props.eligibility) : undefined
        const mSolStakeTooltip = props.stake ? buildMSolStakeTooltip(props.stake, props.eligibility) : undefined
        const veMndeStakeTooltip = props.stake ? buildVeMndeStakeTooltip(props.stake, props.eligibility) : undefined
        return <div className={styles.validator}>
            <div className={styles.order}>{props.row}</div>
            <div className={`${styles.stake} ${props.stake?.algoStake ? styles.staked : ''} ${props.eligibility.basicEligibility ? styles.eligible : ''}`} title={algoStakeTooltip}>
                {props.stake?.algoStake ? Math.round(props.stake.algoStake).toLocaleString() : <>&nbsp;</>}
            </div>
            <div className={`${styles.stake} ${props.stake?.mSolStake ? styles.staked : ''} ${props.eligibility.basicEligibility ? styles.eligible : ''}`} title={mSolStakeTooltip}>
                {props.stake?.mSolStake ? Math.round(props.stake.mSolStake).toLocaleString() : <>&nbsp;</>}
            </div>
            <div className={`${styles.stake} ${props.stake?.veMndeStake ? styles.staked : ''} ${props.eligibility.basicEligibility ? styles.eligible : ''}`} title={veMndeStakeTooltip}>
                {props.stake?.veMndeStake ? Math.round(props.stake.veMndeStake).toLocaleString() : <>&nbsp;</>}
            </div>
            <div className={styles.validatorDetail}>
                <div>{props.aggregatedValidator.voteAccount}</div>
                <div>{props.aggregatedValidator.name || "---"}</div>
            </div>
            <div className={styles.scoreBreakdown}>
                <div className={styles.totalScore}>{formatScore(props.score.score)}</div>
                {
                    props.score.scores.map((score, i) => <div key={i} title={`${props.score.tooltips[i]}`} className={props.score.scoreErrors[i] ? styles.error : ''}>{formatScore(score)}</div>)
                }
            </div>
            <div className={styles.validatorEligibility}>
                {
                    buildIssues(props.aggregatedValidator, props.eligibility.issuesCollection)
                }
            </div>
        </div>
    } catch (err) {
        console.error(err)
        return <>{`error rendering ${props.aggregatedValidator.voteAccount}`}</>
    }
};

import React, { useEffect, useState } from "react";
import styles from './validator.module.css'
import { Issue, ValidatorEligibility } from "../../eligibility";
import { AggregatedValidator } from "../../aggregate";
import { Score } from "../../scoring";
import { Stake } from "../../staking";

type Props = {
    aggregatedValidator: AggregatedValidator
    eligibility: ValidatorEligibility
    row: number
    score: Score
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

export const Validator: React.FC<Props> = (props: Props) => {
    try {
        return <div className={styles.validator}>
            <div className={styles.order}>{props.row}</div>
            <div className={`${styles.stake} ${props.stake?.total ? styles.staked : ''}`}>{props.stake?.hypotheticalTotal ? Math.round(props.stake.hypotheticalTotal).toLocaleString() : null}</div>
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

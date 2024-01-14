import React from "react";
import styles from './validators-table.module.css'
import { Validator } from "../validator/validator";
import { ValidatorsEligibilities } from "../../eligibility";
import { Scores } from "../../scoring";
import { Stakes } from "../../staking";
import { AggregatedValidators } from "../../aggregate";

type Props = {
    aggregatedValidators: AggregatedValidators
    scores: Scores
    eligibilities: ValidatorsEligibilities
    stakes: Stakes
}

const getEpochRange = (validators: any, epochs: number) => {
    let maxEpoch = 0
    for (const validator of validators) {
        for (const { epoch } of validator.epoch_stats) {
            maxEpoch = Math.max(epoch, maxEpoch)
        }
    }
    return [maxEpoch - epochs, maxEpoch]
}

const orderByEligibiltyAndScore = (scores: Scores, eligibilities: ValidatorsEligibilities): string[] => {
    const voteAccounts = Object.keys(scores)
    voteAccounts.sort((a, b) => {
        const eligibilityOrder = Number(eligibilities[b]?.basicEligibility ?? 0) - Number(eligibilities[a]?.basicEligibility ?? 0)
        if (eligibilityOrder === 0) {
            return scores[b].score - scores[a].score
        }
        return eligibilityOrder
    })

    return voteAccounts
}

export const ValidatorsTable: React.FC<Props> = (props) => {
    return <div className={styles.validatorsTable}>
        {
            (() => {
                console.time("sort")
                const orderedVoteAccount = orderByEligibiltyAndScore(props.scores, props.eligibilities)
                console.timeEnd("sort")

                console.time("rows")
                const rows = orderedVoteAccount.map((voteAccount, rowIndex) =>
                    <Validator
                        row={rowIndex + 1}
                        aggregatedValidator={props.aggregatedValidators[voteAccount]}
                        eligibility={props.eligibilities[voteAccount]}
                        score={props.scores[voteAccount]}
                        stake={props.stakes[voteAccount]}
                        key={voteAccount}
                    />)
                console.timeEnd("rows")

                return rows
            })()
        }
    </div>
};

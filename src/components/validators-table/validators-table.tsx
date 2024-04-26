import React from "react";
import styles from './validators-table.module.css'
import { AggregatedValidators, Stakes, Scores, ValidatorsEligibilities } from '@marinade.finance/scoring';
import { Validator } from "../validator/validator";

type Props = {
    validatorsTableData: {
        aggregatedValidators: AggregatedValidators
        scores: Scores
        eligibilities: ValidatorsEligibilities
        stakes: Stakes
    }
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
                const orderedVoteAccount = orderByEligibiltyAndScore(props.validatorsTableData.scores, props.validatorsTableData.eligibilities)
                console.timeEnd("sort")

                console.time("rows")
                const rows = orderedVoteAccount.map((voteAccount, rowIndex) =>
                    <Validator
                        row={rowIndex + 1}
                        aggregatedValidator={props.validatorsTableData.aggregatedValidators[voteAccount]}
                        eligibility={props.validatorsTableData.eligibilities[voteAccount]}
                        score={props.validatorsTableData.scores[voteAccount]}
                        stake={props.validatorsTableData.stakes[voteAccount]}
                        key={voteAccount}
                    />)
                console.timeEnd("rows")

                return rows
            })()
        }
    </div>
};

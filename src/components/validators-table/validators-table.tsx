import React from "react";
import styles from './validators-table.module.css'
import { AggregatedValidators, Stakes, Scores, ValidatorsEligibilities, orderByEligibiltyAndScore } from '@marinade.finance/scoring';
import { Validator } from "../validator/validator";

type Props = {
    validatorsTableData: {
        aggregatedValidators: AggregatedValidators
        scores: Scores
        eligibilities: ValidatorsEligibilities
        stakes: Stakes
    }
}

export const ValidatorsTable: React.FC<Props> = (props) => {
    return <div className={styles.validatorsTable}>
        {
            (() => {
                console.time("sort")
                const orderedVoteAccount = orderByEligibiltyAndScore(props.validatorsTableData.scores, props.validatorsTableData.eligibilities)
                console.timeEnd("sort")

                console.time("rows")
                const rows = orderedVoteAccount.map((voteAccount, rank) =>
                    <Validator
                        row={rank + 1}
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

import React, { useEffect, useState } from "react";
import styles from './stats.module.css'
import { Issue, ValidatorEligibility, ValidatorsEligibilities } from "../../eligibility";
import { AggregatedValidator, AggregatedValidators } from "../../aggregate";
import { Score, Scores } from "../../scoring";
import { Stake, Stakes } from "../../staking";
import { sum } from "../../math";

type Props = {
    validatorsTableData: {
        aggregatedValidators: AggregatedValidators
        scores: Scores
        eligibilities: ValidatorsEligibilities
        stakes: Stakes
    }
}

const formatScore = (score: number): string => {
    const formatted = score.toFixed(3)
    if (formatted === '1.000') {
        return '1'
    } else {
        return formatted.replace(/^0\./, '.')
    }
}

const filterEligibleValidators = (eligibilities: ValidatorsEligibilities) => Object
    .entries(eligibilities)
    .filter(([_, { basicEligibility }]) => basicEligibility)
    .map(([voteAccount]) => voteAccount)

const calcCommissionAlgo = (props: Props) => {
    const totalStake = sum(Object.values(props.validatorsTableData.stakes).map(({ algoStake }) => algoStake))
    return sum(filterEligibleValidators(props.validatorsTableData.eligibilities).map((voteAccount) => props.validatorsTableData.aggregatedValidators[voteAccount].commission[0] * props.validatorsTableData.stakes[voteAccount].algoStake / totalStake))
}

const calcCommissionMSol = (props: Props) => {
    const totalStake = sum(Object.values(props.validatorsTableData.stakes).map(({ mSolStake }) => mSolStake))
    return sum(filterEligibleValidators(props.validatorsTableData.eligibilities).map((voteAccount) => props.validatorsTableData.aggregatedValidators[voteAccount].commission[0] * props.validatorsTableData.stakes[voteAccount].mSolStake / totalStake))
}

const calcCommissionMNDE = (props: Props) => {
    const totalStake = sum(Object.values(props.validatorsTableData.stakes).map(({ veMndeStake }) => veMndeStake))
    return sum(filterEligibleValidators(props.validatorsTableData.eligibilities).map((voteAccount) => props.validatorsTableData.aggregatedValidators[voteAccount].commission[0] * props.validatorsTableData.stakes[voteAccount].veMndeStake / totalStake))
}

const calcCommissionTotal = (props: Props) => {
    const totalStake = sum(Object.values(props.validatorsTableData.stakes).map(({ totalStake }) => totalStake))
    return sum(filterEligibleValidators(props.validatorsTableData.eligibilities).map((voteAccount) => props.validatorsTableData.aggregatedValidators[voteAccount].commission[0] * props.validatorsTableData.stakes[voteAccount].totalStake / totalStake))
}

const commissionStats = (props: Props) => {
    return <div className={styles.stat}>
        <i>Commission</i><br />
        Algo: {calcCommissionAlgo(props).toFixed(2)} %<br />
        mSOL: {calcCommissionMSol(props).toFixed(2)} %<br />
        MNDE: {calcCommissionMNDE(props).toFixed(2)} %<br />
        Total: {calcCommissionTotal(props).toFixed(2)} %
    </div>
}

const countStats = (props: Props) => {
    return <div className={styles.stat}>
        <i>Count of validators</i><br />
        Algo: {Object.values(props.validatorsTableData.stakes).filter(({ algoStake }) => algoStake).length}<br />
        mSOL: {Object.values(props.validatorsTableData.stakes).filter(({ mSolStake }) => mSolStake).length}<br />
        MNDE: {Object.values(props.validatorsTableData.stakes).filter(({ veMndeStake }) => veMndeStake).length}<br />
        Total: {Object.values(props.validatorsTableData.stakes).filter(({ totalStake }) => totalStake).length}<br />
        Eligible: {Object.values(props.validatorsTableData.eligibilities).filter(({ basicEligibility }) => basicEligibility).length}<br />
        Bonus eligible: {Object.values(props.validatorsTableData.eligibilities).filter(({ bonusEligibility }) => bonusEligibility).length}<br />
    </div>
}

const concStats = (props: Props, totalStake: number, selector: string) => {
    const TOP_X = 10
    let conc = new Map()
    const stakes = Object.entries(props.validatorsTableData.stakes).forEach(([voteAccount, stake]) => {
        const key = props.validatorsTableData.aggregatedValidators[voteAccount][selector]
        conc.set(key, (conc.get(key) ?? 0) + stake.totalStake)
    })

    const keys = [...conc.keys()]
    keys.sort((a, b) => conc.get(b) - conc.get(a))

    return <div className={styles.stat}>
        {
            keys.slice(0, TOP_X).map((key, i) => {
                return <div>{key}: {conc.get(key).toLocaleString()} {Math.round(conc.get(key) / totalStake * 100)} %</div>
            })
        }
        {
            keys.length > TOP_X ? <i>... and {keys.length - TOP_X} others</i> : null
        }
    </div>
}

export const Stats: React.FC<Props> = (props: Props) => {
    const totalStake = sum(Object.values(props.validatorsTableData.stakes).map(({ totalStake }) => totalStake))
    console.log(props.validatorsTableData.aggregatedValidators)
    return <div className={styles.stats}>
        {commissionStats(props)}
        {countStats(props)}
        {concStats(props, totalStake, 'aso')}
        {concStats(props, totalStake, 'country')}
        {concStats(props, totalStake, 'city')}
    </div>
};

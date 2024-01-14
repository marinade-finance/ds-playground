import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import styles from './page.module.css'
import { Navigation } from "../components/navigation/navigation";
import { ValidatorsTable } from "../components/validators-table/validators-table";
import { EligibilityConfig, ValidatorsEligibilities, calcValidatorsEligibilities } from "../eligibility";
import { NumberSelector } from "../components/control/number-selector";
import { ValueSelector } from "../components/control/value-selector";
import { ScoreConfig, Scores, calcValidatorsScores } from "../scoring";
import { Stakes, StakesConfig, calcValidatorsStakes } from "../staking";
import { Loader } from "../components/common/loader";
import { getMaxEpoch, getValidatorsRawData } from "../validator-data";
import { AggregatedValidators, aggregateValidatorsData, scoreTooltipBuilders } from "../aggregate";
import { calcClusterInfo } from "../cluster-info";
import { zip } from "../utils";

const parseString = (value: string) => value

const SNAPSHOT_VERSION = 1
type Snapshot = {
    values: any[]
    version: number
}

const DEFAULT_SNAPSHOT = 'eyJ2YWx1ZXMiOlsxMCw1LDUsMC4wMSwxLDIsMywxMCwxNCwxNCw4LDk4LDgwLDEwMCwwLjksIm1pbihjcmVkaXRzX3BjdF9tZWFuIF4gMTAsIDEpIiwicGllY2V3aXNlKChicF9tZWFuIC0gYnBfY2x1c3Rlcl9tZWFuKSAvIGJwX2NsdXN0ZXJfc3RkX2RldiA8IC0xLCBicF9tZWFuIC8gKGJwX2NsdXN0ZXJfbWVhbiAtIGJwX2NsdXN0ZXJfc3RkX2RldiksIDEpIiwicGllY2V3aXNlKGNvbW1pc3Npb25faW5mbGF0aW9uX21heCA8PSAxMCwgKDEwMCAtIGNvbW1pc3Npb25faW5mbGF0aW9uX21heCkgLyAxMDAsIDApIiwiKDEwMCAtIGNvbW1pc3Npb25fbWV2KSAvIDEwMCIsInBpZWNld2lzZShjb3VudHJ5X3N0YWtlX2NvbmNlbnRyYXRpb25fbGFzdCA8IDEvMywgKDEgLSAoMyAqIGNvdW50cnlfc3Rha2VfY29uY2VudHJhdGlvbl9sYXN0KSkgXiAwLjI1LCAwKSIsInBpZWNld2lzZShjaXR5X3N0YWtlX2NvbmNlbnRyYXRpb25fbGFzdCA8IDEvMywgKDEgLSAoMyAqIGNpdHlfc3Rha2VfY29uY2VudHJhdGlvbl9sYXN0KSkgXiAwLjI1LCAwKSIsInBpZWNld2lzZShhc29fc3Rha2VfY29uY2VudHJhdGlvbl9sYXN0IDwgMS8zLCAoMSAtICgzICogYXNvX3N0YWtlX2NvbmNlbnRyYXRpb25fbGFzdCkpIF4gMC4yNSwgMCkiLCJwaWVjZXdpc2Uobm9kZV9zdGFrZV9sYXN0IDwgODAwMDAwLCAxLCBub2RlX3N0YWtlX2xhc3QgPCAzMDAwMDAwLCAoMSAtIChub2RlX3N0YWtlX2xhc3QgLSA4MDAwMDApIC8gKDMwMDAwMDAgLSA4MDAwMDApKSBeIDAuNSwgMCkiLDYwMDAwMDAsInR2bCAvICgoNjAwMDAwMCAvICAzMDAwMCkgKiAxLjUgXiAobG9nKHR2bCAvIDYwMDAwMDApIC8gbG9nKDIpKSkiLDEsIjEgKyAoKHNjb3JlIC0gMC45NCkgLyAoMSAtIDAuOTQpKSBeMTAiLDAuOF0sInZlcnNpb24iOjF9'

const exportData = (
    { aggregatedValidators, scores, eligibilities, stakes }: {
        aggregatedValidators: AggregatedValidators
        scores: Scores
        eligibilities: ValidatorsEligibilities
        stakes: Stakes
    }) => {
    const header = ['voteAccount']
    header.push(...Array.from({ length: scoreTooltipBuilders.length }, (_, i) => `score_component_${i}`))
    header.push('stake', 'hypothetical_stake')
    header.push('basic_eligible', 'bonus_eligible')
    const rows = []
    for (const [voteAccount, validator] of Object.entries(aggregatedValidators)) {
        const row = []
        row.push(voteAccount)
        row.push(scores[voteAccount].score)
        row.push(...scores[voteAccount].scores)
        row.push(stakes[voteAccount]?.total ?? '')
        row.push(stakes[voteAccount]?.hypotheticalTotal ?? '')
        row.push(eligibilities[voteAccount].basicEligibility)
        row.push(eligibilities[voteAccount].bonusEligibility)
        row.join(',')
        rows.push(row)
    }
    const content = `${header.join(',')}\n${rows.join('\n')}`
    const uri = `data:text/csv,${encodeURI(content)}`
    const link = document.createElement("a");
    link.download = 'ds-playground.csv';
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export const PagePlaygroundAlgo: React.FC = () => {
    const [loading, setLoading] = useState(true)
    const [validatorsRawData, setValidatorsRawData] = useState(null)

    const [componentWeightVoteCredits, setComponentWeightVoteCredits] = useState(10)
    const [componentWeightBlockProduction, setComponentWeightBlockProduction] = useState(5)
    const [componentWeightInflationCommission, setComponentWeightInflationCommission] = useState(5)
    const [componentWeightMEVCommission, setComponentWeightMEVCommission] = useState(0.01)
    const [componentWeightStakeConcentrationCountry, setComponentWeightStakeConcentrationCountry] = useState(1)
    const [componentWeightStakeConcentrationCity, setComponentWeightStakeConcentrationCity] = useState(2)
    const [componentWeightStakeConcentrationASO, setComponentWeightStakeConcentrationASO] = useState(3)
    const [componentWeightStakeConcentrationNode, setComponentWeightStakeConcentrationNode] = useState(10)

    const [basicEligibilityEpochs, setBasicEligibilityEpochs] = useState(14)
    const [bonusEligibilityExtraEpochs, setBonusEligibilityExtraEpochs] = useState(14)
    const [maxCommission, setMaxCommission] = useState(8)
    const [voteCreditsWarning, setVoteCreditsWarning] = useState(98)
    const [voteCreditsLow, setVoteCreditsLow] = useState(80)
    const [minExternalStake, setMinExternalStake] = useState(100)
    const [minScore, setMinScore] = useState(0.90)

    const [formulaVoteCredits, setFormulaVoteCredits] = useState('min(credits_pct_mean ^ 10, 1)')
    const [formulaBlockProduction, setFormulaBlockProduction] = useState('piecewise((bp_mean - bp_cluster_mean) / bp_cluster_std_dev < -1, bp_mean / (bp_cluster_mean - bp_cluster_std_dev), 1)')
    const [formulaInflationCommission, setFormulaInflationCommission] = useState('piecewise(commission_inflation_max <= 10, (100 - commission_inflation_max) / 100, 0)')
    const [formulaMEVCommission, setFormulaMEVCommission] = useState('(100 - commission_mev) / 100')
    const [formulaStakeConcentrationCountry, setFormulaStakeConcentrationCountry] = useState('piecewise(country_stake_concentration_last < 1/3, (1 - (3 * country_stake_concentration_last)) ^ 0.25, 0)')
    const [formulaStakeConcentrationCity, setFormulaStakeConcentrationCity] = useState('piecewise(city_stake_concentration_last < 1/3, (1 - (3 * city_stake_concentration_last)) ^ 0.25, 0)')
    const [formulaStakeConcentrationASO, setFormulaStakeConcentrationASO] = useState('piecewise(aso_stake_concentration_last < 1/3, (1 - (3 * aso_stake_concentration_last)) ^ 0.25, 0)')
    const [formulaStakeConcentrationNode, setFormulaStakeConcentrationNode] = useState('piecewise(node_stake_last < 800000, 1, node_stake_last < 3000000, (1 - (node_stake_last - 800000) / (3000000 - 800000)) ^ 0.5, 0)')

    const [tvl, setTvl] = useState(6e6)
    const [formulaStakeBlockSize, setFormulaStakeBlockSize] = useState('tvl / ((6000000 /  30000) * 1.5 ^ (log(tvl / 6000000) / log(2)))')
    const [stakeBlocksFromBonus, setStakeBlocksFromBonus] = useState(1)
    const [formulaStakeBlocksFromScore, setFormulaStakeBlocksFromScore] = useState('1 + ((score - 0.94) / (1 - 0.94)) ^10')
    const [maxStakeShare, setMaxStakeShare] = useState(0.8)

    const snapshotConfig = [
        [componentWeightVoteCredits, setComponentWeightVoteCredits],
        [componentWeightBlockProduction, setComponentWeightBlockProduction],
        [componentWeightInflationCommission, setComponentWeightInflationCommission],
        [componentWeightMEVCommission, setComponentWeightMEVCommission],
        [componentWeightStakeConcentrationCountry, setComponentWeightStakeConcentrationCountry],
        [componentWeightStakeConcentrationCity, setComponentWeightStakeConcentrationCity],
        [componentWeightStakeConcentrationASO, setComponentWeightStakeConcentrationASO],
        [componentWeightStakeConcentrationNode, setComponentWeightStakeConcentrationNode],
        [basicEligibilityEpochs, setBasicEligibilityEpochs],
        [bonusEligibilityExtraEpochs, setBonusEligibilityExtraEpochs],
        [maxCommission, setMaxCommission],
        [voteCreditsWarning, setVoteCreditsWarning],
        [voteCreditsLow, setVoteCreditsLow],
        [minExternalStake, setMinExternalStake],
        [minScore, setMinScore],
        [formulaVoteCredits, setFormulaVoteCredits],
        [formulaBlockProduction, setFormulaBlockProduction],
        [formulaInflationCommission, setFormulaInflationCommission],
        [formulaMEVCommission, setFormulaMEVCommission],
        [formulaStakeConcentrationCountry, setFormulaStakeConcentrationCountry],
        [formulaStakeConcentrationCity, setFormulaStakeConcentrationCity],
        [formulaStakeConcentrationASO, setFormulaStakeConcentrationASO],
        [formulaStakeConcentrationNode, setFormulaStakeConcentrationNode],
        [tvl, setTvl],
        [formulaStakeBlockSize, setFormulaStakeBlockSize],
        [stakeBlocksFromBonus, setStakeBlocksFromBonus],
        [formulaStakeBlocksFromScore, setFormulaStakeBlocksFromScore],
        [maxStakeShare, setMaxStakeShare],
    ] as const

    const takeSnapshot = () => {
        const values = []
        for (const [value, _] of snapshotConfig) {
            values.push(value)
        }
        const snapshot = { values, version: SNAPSHOT_VERSION }
        const stringifiedSnapshot = Buffer.from(JSON.stringify(snapshot)).toString('base64')
        return stringifiedSnapshot
    }

    const restoreSnapshot = (stringifiedSnapshot: string) => {
        try {
            const snapshot = JSON.parse(Buffer.from(stringifiedSnapshot, 'base64').toString()) as Snapshot
            if (snapshot.version !== SNAPSHOT_VERSION) {
                console.error('Cannot restore snapshot version:', snapshot.version)
                return
            }
            for (const [snapshotValue, [value, setValue]] of zip(snapshot.values, snapshotConfig)) {
                if (value !== snapshotValue) {
                    setValue(snapshotValue as any)
                }
            }
        } catch (err) {
            console.log('Failed to parse the snapshot', err)
        }
    }

    useMemo(() => {
        const [_, maybeStringifiedSnapshot] = window.location.hash.split('!', 2)
        if (maybeStringifiedSnapshot) {
            console.log('loading from snapshot...')
            restoreSnapshot(maybeStringifiedSnapshot)
        }
    }, [])

    const eligibilityConfig: EligibilityConfig = {
        maxCommission,
        voteCreditsLow,
        voteCreditsWarning,
        minExternalStake,
        basicEligibilityEpochs,
        bonusEligibilityExtraEpochs,
        minScore,
    }

    const stakesConfig: StakesConfig = {
        tvl,
        formulaStakeBlockSize,
        formulaStakeBlocksFromScore,
        stakeBlocksFromBonus,
        maxStakeShare,
        epochs: basicEligibilityEpochs,
    }

    const scoreConfig: ScoreConfig = {
        epochs: basicEligibilityEpochs,
    }

    const weights = [
        componentWeightVoteCredits,
        componentWeightBlockProduction,
        componentWeightInflationCommission,
        componentWeightMEVCommission,
        componentWeightStakeConcentrationCountry,
        componentWeightStakeConcentrationCity,
        componentWeightStakeConcentrationASO,
        componentWeightStakeConcentrationNode,
    ]

    const formulas = [
        formulaVoteCredits,
        formulaBlockProduction,
        formulaInflationCommission,
        formulaMEVCommission,
        formulaStakeConcentrationCountry,
        formulaStakeConcentrationCity,
        formulaStakeConcentrationASO,
        formulaStakeConcentrationNode,
    ]

    useEffect(() => {
        (async () => {
            setLoading(true)
            try {
                setValidatorsRawData(await getValidatorsRawData(bonusEligibilityExtraEpochs + basicEligibilityEpochs + 1))
            } catch (err) {
                setValidatorsRawData(null)
                console.log(err)
            }
            setLoading(false)
        })()
    }, [bonusEligibilityExtraEpochs, basicEligibilityEpochs])

    const [validatorsTableData, setValidatorsTableData] = useState(null)
    useEffect(() => {
        if (validatorsRawData) {
            const prefix = Math.random().toString(36).slice(2)
            const timeLabel = (label: string) => `${prefix}_${label}`

            console.time(timeLabel("getMaxEpoch"))
            const endEpoch = getMaxEpoch(validatorsRawData.validators)
            const startEpoch = endEpoch - basicEligibilityEpochs - bonusEligibilityExtraEpochs
            console.timeEnd(timeLabel("getMaxEpoch"))

            console.time(timeLabel("calcClusterInfo"))
            const clusterInfo = calcClusterInfo(validatorsRawData, startEpoch, endEpoch)
            console.timeEnd(timeLabel("calcClusterInfo"))

            console.time(timeLabel("aggregateValidatorsData"))
            const aggregatedValidators = aggregateValidatorsData(validatorsRawData, startEpoch, endEpoch)
            console.timeEnd(timeLabel("aggregateValidatorsData"))

            console.time(timeLabel("calcValidatorsScores"))
            const scores = calcValidatorsScores(clusterInfo, aggregatedValidators, formulas, weights, scoreConfig)
            console.timeEnd(timeLabel("calcValidatorsScores"))

            console.time(timeLabel("calcValidatorsEligibilities"))
            const eligibilities = calcValidatorsEligibilities(clusterInfo, scores, aggregatedValidators, eligibilityConfig)
            console.timeEnd(timeLabel("calcValidatorsEligibilities"))

            console.time(timeLabel("calcValidatorsStakes"))
            const stakes = calcValidatorsStakes(aggregatedValidators, scores, eligibilities, stakesConfig, eligibilityConfig)
            console.timeEnd(timeLabel("calcValidatorsStakes"))

            setValidatorsTableData({
                aggregatedValidators, scores, eligibilities, stakes
            })

            const snapshot = takeSnapshot()
            history.pushState(null, null, `#!${snapshot}`);
        }
    }, [validatorsRawData, componentWeightVoteCredits,
        componentWeightBlockProduction,
        componentWeightInflationCommission,
        componentWeightMEVCommission,
        componentWeightStakeConcentrationCountry,
        componentWeightStakeConcentrationCity,
        componentWeightStakeConcentrationASO,
        componentWeightStakeConcentrationNode,
        basicEligibilityEpochs,
        bonusEligibilityExtraEpochs,
        maxCommission,
        voteCreditsWarning,
        voteCreditsLow,
        minExternalStake,
        minScore,
        formulaVoteCredits,
        formulaBlockProduction,
        formulaInflationCommission,
        formulaMEVCommission,
        formulaStakeConcentrationCountry,
        formulaStakeConcentrationCity,
        formulaStakeConcentrationASO,
        formulaStakeConcentrationNode,
        tvl,
        formulaStakeBlockSize,
        stakeBlocksFromBonus,
        formulaStakeBlocksFromScore,
        maxStakeShare,
    ])

    const deferredTable = useDeferredValue(validatorsTableData)

    return <div className={styles.pageWrap}>
        <div className={styles.navigation}>
            <Navigation />
        </div>
        <div className={styles.control}>
            <div className={styles.controlSection}>
                <div className={styles.title}>Controls</div>
                <div className={styles.button} onClick={() => restoreSnapshot(DEFAULT_SNAPSHOT)}>Reset</div>
                <div className={styles.button} onClick={() => validatorsTableData && exportData(validatorsTableData)}>Export</div>
                <div className={styles.button} onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy Link</div>
            </div>
            <div className={styles.controlSection}>
                <div className={styles.title}>Weights of scoring components</div>
                <NumberSelector title="Credits" default={componentWeightVoteCredits} onChange={(value) => setComponentWeightVoteCredits(value)} />
                <NumberSelector title="Blocks" default={componentWeightBlockProduction} onChange={(value) => setComponentWeightBlockProduction(value)} />
                <NumberSelector title="Inflation" default={componentWeightInflationCommission} onChange={(value) => setComponentWeightInflationCommission(value)} />
                <NumberSelector title="MEV" default={componentWeightMEVCommission} onChange={(value) => setComponentWeightMEVCommission(value)} />
                <NumberSelector title="Country stake" default={componentWeightStakeConcentrationCountry} onChange={(value) => setComponentWeightStakeConcentrationCountry(value)} />
                <NumberSelector title="City stake" default={componentWeightStakeConcentrationCity} onChange={(value) => setComponentWeightStakeConcentrationCity(value)} />
                <NumberSelector title="ASO stake" default={componentWeightStakeConcentrationASO} onChange={(value) => setComponentWeightStakeConcentrationASO(value)} />
                <NumberSelector title="Node stake" default={componentWeightStakeConcentrationNode} onChange={(value) => setComponentWeightStakeConcentrationNode(value)} />
            </div>
            <div className={styles.controlSection}>
                <div className={styles.title}>Formulas for scoring components</div>
                <ValueSelector parse={parseString} title="Credits" default={formulaVoteCredits} onChange={(value) => setFormulaVoteCredits(value)} />
                <ValueSelector parse={parseString} title="Blocks" default={formulaBlockProduction} onChange={(value) => setFormulaBlockProduction(value)} />
                <ValueSelector parse={parseString} title="Inflation" default={formulaInflationCommission} onChange={(value) => setFormulaInflationCommission(value)} />
                <ValueSelector parse={parseString} title="MEV" default={formulaMEVCommission} onChange={(value) => setFormulaMEVCommission(value)} />
                <ValueSelector parse={parseString} title="Country stake" default={formulaStakeConcentrationCountry} onChange={(value) => setFormulaStakeConcentrationCountry(value)} />
                <ValueSelector parse={parseString} title="City stake" default={formulaStakeConcentrationCity} onChange={(value) => setFormulaStakeConcentrationCity(value)} />
                <ValueSelector parse={parseString} title="ASO stake" default={formulaStakeConcentrationASO} onChange={(value) => setFormulaStakeConcentrationASO(value)} />
                <ValueSelector parse={parseString} title="Node stake" default={formulaStakeConcentrationNode} onChange={(value) => setFormulaStakeConcentrationNode(value)} />
            </div>
            <div className={styles.controlSection}>
                <div className={styles.title}>Eligibility settings</div>
                <NumberSelector title="Basic eligibility [epochs]" default={basicEligibilityEpochs} onChange={(value) => setBasicEligibilityEpochs(value)} />
                <NumberSelector title="Bonus eligibility [epochs]" default={bonusEligibilityExtraEpochs} onChange={(value) => setBonusEligibilityExtraEpochs(value)} />
                <NumberSelector title="Max inflation commission [%]" default={maxCommission} onChange={(value) => setMaxCommission(value)} />
                <NumberSelector title="Vote credits warning [%]" default={voteCreditsWarning} onChange={(value) => setVoteCreditsWarning(value)} />
                <NumberSelector title="Vote credits low [%]" default={voteCreditsLow} onChange={(value) => setVoteCreditsLow(value)} />
                <NumberSelector title="Min external stake [SOL]" default={minExternalStake} onChange={(value) => setMinExternalStake(value)} />
                <NumberSelector title="Minimum score" default={minScore} onChange={(value) => setMinScore(value)} />
            </div>
            <div className={styles.controlSection}>
                <div className={styles.title}>Stake assignment settings</div>
                <NumberSelector title="TVL for algorithmic [SOL]" default={tvl} onChange={(value) => setTvl(value)} />
                <ValueSelector parse={parseString} title="Stake block size" default={formulaStakeBlockSize} onChange={(value) => setFormulaStakeBlockSize(value)} />
                <ValueSelector parse={parseString} title="Stake blocks from score" default={formulaStakeBlocksFromScore} onChange={(value) => setFormulaStakeBlocksFromScore(value)} />
                <NumberSelector title="Stake blocks from bonus" default={stakeBlocksFromBonus} onChange={(value) => setStakeBlocksFromBonus(value)} />
                <NumberSelector title="Max stake share [%/100]" default={maxStakeShare} onChange={(value) => setMaxStakeShare(value)} />
            </div>
        </div>
        <div className={styles.content}>
            {loading || !deferredTable || JSON.stringify(deferredTable) !== JSON.stringify(validatorsTableData) ? <><br /><br /><br /><Loader /></> : <ValidatorsTable
                validatorsTableData={deferredTable}
            />}
        </div>
    </div>
};

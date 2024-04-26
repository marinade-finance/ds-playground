import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import styles from './page.module.css'
import { Navigation } from "../components/navigation/navigation";
import { ValidatorsTable } from "../components/validators-table/validators-table";
import { zip, AggregatedValidators, aggregateValidatorsData, getScoreTooltipBuilders, Stakes, StakesConfig, computeValidatorsStakes, ScoreConfig, Scores, computeValidatorsScores, EligibilityConfig, ValidatorsEligibilities, computeValidatorsEligibilities, getMaxEpoch, computeClusterInfo, ScoringConfig, ApiDataProvider, ValidatorDto } from '@marinade.finance/scoring'
import { NumberSelector } from "../components/control/number-selector";
import { ValueSelector } from "../components/control/value-selector";
import { Loader } from "../components/common/loader";
import { Stats } from "../components/stats/stats";
import * as defaultScoringConfig from "@marinade.finance/scoring/dist/constants/marinade.json";

const parseString = (value: string) => value

const SNAPSHOT_VERSION = 1
type Snapshot = {
    values: any[]
    version: number
}

const DEFAULT_SNAPSHOT = 'eyJ2YWx1ZXMiOlsxMCw1LDQuOSwwLjEsMiwzLDQsMiwxNCwwLDcsMCw4MCwwLDAuOCwwLjgsIm1pbihjcmVkaXRzX3BjdF9tZWFuIF4gMTAsIDEpIiwicGllY2V3aXNlKChicF9tZWFuIC0gYnBfY2x1c3Rlcl9tZWFuKSAvIGJwX2NsdXN0ZXJfc3RkX2RldiA8IC0xLCBicF9tZWFuIC8gKGJwX2NsdXN0ZXJfbWVhbiAtIGJwX2NsdXN0ZXJfc3RkX2RldiksIDEpIiwicGllY2V3aXNlKGNvbW1pc3Npb25faW5mbGF0aW9uX21heCA8PSAxMCwgKDEwMCAtIGNvbW1pc3Npb25faW5mbGF0aW9uX21heCkgLyAxMDAsIDApIiwiKDEwMCAtIGNvbW1pc3Npb25fbWV2KSAvIDEwMCIsInBpZWNld2lzZShjb3VudHJ5X3N0YWtlX2NvbmNlbnRyYXRpb25fbGFzdCA8IDEvMywgKDEgLSAoMyAqIGNvdW50cnlfc3Rha2VfY29uY2VudHJhdGlvbl9sYXN0KSkgXiAoMS8zKSwgMCkiLCJwaWVjZXdpc2UoY2l0eV9zdGFrZV9jb25jZW50cmF0aW9uX2xhc3QgPCAxLzMsICgxIC0gKDMgKiBjaXR5X3N0YWtlX2NvbmNlbnRyYXRpb25fbGFzdCkpIF4gKDEvMyksIDApIiwicGllY2V3aXNlKGFzb19zdGFrZV9jb25jZW50cmF0aW9uX2xhc3QgPCAxLzMsICgxIC0gKDMgKiBhc29fc3Rha2VfY29uY2VudHJhdGlvbl9sYXN0KSkgXiAoMS8zKSwgMCkiLCJwaWVjZXdpc2Uobm9kZV9zdGFrZV9sYXN0IDwgMTAwMDAwLCAxLCBub2RlX3N0YWtlX2xhc3QgPCA0MDAwMDAwLCAxIC0gKG5vZGVfc3Rha2VfbGFzdCAtIDEwMDAwMCkgLyAoNDAwMDAwMCAtIDEwMDAwMCksIDApIiwxMDAwMDAwMCwwLjIsMC4yLCJ0dmwgLyAoKDYwMDAwMDAgLyAgMzAwMDApICogMS41IF4gKGxvZyh0dmwgLyA2MDAwMDAwKSAvIGxvZygyKSkpIiwwLCIxICsgKChtYXgoMC45NCwgc2NvcmUpIC0gMC45NCkgLyAoMSAtIDAuOTQpKSBeIDEwIl0sInZlcnNpb24iOjF9='

const exportData = (
    { aggregatedValidators, scores, eligibilities, stakes }: {
        aggregatedValidators: AggregatedValidators
        scores: Scores
        eligibilities: ValidatorsEligibilities
        stakes: Stakes
    }) => {
    const header = ['voteAccount']
    header.push('score')
    header.push(...Array.from({ length: getScoreTooltipBuilders.length }, (_, i) => `score_component_${i}`))
    header.push('stake')
    header.push('basic_eligible', 'bonus_eligible')
    const rows = []
    for (const [voteAccount, _] of Object.entries(aggregatedValidators)) {
        const row = []
        row.push(voteAccount)
        row.push(scores[voteAccount].score)
        row.push(...scores[voteAccount].scores)
        row.push(stakes[voteAccount]?.totalStake ?? '')
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
    const apiDataProvider = new ApiDataProvider(
        {
          validatorsURL: "https://validators-api.marinade.finance/validators",
          blacklistURL: "https://raw.githubusercontent.com/marinade-finance/delegation-strategy-2/master/blacklist.csv",
          vemndeVotesURL: "https://snapshots-api.marinade.finance/v1/votes/vemnde/latest",
          msolVotesURL: "https://snapshots-api.marinade.finance/v1/votes/msol/latest",
          rewardsURL: "https://validators-api.marinade.finance/rewards",
          jitoMevURL: "https://kobe.mainnet.jito.network/api/v1/validators",
          bondsURL: "https://validator-bonds-api.marinade.finance/bonds",
          marinadeTvlURL: "https://api.marinade.finance/tlv",
        }
      )

    const [loading, setLoading] = useState(true)
    const [validatorsRawData, setValidatorsRawData] = useState(null)

    const [componentWeightVoteCredits, setComponentWeightVoteCredits] = useState(defaultScoringConfig.weightVoteCredits)
    const [componentWeightBlockProduction, setComponentWeightBlockProduction] = useState(defaultScoringConfig.weightBlockProduction)
    const [componentWeightInflationCommission, setComponentWeightInflationCommission] = useState(defaultScoringConfig.weightTargetSumOfRewards - defaultScoringConfig.weightMevHeuristic)
    const [componentWeightMEVCommission, setComponentWeightMEVCommission] = useState(defaultScoringConfig.weightMEVCommission)
    const [componentWeightStakeConcentrationCountry, setComponentWeightStakeConcentrationCountry] = useState(defaultScoringConfig.weightStakeConcentrationCountry)
    const [componentWeightStakeConcentrationCity, setComponentWeightStakeConcentrationCity] = useState(defaultScoringConfig.weightStakeConcentrationCity)
    const [componentWeightStakeConcentrationASO, setComponentWeightStakeConcentrationASO] = useState(defaultScoringConfig.weightStakeConcentrationASO)
    const [componentWeightStakeConcentrationNode, setComponentWeightStakeConcentrationNode] = useState(defaultScoringConfig.weightStakeConcentrationNode)

    const [basicEligibilityEpochs, setBasicEligibilityEpochs] = useState(defaultScoringConfig.basicEligibilityEpochs)
    const [bonusEligibilityExtraEpochs, setBonusEligibilityExtraEpochs] = useState(defaultScoringConfig.bonusEligibilityExtraEpochs)
    const [maxCommission, setMaxCommission] = useState(defaultScoringConfig.maxCommission)
    const [voteCreditsWarning, setVoteCreditsWarning] = useState(defaultScoringConfig.voteCreditsWarning)
    const [voteCreditsLow, setVoteCreditsLow] = useState(defaultScoringConfig.voteCreditsLow)
    const [minExternalStake, setMinExternalStake] = useState(defaultScoringConfig.minExternalStake)
    const [minScore, setMinScore] = useState(defaultScoringConfig.minScore)
    const [maxStakeShare, setMaxStakeShare] = useState(defaultScoringConfig.maxStakeShare)

    const [formulaVoteCredits, setFormulaVoteCredits] = useState(defaultScoringConfig.formulaVoteCredits)
    const [formulaBlockProduction, setFormulaBlockProduction] = useState(defaultScoringConfig.formulaBlockProduction)
    const [formulaInflationCommission, setFormulaInflationCommission] = useState(defaultScoringConfig.formulaInflationCommission)
    const [formulaMEVCommission, setFormulaMEVCommission] = useState(defaultScoringConfig.formulaMEVCommission)
    const [formulaStakeConcentrationCountry, setFormulaStakeConcentrationCountry] = useState(defaultScoringConfig.formulaStakeConcentrationCountry)
    const [formulaStakeConcentrationCity, setFormulaStakeConcentrationCity] = useState(defaultScoringConfig.formulaStakeConcentrationCity)
    const [formulaStakeConcentrationASO, setFormulaStakeConcentrationASO] = useState(defaultScoringConfig.formulaStakeConcentrationASO)
    const [formulaStakeConcentrationNode, setFormulaStakeConcentrationNode] = useState(defaultScoringConfig.formulaStakeConcentrationNode)

    const [tvl, setTvl] = useState(10e6)
    const [mSolControl, setMSolControl] = useState(defaultScoringConfig.mSolControl)
    const [veMndeControl, setVeMndeControl] = useState(defaultScoringConfig.veMndeControl)
    const [formulaStakeBlockSize, setFormulaStakeBlockSize] = useState(defaultScoringConfig.formulaStakeBlockSize)
    const [stakeBlocksFromBonus, setStakeBlocksFromBonus] = useState(defaultScoringConfig.stakeBlocksFromBonus)
    const [formulaStakeBlocksFromScore, setFormulaStakeBlocksFromScore] = useState(defaultScoringConfig.formulaStakeBlocksFromScore)

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
        [maxStakeShare, setMaxStakeShare],
        [formulaVoteCredits, setFormulaVoteCredits],
        [formulaBlockProduction, setFormulaBlockProduction],
        [formulaInflationCommission, setFormulaInflationCommission],
        [formulaMEVCommission, setFormulaMEVCommission],
        [formulaStakeConcentrationCountry, setFormulaStakeConcentrationCountry],
        [formulaStakeConcentrationCity, setFormulaStakeConcentrationCity],
        [formulaStakeConcentrationASO, setFormulaStakeConcentrationASO],
        [formulaStakeConcentrationNode, setFormulaStakeConcentrationNode],
        [tvl, setTvl],
        [mSolControl, setMSolControl],
        [veMndeControl, setVeMndeControl],
        [formulaStakeBlockSize, setFormulaStakeBlockSize],
        [stakeBlocksFromBonus, setStakeBlocksFromBonus],
        [formulaStakeBlocksFromScore, setFormulaStakeBlocksFromScore],
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
        maxStakeShare,
        maxWarnings: defaultScoringConfig.maxWarnings
    }

    const stakesConfig: StakesConfig = {
        tvl,
        mSolControl,
        veMndeControl,
        formulaStakeBlockSize,
        formulaStakeBlocksFromScore,
        stakeBlocksFromBonus,
    }

    const scoreConfig: ScoreConfig = {
        epochs: basicEligibilityEpochs,
        concentrationParams: defaultScoringConfig.concentrationParams
    }

    const scoringConfig: ScoringConfig = {
        DS_PUBKEY: defaultScoringConfig.DS_PUBKEY,
        REWARDS_PAST_EPOCHS: defaultScoringConfig.REWARDS_PAST_EPOCHS,
        CAP_FROM_BOND: defaultScoringConfig.CAP_FROM_BOND,
        formulaStakeBlockSize,
        formulaStakeBlocksFromScore,
        formulaVoteCredits,
        formulaBlockProduction,
        formulaInflationCommission,
        formulaMEVCommission,
        formulaStakeConcentrationCountry,
        formulaStakeConcentrationCity,
        formulaStakeConcentrationASO,
        formulaStakeConcentrationNode,
        weightTargetSumOfRewards: defaultScoringConfig.weightTargetSumOfRewards,
        weightMevHeuristic: defaultScoringConfig.weightMevHeuristic,
        weightVoteCredits: componentWeightVoteCredits,
        weightBlockProduction: componentWeightBlockProduction,
        weightInflationCommission: componentWeightInflationCommission,
        weightMEVCommission: componentWeightMEVCommission,
        weightStakeConcentrationCountry: componentWeightStakeConcentrationCountry,
        weightStakeConcentrationCity: componentWeightStakeConcentrationCity,
        weightStakeConcentrationASO: componentWeightStakeConcentrationASO,
        weightStakeConcentrationNode: componentWeightStakeConcentrationNode,
        basicEligibilityEpochs,
        bonusEligibilityExtraEpochs,
        maxCommission,
        voteCreditsWarning,
        voteCreditsLow,
        minExternalStake,
        minScore,
        maxStakeShare,
        maxWarnings: defaultScoringConfig.maxWarnings,
        mSolControl,
        veMndeControl,
        stakeBlocksFromBonus,
        concentrationParams: defaultScoringConfig.concentrationParams
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
                setValidatorsRawData({
                    validators: await apiDataProvider.fetchValidators(bonusEligibilityExtraEpochs + basicEligibilityEpochs, false),
                    mevConfig: await apiDataProvider.fetchValidatorsJitoMEV(false),
                    blacklist: await apiDataProvider.fetchBlacklist(false),
                    veMndeVotes: await apiDataProvider.fetchVeMndeVotes(false),
                    mSolVotes: await apiDataProvider.fetchMSolVotes(false),
                    bonds: await apiDataProvider.fetchBonds(false)
                })
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
            (async () => {
                const prefix = Math.random().toString(36).slice(2)
                const timeLabel = (label: string) => `${prefix}_${label}`

                console.time(timeLabel("getMaxEpoch"))
                const endEpoch = getMaxEpoch(validatorsRawData.validators)
                console.timeEnd(timeLabel("getMaxEpoch"))

                const validators = validatorsRawData.validators.filter(validator => {
                    const epochsToInspect = Array.from({ length: 3 }, (_, i) => endEpoch - i);
                    return epochsToInspect.some(epoch => {
                      const epochStat = validator.epochStats && validator.epochStats[epoch];
                      return epochStat && (typeof epochStat.credits === 'number') && epochStat.credits > 0;
                    });
                  });
    
                console.time(timeLabel("computeClusterInfo"))
                const clusterInfo = computeClusterInfo(validators, basicEligibilityEpochs, endEpoch)
                console.timeEnd(timeLabel("computeClusterInfo"))
    
                console.time(timeLabel("aggregateValidatorsData"))
                const aggregatedValidators = await aggregateValidatorsData(validators, basicEligibilityEpochs, bonusEligibilityExtraEpochs, validatorsRawData.mevConfig, validatorsRawData.blacklist)
                console.timeEnd(timeLabel("aggregateValidatorsData"))
    
                console.time(timeLabel("computeValidatorsScores"))
                const scores = computeValidatorsScores(clusterInfo, aggregatedValidators, formulas, weights, scoreConfig)
                console.timeEnd(timeLabel("computeValidatorsScores"))
    
                console.time(timeLabel("computeValidatorsEligibilities"))
                const eligibilities = computeValidatorsEligibilities(clusterInfo, scores, aggregatedValidators, validatorsRawData.bonds, eligibilityConfig, scoringConfig)
                console.timeEnd(timeLabel("computeValidatorsEligibilities"))
    
                console.time(timeLabel("computeValidatorsStakes"))
                const stakes = computeValidatorsStakes(aggregatedValidators, scores, eligibilities, stakesConfig, scoringConfig, validatorsRawData.mSolVotes, validatorsRawData.veMndeVotes)
                console.timeEnd(timeLabel("computeValidatorsStakes"))
                setValidatorsTableData({
                    aggregatedValidators, scores, eligibilities, stakes
                });
    
                const snapshot = takeSnapshot()
                history.pushState(null, null, `#!${snapshot}`);
            })();
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
        maxStakeShare,
        formulaVoteCredits,
        formulaBlockProduction,
        formulaInflationCommission,
        formulaMEVCommission,
        formulaStakeConcentrationCountry,
        formulaStakeConcentrationCity,
        formulaStakeConcentrationASO,
        formulaStakeConcentrationNode,
        tvl,
        mSolControl,
        veMndeControl,
        formulaStakeBlockSize,
        stakeBlocksFromBonus,
        formulaStakeBlocksFromScore,
    ])

    const deferredTable = useDeferredValue(validatorsTableData)

    return <div className={styles.pageWrap}>
        {/* <div className={styles.navigation}>
            <Navigation />
        </div> */}
        <div className={styles.control}>
            <div className={styles.controlSection}>
                <div className={styles.title}>Controls</div>
                <div className={styles.button} onClick={() => restoreSnapshot(DEFAULT_SNAPSHOT)}>Reset</div>
                <div className={styles.button} onClick={() => validatorsTableData && exportData(validatorsTableData)}>Export</div>
                <div className={styles.button} onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy Link</div>
                <div className={styles.button} onClick={async () => {
                    const { inflation, mev } = await apiDataProvider.fetchRewards(scoringConfig.REWARDS_PAST_EPOCHS)
                    const mevShare = mev / (inflation + mev)
                    const inflationShare = inflation / (inflation + mev)
                    console.log('Inflation:', inflation, 'MEV:', mev, 'MEV share:', mevShare)
                    setComponentWeightInflationCommission(Number((inflationShare * defaultScoringConfig.weightTargetSumOfRewards).toFixed(4)))
                    setComponentWeightMEVCommission(Number((mevShare * defaultScoringConfig.weightTargetSumOfRewards).toFixed(4)))
                }}>Update MEV</div>
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
                <NumberSelector title="Minimum concentration score" default={minScore} onChange={(value) => setMinScore(value)} />
                <NumberSelector title="Max stake share [%/100]" default={maxStakeShare} onChange={(value) => setMaxStakeShare(value)} />
            </div>
            <div className={styles.controlSection}>
                <div className={styles.title}>Stake assignment settings</div>
                <NumberSelector title="TVL [SOL]" default={tvl} onChange={(value) => setTvl(value)} />
                <NumberSelector title="mSOL votes control [%/100]" default={mSolControl} onChange={(value) => setMSolControl(value)} />
                <NumberSelector title="veMNDE votes control [%/100]" default={veMndeControl} onChange={(value) => setVeMndeControl(value)} />
                <ValueSelector parse={parseString} title="Stake block size" default={formulaStakeBlockSize} onChange={(value) => setFormulaStakeBlockSize(value)} />
                <ValueSelector parse={parseString} title="Stake blocks from score" default={formulaStakeBlocksFromScore} onChange={(value) => setFormulaStakeBlocksFromScore(value)} />
                <NumberSelector title="Stake blocks from bonus" default={stakeBlocksFromBonus} onChange={(value) => setStakeBlocksFromBonus(value)} />
            </div>
        </div>
        <div className={styles.statsSection}>
            {loading || !deferredTable || JSON.stringify(deferredTable) !== JSON.stringify(validatorsTableData) ? <><br /><br /><br /><Loader /></> : <Stats
                validatorsTableData={deferredTable}
            />}
        </div>
        <div className={styles.content}>
            {loading || !deferredTable || JSON.stringify(deferredTable) !== JSON.stringify(validatorsTableData) ? <><br /><br /><br /><Loader /></> : <ValidatorsTable
                validatorsTableData={deferredTable}
            />}
        </div>
    </div>
};

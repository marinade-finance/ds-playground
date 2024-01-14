import { Value } from "expr-eval"

export const mean = (data: number[]): number => {
    if (data.length === 0) {
        throw new Error('Cannot calculate mean for empty data')
    }

    return sum(data) / data.length
}

export const stdDev = (data: number[]): number => {
    if (data.length === 0) {
        throw new Error('Cannot calculate std. dev. for empty data')
    }
    const dataMean = mean(data)
    return (data.reduce((sum, value) => sum + (value - dataMean) ** 2, 0) / data.length) ** 0.5
}

export const sum = (data: number[]): number => data.reduce((sum, value) => sum + value, 0)

export const piecewise = (...args: Value[]): Value => {
    for (let conditionIndex = 0, valueIndex = 1; valueIndex < args.length - 1; conditionIndex += 2, valueIndex += 2) {
        const condition = args[conditionIndex]
        const value = args[valueIndex]

        if (typeof condition !== 'boolean') {
            throw new Error(`Argument at position ${conditionIndex} must be a boolean!`)
        }

        if (condition) {
            return value
        }
    }
    return args[args.length - 1]
}

export const mathUtilityFunctions = () => ({
    piecewise
})
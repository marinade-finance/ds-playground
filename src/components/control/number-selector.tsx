import React, { useEffect, useState } from "react";
import styles from './number-selector.module.css'

type Props = {
    title: string
    default: number
    onChange: (value: number) => void
}

const parseNumber = (value: string): number => {
    const parsed = Number(value)
    if (parsed.toString() !== value) {
        throw new Error(`Cannot parse ${value} as number!`)
    }
    return parsed
}

export const NumberSelector: React.FC<Props> = (props) => {
    const [value, setValue] = useState(props.default.toString())
    const [error, setError] = useState(false)
    
    useEffect(() => {
        setValue(props.default.toString())
    }, [props.default])

    useEffect(() => {
        try {
            const parsed = parseNumber(value)
            setError(false)
            props.onChange(parsed)
        } catch {
            setError(true)
        }
    }, [value])

    return <div className={styles.numberSelector}>
        {props.title}
        <input type="text" value={value} className={error ? styles.error : ''} onChange={(e) => setValue(e.target.value)} />
    </div>
};

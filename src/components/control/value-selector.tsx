import React, { useEffect, useState } from "react";
import styles from './value-selector.module.css'

type Props = {
    title: string
    default: string
    onChange: (value: string) => void
    parse: (value: string) => string
}

export const ValueSelector: React.FC<Props> = (props) => {
    const [value, setValue] = useState(props.default.toString())
    const [error, setError] = useState(false)
    
    useEffect(() => {
        setValue(props.default.toString())
    }, [props.default])

    useEffect(() => {
        try {
            const parsed = props.parse(value)
            setError(false)
            props.onChange(parsed)
        } catch {
            setError(true)
        }
    }, [value])

    return <div className={styles.valueSelector}>
        {props.title}
        <input type="text" value={value} className={error ? styles.error : ''} onChange={(e) => setValue(e.target.value)} />
    </div>
};

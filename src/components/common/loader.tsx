import React, { useEffect, useState } from "react";
import styles from './loader.module.css'

type Props = {}
export const Loader: React.FC<Props> = (props) => {
    return <div className={styles.loader}></div>;
}
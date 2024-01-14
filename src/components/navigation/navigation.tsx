import React from "react";
import { useNavigate } from "react-router-dom";
import styles from './navigation.module.css'

export const Navigation: React.FC = () => {
    const navigate = useNavigate()

    return <div className={styles.navigation}>
        <div onClick={() => navigate('/')}>Algorithmic</div>
    </div>
};

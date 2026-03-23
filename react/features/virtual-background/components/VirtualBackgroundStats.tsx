import React from 'react';
import { connect } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { IStore } from '../../app/types';
import { setVirtualBackgroundStatsEnabled } from '../actions';

const useStyles = makeStyles()(() => {
    return {
        statsContainer: {
            position: 'fixed',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#00FF00', // Matrix green
            padding: '15px',
            borderRadius: '8px',
            zIndex: 10000,
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: '1.5',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
            minWidth: '200px',
            border: '1px solid #00AA00'
        },
        closeButton: {
            position: 'absolute',
            top: '5px',
            right: '8px',
            cursor: 'pointer',
            color: '#00FF00',
            fontSize: '16px',
            fontWeight: 'bold',
            '&:hover': {
                color: '#FFFFFF'
            }
        },
        title: {
            fontWeight: 'bold',
            marginBottom: '10px',
            borderBottom: '1px solid #00AA00',
            paddingBottom: '5px',
            textAlign: 'center',
            fontSize: '14px',
            paddingRight: '20px' // Space for close button
        },
        statRow: {
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none'
        },
        label: {
            marginRight: '15px'
        },
        value: {
            fontWeight: 'bold'
        }
    };
});

interface IProps {
    _stats?: {
        fps: number;
        frameTime: number;
        inferenceTime: number;
        postProcessingTime: number;
        isUsingRVFC: boolean;
        resolution: string;
    };
    _statsEnabled?: boolean;
    dispatch: IStore['dispatch'];
}

/**
 * Component that displays real-time performance statistics for the virtual background.
 * It shows inference times, frame rates, and other technical metrics to help
 * developers optimize the feature.
 *
 * @returns {React$Element}
 */
const VirtualBackgroundStats = ({ _stats, _statsEnabled, dispatch }: IProps) => {
    const { classes } = useStyles();

    const handleClose = () => {
        dispatch(setVirtualBackgroundStatsEnabled(false));
    };

    // The overlay is only rendered if the feature is explicitly enabled
    // via the URL parameter '?vb_stats=true'.
    if (!_statsEnabled || !_stats) {
        return null;
    }

    return (
        <div className = { classes.statsContainer }>
            <div
                className = { classes.closeButton }
                onClick = { handleClose }
                title = 'Close stats overlay'>
                ×
            </div>
            <div className = { classes.title }>VB Performance Stats</div>
            <div className = { classes.statRow }>
                <span className = { classes.label }>Inference:</span>
                <span className = { classes.value }>{ _stats.inferenceTime } ms</span>
            </div>
            <div className = { classes.statRow }>
                <span className = { classes.label }>Post-Process:</span>
                <span className = { classes.value }>{ _stats.postProcessingTime } ms</span>
            </div>
            <div className = { classes.statRow }>
                <span className = { classes.label }>Frame Time:</span>
                <span className = { classes.value }>{ _stats.frameTime } ms</span>
            </div>
            <div className = { classes.statRow }>
                <span className = { classes.label }>FPS:</span>
                <span className = { classes.value }>{ _stats.fps }</span>
            </div>
            <div className = { classes.statRow }>
                <span className = { classes.label }>Resolution:</span>
                <span className = { classes.value }>{ _stats.resolution }</span>
            </div>
            <div className = { classes.statRow }>
                <span className = { classes.label }>rVFC:</span>
                <span className = { classes.value }>{ _stats.isUsingRVFC ? 'Enabled' : 'Disabled' }</span>
            </div>
            <div className = { classes.statRow }>
                <span className = { classes.label }>Worker:</span>
                <span className = { classes.value }>Disabled</span>
            </div>
        </div>
    );
};

/**
 * Maps (parts of) the Redux state to the associated props for the
 * {@code VirtualBackgroundStats} component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {{
 *     _stats: Object,
 *     _statsEnabled: boolean
 * }}
 */
function _mapStateToProps(state: any) {
    const { stats, statsEnabled } = state['features/virtual-background'];

    return {
        _stats: stats,
        _statsEnabled: statsEnabled
    };
}

export default connect(_mapStateToProps)(VirtualBackgroundStats);

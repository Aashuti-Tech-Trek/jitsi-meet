import { VIRTUAL_BACKGROUND_TYPE } from '../../virtual-background/constants';

import {
    CLEAR_TIMEOUT,
    SET_TIMEOUT,
    TIMEOUT_TICK,
    timerWorkerScript
} from './TimerWorker';

export interface IBackgroundEffectOptions {
    height: number;
    virtualBackground: {
        backgroundType?: string;
        blurValue?: number;
        virtualSource?: string;
    };
    width: number;
}

/**
 * Describes the interface exposed by the TFLite WASM module used for
 * person-segmentation inference.
 *
 * The module is loaded via {@code createTFLiteModule} / {@code createTFLiteSIMDModule}
 * (both are Emscripten-generated). Only the subset of the Emscripten runtime
 * surface that is actually used by this class is declared here.
 */
export interface ITFLiteModel {
    /**
     * Float32 heap view shared with the WASM linear memory. Used to write
     * input pixel data and read per-pixel segmentation scores.
     */
    HEAPF32: Float32Array;

    /**
     * Uint8 heap view shared with the WASM linear memory. Used to load the
     * raw model buffer.
     */
    HEAPU8: Uint8Array;

    /**
     * Returns the byte offset inside WASM memory where the model flatbuffer
     * should be written before calling {@code _loadModel}.
     *
     * @returns {number}
     */
    _getModelBufferMemoryOffset(): number;

    /**
     * Returns the byte offset inside WASM memory where the RGBA input image
     * data should be written before calling {@code _runInference}.
     *
     * @returns {number}
     */
    _getInputMemoryOffset(): number;

    /**
     * Returns the byte offset inside WASM memory from which the per-pixel
     * float segmentation scores can be read after {@code _runInference}.
     *
     * @returns {number}
     */
    _getOutputMemoryOffset(): number;

    /**
     * Initialises the TFLite interpreter with the model whose bytes were
     * previously written at {@code _getModelBufferMemoryOffset}.
     *
     * @param {number} modelSize - Byte length of the model flatbuffer.
     * @returns {void}
     */
    _loadModel(modelSize: number): void;

    /**
     * Runs a single forward pass of the segmentation model. Input must be
     * written to {@code _getInputMemoryOffset} beforehand; output is
     * available at {@code _getOutputMemoryOffset} after the call returns.
     *
     * @returns {void}
     */
    _runInference(): void;
}

/**
 * Minimal interface for a Jitsi local track used by {@link JitsiStreamBackgroundEffect}.
 * Only the properties accessed inside this class are declared.
 */
interface IJitsiLocalTrack {
    /**
     * Returns whether this track carries video.
     *
     * @returns {boolean}
     */
    isVideoTrack(): boolean;

    /**
     * The video source type (e.g. {@code 'camera'}, {@code 'desktop'}).
     */
    videoType: string;
}

/**
 * Represents a modified MediaStream that adds effects to video background.
 * <tt>JitsiStreamBackgroundEffect</tt> does the processing of the original
 * video stream.
 */
export default class JitsiStreamBackgroundEffect {
    _model: ITFLiteModel;
    _options: IBackgroundEffectOptions;
    _stream: MediaStream;
    _segmentationPixelCount: number;
    _inputVideoElement: HTMLVideoElement;
    _maskFrameTimerWorker: Worker;
    _outputCanvasElement: HTMLCanvasElement;
    _outputCanvasCtx: CanvasRenderingContext2D | null;
    _segmentationMaskCtx: CanvasRenderingContext2D | null;
    _segmentationMask: ImageData;
    _segmentationMaskCanvas: HTMLCanvasElement;
    _virtualImage: HTMLImageElement;
    _virtualVideo: HTMLVideoElement;

    /**
     * Constructs a new background effect processor.
     *
     * @param {ITFLiteModel} model - The initialised TFLite WASM module used
     * for person segmentation inference.
     * @param {IBackgroundEffectOptions} options - Segmentation canvas dimensions
     * and virtual-background configuration.
     */
    constructor(model: ITFLiteModel, options: IBackgroundEffectOptions) {
        this._options = options;

        if (this._options.virtualBackground.backgroundType === VIRTUAL_BACKGROUND_TYPE.IMAGE) {
            this._virtualImage = document.createElement('img');
            this._virtualImage.crossOrigin = 'anonymous';
            this._virtualImage.src = this._options.virtualBackground.virtualSource ?? '';
        }
        this._model = model;
        this._segmentationPixelCount = this._options.width * this._options.height;

        // Bind event handler so it is only bound once for every instance.
        this._onMaskFrameTimer = this._onMaskFrameTimer.bind(this);

        // Workaround for FF issue https://bugzilla.mozilla.org/show_bug.cgi?id=1388974
        this._outputCanvasElement = document.createElement('canvas');
        this._outputCanvasElement.getContext('2d');
        this._inputVideoElement = document.createElement('video');
    }

    /**
     * EventHandler onmessage for the maskFrameTimerWorker WebWorker.
     *
     * @private
     * @param {MessageEvent<{id: number}>} response - The onmessage EventHandler parameter.
     * @returns {void}
     */
    _onMaskFrameTimer(response: { data: { id: number; }; }) {
        if (response.data.id === TIMEOUT_TICK) {
            this._renderMask();
        }
    }

    /**
     * Composites the segmentation mask, foreground video and background
     * (blur or image) onto the output canvas.
     *
     * @returns {void}
     */
    runPostProcessing() {

        const track = this._stream.getVideoTracks()[0];
        const { height, width } = track.getSettings() ?? track.getConstraints();
        const { backgroundType } = this._options.virtualBackground;

        if (!this._outputCanvasCtx) {
            return;
        }

        this._outputCanvasElement.height = height as number;
        this._outputCanvasElement.width = width as number;
        this._outputCanvasCtx.globalCompositeOperation = 'copy';

        // Draw segmentation mask.

        // Smooth out the edges.
        this._outputCanvasCtx.filter = backgroundType === VIRTUAL_BACKGROUND_TYPE.IMAGE ? 'blur(4px)' : 'blur(8px)';
        this._outputCanvasCtx.drawImage(
            this._segmentationMaskCanvas,
            0,
            0,
            this._options.width,
            this._options.height,
            0,
            0,
            this._inputVideoElement.width,
            this._inputVideoElement.height
        );
        this._outputCanvasCtx.globalCompositeOperation = 'source-in';
        this._outputCanvasCtx.filter = 'none';

        // Draw the foreground video.
        this._outputCanvasCtx.drawImage(this._inputVideoElement, 0, 0);

        // Draw the background.
        this._outputCanvasCtx.globalCompositeOperation = 'destination-over';
        if (backgroundType === VIRTUAL_BACKGROUND_TYPE.IMAGE) {
            this._outputCanvasCtx.drawImage(
                this._virtualImage,
                0,
                0,
                this._outputCanvasElement.width,
                this._outputCanvasElement.height
            );
        } else {
            this._outputCanvasCtx.filter = `blur(${this._options.virtualBackground.blurValue}px)`;
            this._outputCanvasCtx.drawImage(this._inputVideoElement, 0, 0);
        }
    }

    /**
     * Runs a single TFLite segmentation inference pass and writes the
     * resulting alpha mask into {@code _segmentationMask}.
     *
     * @returns {void}
     */
    runInference() {
        this._model._runInference();
        const outputMemoryOffset = this._model._getOutputMemoryOffset() / 4;

        for (let i = 0; i < this._segmentationPixelCount; i++) {
            const person = this._model.HEAPF32[outputMemoryOffset + i];

            // Sets only the alpha component of each pixel.
            this._segmentationMask.data[(i * 4) + 3] = 255 * person;

        }
        this._segmentationMaskCtx?.putImageData(this._segmentationMask, 0, 0);
    }

    /**
     * Loop function to render the background mask.
     *
     * @private
     * @returns {void}
     */
    _renderMask() {
        this.resizeSource();
        this.runInference();
        this.runPostProcessing();

        this._maskFrameTimerWorker.postMessage({
            id: SET_TIMEOUT,
            timeMs: 1000 / 30
        });
    }

    /**
     * Scales the current video frame down to the segmentation-model input
     * dimensions and writes the normalised RGB values into WASM memory.
     *
     * @returns {void}
     */
    resizeSource() {
        this._segmentationMaskCtx?.drawImage(
            this._inputVideoElement,
            0,
            0,
            this._inputVideoElement.width,
            this._inputVideoElement.height,
            0,
            0,
            this._options.width,
            this._options.height
        );

        const imageData = this._segmentationMaskCtx?.getImageData(
            0,
            0,
            this._options.width,
            this._options.height
        );
        const inputMemoryOffset = this._model._getInputMemoryOffset() / 4;

        for (let i = 0; i < this._segmentationPixelCount; i++) {
            this._model.HEAPF32[inputMemoryOffset + (i * 3)] = Number(imageData?.data[i * 4]) / 255;
            this._model.HEAPF32[inputMemoryOffset + (i * 3) + 1] = Number(imageData?.data[(i * 4) + 1]) / 255;
            this._model.HEAPF32[inputMemoryOffset + (i * 3) + 2] = Number(imageData?.data[(i * 4) + 2]) / 255;
        }
    }

    /**
     * Checks if the local track supports this effect.
     *
     * @param {IJitsiLocalTrack} jitsiLocalTrack - Track to apply effect.
     * @returns {boolean} - Returns true if this effect can run on the specified track,
     * false otherwise.
     */
    isEnabled(jitsiLocalTrack: IJitsiLocalTrack) {
        return jitsiLocalTrack.isVideoTrack() && jitsiLocalTrack.videoType === 'camera';
    }

    /**
     * Starts loop to capture video frame and render the segmentation mask.
     *
     * @param {MediaStream} stream - Stream to be used for processing.
     * @returns {MediaStream} - The stream with the applied effect.
     */
    startEffect(stream: MediaStream) {
        this._stream = stream;
        this._maskFrameTimerWorker = new Worker(timerWorkerScript, { name: 'Blur effect worker' });
        this._maskFrameTimerWorker.onmessage = this._onMaskFrameTimer;
        const firstVideoTrack = this._stream.getVideoTracks()[0];
        const { height, frameRate, width }
            = firstVideoTrack.getSettings ? firstVideoTrack.getSettings() : firstVideoTrack.getConstraints();

        this._segmentationMask = new ImageData(this._options.width, this._options.height);
        this._segmentationMaskCanvas = document.createElement('canvas');
        this._segmentationMaskCanvas.width = this._options.width;
        this._segmentationMaskCanvas.height = this._options.height;
        this._segmentationMaskCtx = this._segmentationMaskCanvas.getContext('2d');

        this._outputCanvasElement.width = parseInt(String(width), 10);
        this._outputCanvasElement.height = parseInt(String(height), 10);
        this._outputCanvasCtx = this._outputCanvasElement.getContext('2d');
        this._inputVideoElement.width = parseInt(String(width), 10);
        this._inputVideoElement.height = parseInt(String(height), 10);
        this._inputVideoElement.autoplay = true;
        this._inputVideoElement.srcObject = this._stream;
        this._inputVideoElement.onloadeddata = () => {
            this._maskFrameTimerWorker.postMessage({
                id: SET_TIMEOUT,
                timeMs: 1000 / 30
            });
        };

        return this._outputCanvasElement.captureStream(parseInt(String(frameRate), 10));
    }

    /**
     * Stops the capture and render loop.
     *
     * @returns {void}
     */
    stopEffect() {
        this._maskFrameTimerWorker.postMessage({
            id: CLEAR_TIMEOUT
        });

        this._maskFrameTimerWorker.terminate();
    }
}

# Jitsi Meet Windows Dev Script
# This script replaces 'make dev' for Windows environments

$DEPLOY_DIR = "libs"
$SASS = ".\node_modules\.bin\sass"
$CLEANCSS = ".\node_modules\.bin\cleancss"
$WEBPACK_DEV_SERVER = ".\node_modules\.bin\webpack"

# 1. Clean and Create Deployment Directory
Write-Host "Cleaning and creating $DEPLOY_DIR..." -ForegroundColor Cyan
if (Test-Path $DEPLOY_DIR) { Remove-Item -Recurse -Force $DEPLOY_DIR }
New-Item -ItemType Directory -Path $DEPLOY_DIR | Out-Null

# 2. Compile CSS
Write-Host "Compiling CSS..." -ForegroundColor Cyan
& $SASS css/main.scss css/all.bundle.css
& $CLEANCSS --skip-rebase css/all.bundle.css | Out-File -FilePath css/all.css -Encoding utf8
Remove-Item css/all.bundle.css

# 3. Copy Assets to libs
Write-Host "Deploying assets to $DEPLOY_DIR..." -ForegroundColor Cyan

# Rnnoise
Copy-Item "node_modules/@jitsi/rnnoise-wasm/dist/rnnoise.wasm" $DEPLOY_DIR

# TFLite
Copy-Item "react/features/stream-effects/virtual-background/vendor/tflite/*.wasm" $DEPLOY_DIR

# Meet Models
Copy-Item "react/features/stream-effects/virtual-background/vendor/models/*.tflite" $DEPLOY_DIR

# Lib Jitsi Meet
Copy-Item "node_modules/lib-jitsi-meet/dist/umd/lib-jitsi-meet.*" $DEPLOY_DIR

# Olm
Copy-Item "node_modules/@matrix-org/olm/olm.wasm" $DEPLOY_DIR

# TF Wasm
Copy-Item "node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm" $DEPLOY_DIR

# Excalidraw Dev Assets
if (Test-Path "node_modules/@jitsi/excalidraw/dist/excalidraw-assets-dev") {
    Copy-Item -Recurse "node_modules/@jitsi/excalidraw/dist/excalidraw-assets-dev" "$DEPLOY_DIR/excalidraw-assets"
}

# Face Landmarks
Copy-Item "node_modules/@vladmandic/human-models/models/blazeface-front.bin" $DEPLOY_DIR
Copy-Item "node_modules/@vladmandic/human-models/models/blazeface-front.json" $DEPLOY_DIR
Copy-Item "node_modules/@vladmandic/human-models/models/emotion.bin" $DEPLOY_DIR
Copy-Item "node_modules/@vladmandic/human-models/models/emotion.json" $DEPLOY_DIR

# 4. Start Webpack Dev Server
Write-Host "Starting Webpack Dev Server..." -ForegroundColor Green
& $WEBPACK_DEV_SERVER serve --mode development --progress

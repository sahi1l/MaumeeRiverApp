npx cap sync
cd android
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../maumee.apk

#!/bin/zsh
# iOS production build that can sync capabilities (Push Notifications) with Apple.
# Uses the App Store Connect API key in this folder, so no Apple ID password is asked.
# Answer "yes" if EAS offers to update capabilities or make a new provisioning profile.
cd "$(dirname "$0")/.."
export EXPO_ASC_API_KEY_PATH=./AuthKey_5V8NATR8UT.p8
export EXPO_ASC_KEY_ID=5V8NATR8UT
export EXPO_ASC_ISSUER_ID=bf59836c-e4e5-4d4e-bf5d-d8f2cce53b69
export EXPO_APPLE_TEAM_ID=Q9UZLJPMD3
export EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
npx eas-cli build --platform ios --profile production --no-wait

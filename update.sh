#!/bin/bash

yarn tsc 

git add .
git commit -m "Refactoring"
git push

sleep 3

cd ../backstage-neotek
rm -rf node_modules/backstage-neotek-modules
rm -rf yarn.lock
yarn install
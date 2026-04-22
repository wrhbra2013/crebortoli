#!/bin/bash

# Script para parar a API
# Execute: bash stop.sh

pkill -f "node.*server.js" && echo "API parada" || echo "API não estava rodando"
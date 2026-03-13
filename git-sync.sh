#!/bin/bash

# Script para commit, pull e push no Git
# Uso: ./git-sync.sh "mensagem do commit"

MENSAGEM="${1:-Atualização}"

# Cores para output
VERDE='\033[0;32m'
AZUL='\033[0;34m'
AMARELO='\033[1;33m'
RESET='\033[0m'

echo -e "${AZUL}=== Git Sync ===${RESET}\n"

# Verificar se há mudanças
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${AMARELO}Não há mudanças para commitar.${RESET}"
    exit 0
fi

# Mostrar status
echo -e "${AZUL}Status:${RESET}"
git status --short

# Adicionar todas as mudanças
echo -e "\n${AZUL}Adicionando arquivos...${RESET}"
git add -A

# Commit
echo -e "\n${AZUL}Criando commit...${RESET}"
git commit -m "$MENSAGEM"

# Pull (puxar alterações remoto -> local)
echo -e "\n${AZUL}Pulling...${RESET}"
git pull origin main

# Push (enviar local -> remoto)
echo -e "\n${AZUL}Pushing...${RESET}"
git push origin main

echo -e "\n${VERDE}Concluído!${RESET}"

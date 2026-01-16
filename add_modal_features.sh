#!/bin/bash

# Criar backup
cp src/App.jsx src/App.jsx.bak

# 1. Adicionar estado do modal (depois da linha com tempHPAmount)
sed -i '/const \[tempHPAmount, setTempHPAmount\] = useState/a\
\
  // Estados para Dados da Conta (Backup/Restore)\
  const [showAccountDataModal, setShowAccountDataModal] = useState(false)' src/App.jsx

# 2. Adicionar funções de download e upload (depois da função advancePokemonTurn)
LINE=$(grep -n "const advancePokemonTurn = " src/App.jsx | tail -1 | cut -d: -f1)
LINE_END=$((LINE + 12))

# Adicionar depois da função advancePokemonTurn
sed -i "${LINE_END}a\
\
  // Função para fazer download dos dados da conta\
  const handleDownloadAccountData = () => {\
    try {\
      let data = {}\
      let filename = ''\
\
      if (currentUser?.type === 'treinador') {\
        const key = \`trainer_\${currentUser.username}\`\
        const saved = localStorage.getItem(key)\
        if (saved) {\
          data = JSON.parse(saved)\
          filename = \`\${currentUser.username}_backup.json\`\
        } else {\
          alert('Nenhum dado encontrado para esta conta.')\
          return\
        }\
      } else if (currentUser?.type === 'mestre') {\
        const key = 'mestre_config'\
        const saved = localStorage.getItem(key)\
        if (saved) {\
          data = JSON.parse(saved)\
          filename = 'Mestre_backup.json'\
        } else {\
          alert('Nenhum dado encontrado para a conta do Mestre.')\
          return\
        }\
      }\
\
      const jsonString = JSON.stringify(data, null, 2)\
      const blob = new Blob([jsonString], { type: 'application/json' })\
      const url = URL.createObjectURL(blob)\
      const link = document.createElement('a')\
      link.href = url\
      link.download = filename\
      document.body.appendChild(link)\
      link.click()\
      document.body.removeChild(link)\
      URL.revokeObjectURL(url)\
\
      alert(\`Backup realizado com sucesso! Arquivo: \${filename}\`)\
    } catch (error) {\
      console.error('Erro ao fazer backup:', error)\
      alert('Erro ao criar backup dos dados.')\
    }\
  }" src/App.jsx

echo "Mudanças aplicadas com sucesso!"
